import { describe, expect, it } from 'vitest';
import { TagPinyinAliasService } from '../src/services/TagPinyinAliasService';
import type { ITagItem } from '../src/types/tag';

describe('TagPinyinAliasService 拼音首字母与别名模糊联想引擎测试', () => {
  const mockTags: ITagItem[] = [
    {
      name: 'YouTube',
      label: 'YouTube',
      count: 11,
      depth: 0,
      metadata: { label: 'YouTube', aliases: ['油管', '视频分析'], updatedAt: 0 },
    },
    {
      name: 'Prompt',
      label: 'Prompt',
      count: 23,
      depth: 0,
      metadata: { label: 'Prompt', aliases: ['提示词', 'AI指令'], updatedAt: 0 },
    },
    {
      name: '产品案例',
      label: '产品案例',
      count: 5,
      depth: 0,
    },
    {
      name: 'Python数据可视化',
      label: 'Python数据可视化',
      count: 2,
      depth: 0,
    },
    {
      name: '人工智能',
      label: '人工智能',
      count: 30,
      depth: 0,
    },
  ];

  it('支持中文全拼与拼音首字母缩写模糊联想', () => {
    // 拼音首字母匹配 "产品案例" -> cpal 或 cpa
    const res1 = TagPinyinAliasService.matchTags(mockTags, 'cpal');
    expect(res1.length).toBeGreaterThan(0);
    expect(res1[0].tag.name).toBe('产品案例');
    expect(res1[0].matchType).toBe('pinyin');

    // 拼音首字母匹配 "人工智能" -> rgzn
    const res2 = TagPinyinAliasService.matchTags(mockTags, 'rgzn');
    expect(res2.length).toBeGreaterThan(0);
    expect(res2[0].tag.name).toBe('人工智能');
  });

  it('支持多音字与混合拼音首字母匹配', () => {
    // 匹配 "Python数据可视化" -> sjksh
    const res = TagPinyinAliasService.matchTags(mockTags, 'sjksh');
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].tag.name).toBe('Python数据可视化');
  });

  it('支持别名完全命中与别名拼音命中', () => {
    // 别名 "油管" 命中 YouTube
    const res1 = TagPinyinAliasService.matchTags(mockTags, '油管');
    expect(res1.length).toBeGreaterThan(0);
    expect(res1[0].tag.name).toBe('YouTube');
    expect(res1[0].matchType).toBe('alias');

    // 别名拼音首字母 "yg" 命中 YouTube
    const res2 = TagPinyinAliasService.matchTags(mockTags, 'yg');
    expect(res2.length).toBeGreaterThan(0);
    expect(res2[0].tag.name).toBe('YouTube');

    // 别名 "提示词" 命中 Prompt
    const res3 = TagPinyinAliasService.matchTags(mockTags, 'tsc');
    expect(res3.length).toBeGreaterThan(0);
    expect(res3[0].tag.name).toBe('Prompt');
  });

  it('空查询词时默认按引用数倒序返回常用标签', () => {
    const res = TagPinyinAliasService.matchTags(mockTags, '');
    expect(res[0].tag.name).toBe('YouTube'); // 原始顺序切片
  });
});
