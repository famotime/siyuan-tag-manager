export interface ITagTimelineStats {
  label: string;
  totalCount: number;
  lastUpdated?: string;
  recent7DaysCount: number;
  recent30DaysCount: number;
  monthlyDistribution: Record<string, number>; // key: "YYYY-MM", val: count
  activityTrend: 'rising' | 'stable' | 'cooling';
}

/**
 * 标签生命周期与时序热力分析服务
 */
export class TagTimelineService {
  /**
   * 将思源时间戳字符串解析为 Date 对象
   * 思源格式通常为: "20260926080000" 或 ISO 字符串
   */
  public static parseSiyuanTime(timeStr?: string): Date | null {
    if (!timeStr) return null;
    const clean = timeStr.trim();
    if (/^\d{14}$/.test(clean)) {
      const year = parseInt(clean.slice(0, 4), 10);
      const month = parseInt(clean.slice(4, 6), 10) - 1;
      const day = parseInt(clean.slice(6, 8), 10);
      const hour = parseInt(clean.slice(8, 10), 10);
      const min = parseInt(clean.slice(10, 12), 10);
      const sec = parseInt(clean.slice(12, 14), 10);
      return new Date(year, month, day, hour, min, sec);
    }
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * 格式化月份为 YYYY-MM
   */
  public static formatMonth(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * 计算指定标签的时序生命周期统计数据
   * @param label 标签名
   * @param blockTimestamps 关联块的时间戳列表
   * @param referenceDate 参考基准时间（默认当前时间）
   */
  public static calculateTimelineStats(
    label: string,
    blockTimestamps: string[],
    referenceDate = new Date(),
  ): ITagTimelineStats {
    const refMs = referenceDate.getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    let recent7DaysCount = 0;
    let recent30DaysCount = 0;
    const monthlyDist: Record<string, number> = {};
    let latestTime: Date | null = null;

    for (const ts of blockTimestamps) {
      const date = this.parseSiyuanTime(ts);
      if (!date) continue;

      if (!latestTime || date.getTime() > latestTime.getTime()) {
        latestTime = date;
      }

      const diffMs = refMs - date.getTime();
      if (diffMs >= 0 && diffMs <= 7 * dayMs) {
        recent7DaysCount++;
      }
      if (diffMs >= 0 && diffMs <= 30 * dayMs) {
        recent30DaysCount++;
      }

      const monthKey = this.formatMonth(date);
      monthlyDist[monthKey] = (monthlyDist[monthKey] || 0) + 1;
    }

    // 活跃趋势判断
    let activityTrend: ITagTimelineStats['activityTrend'] = 'stable';
    if (recent7DaysCount >= 3 || (recent30DaysCount > 0 && recent7DaysCount / recent30DaysCount >= 0.5)) {
      activityTrend = 'rising';
    } else if (recent30DaysCount === 0) {
      activityTrend = 'cooling';
    }

    return {
      label,
      totalCount: blockTimestamps.length,
      lastUpdated: latestTime ? latestTime.toISOString().slice(0, 10) : undefined,
      recent7DaysCount,
      recent30DaysCount,
      monthlyDistribution: monthlyDist,
      activityTrend,
    };
  }
}
