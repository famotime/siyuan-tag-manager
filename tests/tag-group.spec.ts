import { describe, expect, it } from 'vitest';
import { TagGroupService } from '../src/services/TagGroupService';
import type { ITagGroup } from '../src/types/tag';

describe('TagGroupService 标签组管理与应用测试', () => {
  const initialGroups: ITagGroup[] = [
    {
      id: 'tg_1',
      name: '前端技术栈',
      tags: ['Vue', 'React', 'TypeScript'],
      color: '#4285F4',
      sortOrder: 0,
    },
    {
      id: 'tg_2',
      name: '日常复盘',
      tags: ['待办', '复盘'],
      color: '#0E6E45',
      sortOrder: 1,
    },
  ];

  it('成功创建新标签组并自动规范化与去重标签', () => {
    const res = TagGroupService.createGroup(initialGroups, {
      name: '后端架构',
      tags: [' Go ', 'Docker', 'Go', '#K8s#'],
      color: '#B45309',
    });

    expect(res.error).toBeUndefined();
    expect(res.groups.length).toBe(3);
    expect(res.newGroup.name).toBe('后端架构');
    expect(res.newGroup.tags).toEqual(['Go', 'Docker', 'K8s']);
    expect(res.newGroup.sortOrder).toBe(2);
  });

  it('拒绝创建空名称的标签组', () => {
    const res = TagGroupService.createGroup(initialGroups, {
      name: '   ',
      tags: ['Vue'],
    });

    expect(res.error).toBe('标签组名称不能为空');
    expect(res.groups.length).toBe(2);
  });

  it('成功更新现有标签组的名称与标签列表', () => {
    const res = TagGroupService.updateGroup(initialGroups, 'tg_1', {
      name: '现代前端栈',
      tags: ['Vue', 'Vite', 'TypeScript'],
    });

    expect(res.error).toBeUndefined();
    const updated = res.groups.find(g => g.id === 'tg_1');
    expect(updated?.name).toBe('现代前端栈');
    expect(updated?.tags).toEqual(['Vue', 'Vite', 'TypeScript']);
  });

  it('成功删除标签组', () => {
    const afterDelete = TagGroupService.deleteGroup(initialGroups, 'tg_2');
    expect(afterDelete.length).toBe(1);
    expect(afterDelete[0].id).toBe('tg_1');
  });

  it('支持按指定 ID 顺序重新排序标签组', () => {
    const reordered = TagGroupService.reorderGroups(initialGroups, ['tg_2', 'tg_1']);
    expect(reordered[0].id).toBe('tg_2');
    expect(reordered[0].sortOrder).toBe(0);
    expect(reordered[1].id).toBe('tg_1');
    expect(reordered[1].sortOrder).toBe(1);
  });

  it('applyGroupToDoc 调用思源属性接口为文档追加写入标签', async () => {
    const calls: Array<{ url: string; data: any }> = [];
    const mockRequest = async (url: string, data: any) => {
      calls.push({ url, data });
      if (url === '/api/attr/getBlockAttrs') {
        return { code: 0, data: { tags: 'YouTube,AI' } };
      }
      if (url === '/api/attr/setBlockAttrs') {
        return { code: 0, data: null };
      }
      return { code: 0 };
    };

    const res = await TagGroupService.applyGroupToDoc('doc_123', ['Prompt', 'AI'], mockRequest);
    expect(res.success).toBe(true);
    expect(calls.length).toBe(2);
    expect(calls[0].url).toBe('/api/attr/getBlockAttrs');
    expect(calls[1].url).toBe('/api/attr/setBlockAttrs');
    expect(calls[1].data.attrs.tags).toBe('YouTube,AI,Prompt');
  });

  it('applyGroupToBlock 调用思源块接口为普通块追加 #tag# 文本', async () => {
    const calls: Array<{ url: string; data: any }> = [];
    const mockRequest = async (url: string, data: any) => {
      calls.push({ url, data });
      if (url === '/api/block/getBlockKramdown') {
        return { code: 0, data: { kramdown: '这是一段段落正文' } };
      }
      if (url === '/api/block/updateBlock') {
        return { code: 0, data: null };
      }
      return { code: 0 };
    };

    const res = await TagGroupService.applyGroupToBlock('block_456', ['Vue', 'Vite'], mockRequest);
    expect(res.success).toBe(true);
    expect(calls.length).toBe(2);
    expect(calls[1].data.data).toBe('这是一段段落正文 #Vue# #Vite#');
  });
});
