<template>
  <div
    v-if="state.visible"
    class="tm-row-menu"
    :style="{ top: `${state.top}px`, left: `${state.left}px` }"
    @click.stop
  >
    <div class="tm-row-menu-header">
      <SyLineIcon name="tag" :size="12" />
      <span class="tm-row-menu-title">#{{ state.label }}</span>
    </div>
    <div class="tm-row-menu-item" @click="emitAction('doc')">
      <SyLineIcon name="file-up" :size="13" />
      <span>升格为主题聚合文档</span>
    </div>
    <div class="tm-row-menu-item" @click="emitAction('graph')">
      <SyLineIcon name="git-fork-nodes" :size="13" />
      <span>查看关联洞察与时序</span>
    </div>
    <div class="tm-row-menu-item" @click="emitAction('reparent')">
      <SyLineIcon name="corner-down-right" :size="13" />
      <span>配置子标签与层级...</span>
    </div>
    <div class="tm-row-menu-item" @click="emitAction('merge')">
      <SyLineIcon name="git-merge" :size="13" />
      <span>重构合并到其他标签...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';
import type { IRowMenuState } from '../../types/ui';

const props = defineProps<{
  state: IRowMenuState;
}>();

const emit = defineEmits<{
  (e: 'action', action: 'style' | 'doc' | 'graph' | 'merge' | 'remove' | 'reparent', label: string): void;
  (e: 'close'): void;
}>();

function emitAction(action: 'style' | 'doc' | 'graph' | 'merge' | 'remove' | 'reparent') {
  const label = props.state.label;
  emit('close');
  emit('action', action, label);
}
</script>
