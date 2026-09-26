import { ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagHealthIssue, ITagItem } from '../types/tag';
import { TagGovernanceService } from '../services/TagGovernanceService';
import { TagApiClient } from '../services/TagApiClient';

const healthResult = ref(TagGovernanceService.runHealthInspection([]));

export function useTagHygiene() {
  function updateHealthResult(tags: ITagItem[]) {
    healthResult.value = TagGovernanceService.runHealthInspection(tags);
  }

  async function autoResolveIssue(
    issue: ITagHealthIssue,
    allTags: ITagItem[],
    onSuccess?: () => void
  ) {
    if (!issue.relatedLabels || issue.relatedLabels.length === 0) return;
    const planRes = TagGovernanceService.generateMergePlan(issue.primaryLabel, issue.relatedLabels, allTags, true);

    if (!planRes.plan) {
      showMessage(planRes.error || '无法生成合并计划', 3000, 'error');
      return;
    }

    try {
      const res = await TagApiClient.executeMergePlan(planRes.plan);
      if (res.success) {
        showMessage(`已成功规整并合并冲突到 "${issue.primaryLabel}"`, 3000, 'info');
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err: any) {
      showMessage(`修复失败: ${err.message || err}`, 4000, 'error');
    }
  }

  return {
    healthResult,
    updateHealthResult,
    autoResolveIssue,
  };
}
