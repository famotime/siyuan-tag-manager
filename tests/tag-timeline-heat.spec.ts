import { describe, expect, it } from 'vitest';
import { TagTimelineService } from '../src/services/TagTimelineService';

describe('TagTimelineService 标签生命周期与时序热力分析测试', () => {
  it('正确解析思源 14 位时间戳字符串', () => {
    const d = TagTimelineService.parseSiyuanTime('20260926083000');
    expect(d).toBeDefined();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(8); // 9 月对应索引 8
    expect(d?.getDate()).toBe(26);
  });

  it('正确统计近 7 天、近 30 天频次并判断活跃趋势', () => {
    const ref = new Date('2026-09-26T12:00:00Z');
    // 模拟数据: 20260925 (1天前), 20260924 (2天前), 20260901 (25天前), 20260701 (87天前)
    const timestamps = [
      '20260925100000',
      '20260924100000',
      '20260901100000',
      '20260701100000',
    ];

    const stats = TagTimelineService.calculateTimelineStats('YouTube', timestamps, ref);

    expect(stats.totalCount).toBe(4);
    expect(stats.recent7DaysCount).toBe(2);
    expect(stats.recent30DaysCount).toBe(3);
    expect(stats.monthlyDistribution['2026-09']).toBe(3);
    expect(stats.monthlyDistribution['2026-07']).toBe(1);
    expect(stats.activityTrend).toBe('rising');
  });

  it('超过 30 天无更新的标签应判定为冷却状态', () => {
    const ref = new Date('2026-09-26T12:00:00Z');
    const oldTimestamps = ['20251201100000', '20260101100000'];

    const stats = TagTimelineService.calculateTimelineStats('OldProject', oldTimestamps, ref);
    expect(stats.recent7DaysCount).toBe(0);
    expect(stats.recent30DaysCount).toBe(0);
    expect(stats.activityTrend).toBe('cooling');
  });
});
