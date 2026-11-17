<template>
  <div v-if="visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card" style="width: 500px; max-width: 95vw;">
      <div class="tm-modal-title">
        <SyLineIcon name="settings" :size="16" />
        <span>标签管家偏好设置</span>
      </div>

      <div class="tm-modal-body">
        <!-- 标签删除行为配置 -->
        <div class="tm-form-group">
          <label style="font-weight: 600; font-size: 13px; margin-bottom: 8px; display: block;">
            非文档级标签删除模式
          </label>
          <div class="tm-section-hint" style="margin-bottom: 10px;">
            设置在删除非文档级正文段落内标签时的默认处理行为（文档级标签将始终从文档属性中安全移除）。
          </div>

          <div class="tm-radio-group">
            <label class="tm-radio-label">
              <input
                v-model="form.mode"
                type="radio"
                value="strip_hash"
              />
              <div>
                <span style="font-weight: 500;">#（仅剥离前后“#”，保持标签文字）</span>
                <span class="tm-section-hint" style="display: block; font-size: 11px;">
                  默认推荐：将正文中的 <code>#待办#</code> 剥离为普通文本 <code>待办</code>，保留原有段落文字。
                </span>
              </div>
            </label>

            <label class="tm-radio-label">
              <input
                v-model="form.mode"
                type="radio"
                value="remove_all"
              />
              <div>
                <span style="font-weight: 500;">#+标签文字（彻底删除标签及其文字）</span>
                <span class="tm-section-hint" style="display: block; font-size: 11px;">
                  思源原生行为：彻底从段落中移除整个标签标记与文本内容。
                </span>
              </div>
            </label>

            <label class="tm-radio-label">
              <input
                v-model="form.mode"
                type="radio"
                value="replace_hash"
              />
              <div>
                <span style="font-weight: 500;">用...替代#（自定义文本替代前后“#”）</span>
                <span class="tm-section-hint" style="display: block; font-size: 11px;">
                  将标签前后的“#”统一替换为您指定的字符或文本，同时完整保留文字内容。
                </span>
              </div>
            </label>
          </div>
        </div>

        <!-- 自定义替换字符输入框 (仅在 replace_hash 模式下启用) -->
        <div class="tm-form-group" style="margin-top: 14px;">
          <div class="tm-setting-inline">
            <label style="font-size: 12px; min-width: 110px;">替代字符/文本：</label>
            <input
              v-model="form.replaceWith"
              type="text"
              class="b3-text-field fn__flex-1"
              :disabled="form.mode !== 'replace_hash'"
              placeholder="例如 *、_ 等，留空则等同于纯删除“#”"
            />
          </div>
          <div class="tm-section-hint">
            当选择【用...替代#】时生效。例如输入 <code>*</code>，正文中的 <code>#紧急#</code> 将被替换为 <code>*紧急*</code>。
          </div>
        </div>
      </div>

      <div class="tm-modal-footer">
        <button class="b3-button b3-button--cancel" @click="handleReset">
          恢复默认
        </button>
        <div class="fn__flex-1" />
        <button class="b3-button b3-button--cancel" @click="emit('close')">
          取消
        </button>
        <button class="b3-button b3-button--text" style="margin-left: 8px;" @click="handleSave">
          保存设置
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { ITagDeleteConfig } from '../../types/tag';
import { DEFAULT_TAG_DELETE_CONFIG } from '../../types/tag';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';

interface Props {
  visible: boolean;
  config: ITagDeleteConfig;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', config: ITagDeleteConfig): void;
}>();

const form = reactive<ITagDeleteConfig>({
  ...DEFAULT_TAG_DELETE_CONFIG,
});

watch(
  () => props.config,
  (newVal) => {
    if (newVal) {
      Object.assign(form, newVal);
    }
  },
  { immediate: true, deep: true },
);

function handleSave() {
  emit('save', {
    mode: form.mode,
    replaceWith: (form.replaceWith || '').trim(),
  });
}

function handleReset() {
  Object.assign(form, DEFAULT_TAG_DELETE_CONFIG);
}
</script>
