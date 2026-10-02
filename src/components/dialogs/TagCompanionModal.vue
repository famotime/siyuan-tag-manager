<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { ITagCompanionConfig } from '../../types/companion';
import { DEFAULT_COMPANION_CONFIG } from '../../types/companion';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';

interface Props {
  visible: boolean;
  config: ITagCompanionConfig;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', config: ITagCompanionConfig): void;
}>();

const form = reactive<ITagCompanionConfig>({
  ...DEFAULT_COMPANION_CONFIG,
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
  emit('save', { ...form });
}

function handleReset() {
  Object.assign(form, DEFAULT_COMPANION_CONFIG);
}
</script>

<template>
  <div v-if="visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card" style="width: 480px; max-width: 95vw;">
      <div class="tm-modal-title">
        <SyLineIcon name="sparkles" :size="16" />
        <span>伴生标签智能推荐设置</span>
      </div>

      <div class="tm-modal-body">
        <!-- 功能总开关 -->
        <div class="tm-form-group">
          <div class="tm-setting-row">
            <div>
              <div class="tm-setting-title">启用伴生标签智能推荐</div>
              <div class="tm-setting-desc">在编辑器输入标签或聚焦标签时，自动显示高频伴生标签浮条</div>
            </div>
            <label class="b3-switch">
              <input v-model="form.enabled" type="checkbox" />
            </label>
          </div>
        </div>

        <template v-if="form.enabled">
          <!-- 触发模式 -->
          <div class="tm-form-group">
            <label>触发模式：</label>
            <div class="tm-radio-group">
              <label class="tm-radio-label">
                <input
                  v-model="form.triggerMode"
                  type="radio"
                  value="dual"
                />
                <span>双重触发 (输入闭合 # 即时弹出 + 光标移入停留 300ms)</span>
              </label>
              <label class="tm-radio-label">
                <input
                  v-model="form.triggerMode"
                  type="radio"
                  value="input_only"
                />
                <span>仅输入态触发 (仅在输入完闭合 # 时弹出，日常光标移动不打扰)</span>
              </label>
            </div>
          </div>

          <!-- 推荐数量上限 -->
          <div class="tm-form-group">
            <div class="tm-setting-inline">
              <label>推荐数量上限：</label>
              <select v-model.number="form.maxCount" class="b3-select">
                <option :value="3">3 条 (精炼)</option>
                <option :value="4">4 条 (推荐)</option>
                <option :value="5">5 条 (充裕)</option>
                <option :value="6">6 条</option>
                <option :value="8">8 条 (最多)</option>
              </select>
            </div>
            <div class="tm-section-hint">浮条最多同时展示的伴生标签候选胶囊数量。</div>
          </div>

          <!-- 相似度过滤阈值 -->
          <div class="tm-form-group">
            <div class="tm-setting-inline">
              <label>最小亲密相似度 (Jaccard)：</label>
              <select v-model.number="form.minSimilarity" class="b3-select">
                <option :value="0.1">10% (包含弱相关)</option>
                <option :value="0.15">15% (推荐平衡)</option>
                <option :value="0.2">20% (适度精准)</option>
                <option :value="0.3">30% (高频强关联)</option>
                <option :value="0.4">40% (极高亲密度)</option>
              </select>
            </div>
            <div class="tm-section-hint">过滤偶发共现的弱连接噪音，仅推荐亲密相似度高于该阈值的标签。</div>
          </div>

          <!-- 光标防抖停留时间 (仅双重模式有效) -->
          <div v-if="form.triggerMode === 'dual'" class="tm-form-group">
            <div class="tm-setting-inline">
              <label>光标停留防抖时间：</label>
              <select v-model.number="form.hoverDelayMs" class="b3-select">
                <option :value="200">200 ms (敏捷)</option>
                <option :value="300">300 ms (推荐平衡)</option>
                <option :value="500">500 ms (平稳沉浸)</option>
                <option :value="800">800 ms (深度静止)</option>
              </select>
            </div>
            <div class="tm-section-hint">光标移入包含已有标签的段落块时，静止等待多久触发推荐。</div>
          </div>
        </template>
      </div>

      <div class="tm-modal-footer">
        <button class="b3-button b3-button--text" @click="handleReset">
          恢复默认
        </button>
        <div class="fn__flex-1" />
        <button class="b3-button b3-button--cancel" @click="emit('close')">
          取消
        </button>
        <button class="b3-button b3-button--text" style="margin-left: 8px;" @click="handleSave">
          保存配置
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tm-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}

.tm-setting-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.tm-setting-desc {
  font-size: 11.5px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  margin-top: 2px;
}

.tm-setting-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  label {
    font-weight: 500;
    font-size: 12.5px;
  }
}

.tm-radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
}

.tm-radio-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.4;

  input[type='radio'] {
    margin-top: 2px;
  }
}
</style>
