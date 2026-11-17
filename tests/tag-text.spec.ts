import { describe, it, expect } from 'vitest';
import { stripTagHash, parseIalTags, escapeSqlLiteral } from '../src/utils/tagText';
import { TagFilterEngine } from '../src/services/TagFilterEngine';
import { TagCreationService } from '../src/services/TagCreationService';

/**
 * 全库统一的标签文本处理叶子工具测试
 * 这些函数是 8 处 # 剥离、5 处 IAL 解析、7 处 SQL 转义内联实现的唯一规范来源
 */
describe('标签文本统一工具', () => {
  describe('stripTagHash · 剥离首尾井号并修剪', () => {
    it('剥离常规 #标签# 包裹', () => {
      expect(stripTagHash('#tech#')).toBe('tech');
      expect(stripTagHash('#tech/vue#')).toBe('tech/vue');
    });

    it('剥离多层井号包裹', () => {
      expect(stripTagHash('##tech##')).toBe('tech');
      expect(stripTagHash('###读书笔记###')).toBe('读书笔记');
    });

    it('无井号时原样返回（仅修剪）', () => {
      expect(stripTagHash('tech')).toBe('tech');
      expect(stripTagHash('  tech  ')).toBe('tech');
    });

    it('空白包裹井号时仍可完整剥离（trim-strip-trim 语义，统一各处漂移实现）', () => {
      expect(stripTagHash(' #tech# ')).toBe('tech');
      expect(stripTagHash('\t#tech#\n')).toBe('tech');
    });

    it('拖拽 payload 格式 #标签#+尾随空格 可正确还原', () => {
      expect(stripTagHash('#tech/vue# ')).toBe('tech/vue');
    });

    it('井号内文本中的空格与斜杠不受影响', () => {
      expect(stripTagHash('#项目 管理#')).toBe('项目 管理');
    });

    it('纯井号输入剥离为空串', () => {
      expect(stripTagHash('###')).toBe('');
      expect(stripTagHash('#')).toBe('');
    });

    it('空值防御', () => {
      expect(stripTagHash('')).toBe('');
      expect(stripTagHash(undefined as any)).toBe('');
      expect(stripTagHash(null as any)).toBe('');
    });
  });

  describe('parseIalTags · 解析思源 IAL 标记中的 tags 属性', () => {
    it('解析标准 IAL 中的 tags 属性', () => {
      expect(parseIalTags('{: id="20240101120000-abc" tags="tech, reading"}')).toBe('tech, reading');
    });

    it('tags 属性位于任意位置均可解析', () => {
      expect(parseIalTags('tags="a,b" {: id="x"}')).toBe('a,b');
      expect(parseIalTags('{: title="笔记" tags="a,b"}')).toBe('a,b');
    });

    it('无 tags 属性返回空串', () => {
      expect(parseIalTags('{: id="x" title="y"}')).toBe('');
    });

    it('空 tags 属性返回空串', () => {
      expect(parseIalTags('{: tags=""}')).toBe('');
    });

    it('空值与 null 防御', () => {
      expect(parseIalTags('')).toBe('');
      expect(parseIalTags(null)).toBe('');
      expect(parseIalTags(undefined)).toBe('');
    });

    it('多级标签逗号串原样返回（不做拆分，交由调用方处理）', () => {
      expect(parseIalTags('{: tags="a/b,c"}')).toBe('a/b,c');
    });
  });

  describe('escapeSqlLiteral · SQL 字面量单引号转义', () => {
    it('单引号翻倍', () => {
      expect(escapeSqlLiteral('it\'s')).toBe('it\'\'s');
      expect(escapeSqlLiteral('a\'b\'c')).toBe('a\'\'b\'\'c');
    });

    it('无单引号原样返回', () => {
      expect(escapeSqlLiteral('plain')).toBe('plain');
      expect(escapeSqlLiteral('20240101120000-abcdef')).toBe('20240101120000-abcdef');
    });

    it('空值防御', () => {
      expect(escapeSqlLiteral('')).toBe('');
      expect(escapeSqlLiteral(undefined as any)).toBe('');
    });
  });

  describe('与既有规范实现的一致性', () => {
    it('FilterEngine.escapeSql 的引号部分与 escapeSqlLiteral 一致', () => {
      const sample = 'o\'brien';
      expect(TagFilterEngine.escapeSql(sample)).toBe(escapeSqlLiteral(sample));
    });

    it('TagCreationService.cleanTag 保持原 API 且与 stripTagHash 语义一致', () => {
      expect(TagCreationService.cleanTag('#tech#')).toBe('tech');
      expect(TagCreationService.cleanTag(' #tech# ')).toBe('tech');
      expect(TagCreationService.cleanTag('#a/b#')).toBe('a/b');
    });
  });
});
