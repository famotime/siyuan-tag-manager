import PinyinMatch from 'pinyin-match';
import type { ITagItem } from '../types/tag';

export interface ITagMatchResult {
  tag: ITagItem;
  score: number;
  matchType: 'exact' | 'prefix' | 'alias' | 'pinyin' | 'fuzzy';
  matchedText: string;
}

/**
 * 标签拼音首字母与别名模糊联想引擎
 */
export class TagPinyinAliasService {
  /**
   * 搜索并按相关度综合打分排序标签列表
   * @param tags 全库标签列表
   * @param query 用户输入的搜索词（支持拼音首字母、全拼、别名、汉字）
   * @param limit 返回最大数量
   */
  public static matchTags(tags: ITagItem[], query: string, limit = 20): ITagMatchResult[] {
    const q = query.trim();
    if (!q) {
      // 查询词为空时，按引用计数返回最常用的标签
      return tags.slice(0, limit).map(t => ({
        tag: t,
        score: t.count,
        matchType: 'exact',
        matchedText: t.name,
      }));
    }

    const lowerQ = q.toLowerCase();
    const results: ITagMatchResult[] = [];

    for (const tag of tags) {
      const lowerName = tag.name.toLowerCase();
      const lowerLabel = tag.label.toLowerCase();
      let matched = false;
      let score = 0;
      let matchType: ITagMatchResult['matchType'] = 'fuzzy';
      let matchedText = tag.name;

      // 1. 完全匹配 (最高优先级)
      if (lowerName === lowerQ || lowerLabel === lowerQ) {
        matched = true;
        score = 1000 + tag.count;
        matchType = 'exact';
        matchedText = tag.name;
      }
      // 2. 前缀匹配
      else if (lowerName.startsWith(lowerQ) || lowerLabel.startsWith(lowerQ)) {
        matched = true;
        score = 800 + tag.count;
        matchType = 'prefix';
        matchedText = tag.name;
      }
      // 3. 别名完全匹配或前缀匹配
      else if (tag.metadata?.aliases && tag.metadata.aliases.length > 0) {
        for (const alias of tag.metadata.aliases) {
          const lowerAlias = alias.toLowerCase();
          if (lowerAlias === lowerQ) {
            matched = true;
            score = 750 + tag.count;
            matchType = 'alias';
            matchedText = alias;
            break;
          } else if (lowerAlias.startsWith(lowerQ)) {
            matched = true;
            score = 650 + tag.count;
            matchType = 'alias';
            matchedText = alias;
            break;
          }
        }
      }

      // 4. 拼音首字母 / 全拼匹配 (如 ytb -> YouTube, cp -> 产品案例)
      if (!matched) {
        // 先对标签名进行拼音匹配
        const pinyinMatchName = PinyinMatch.match(tag.name, q);
        if (pinyinMatchName) {
          matched = true;
          score = 500 + tag.count;
          matchType = 'pinyin';
          matchedText = tag.name;
        } else if (tag.metadata?.aliases) {
          // 对别名进行拼音匹配 (如 yg -> 油管 -> YouTube)
          for (const alias of tag.metadata.aliases) {
            if (PinyinMatch.match(alias, q)) {
              matched = true;
              score = 450 + tag.count;
              matchType = 'pinyin';
              matchedText = alias;
              break;
            }
          }
        }
      }

      // 5. 子串包含兜底匹配
      if (!matched && (lowerName.includes(lowerQ) || lowerLabel.includes(lowerQ))) {
        matched = true;
        score = 200 + tag.count;
        matchType = 'fuzzy';
        matchedText = tag.name;
      }

      if (matched) {
        results.push({
          tag,
          score,
          matchType,
          matchedText,
        });
      }
    }

    // 按得分从高到低排序
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
}
