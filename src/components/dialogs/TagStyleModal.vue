<template>
  <div v-if="state.visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card">
      <div class="tm-modal-title">
        <SyLineIcon name="palette" :size="16" />
        <span>设置标签样式与别名</span>
      </div>
      <div class="tm-modal-body">
        <p class="tm-modal-target">正在定制标签：<b>#{{ state.label }}#</b></p>

        <!-- 8 组精调双主题自适应色盘预设 -->
        <div class="tm-form-group">
          <label>预设双主题自适应色彩 (Light / Dark 智能对偶)：</label>
          <div class="tm-color-palette-grid">
            <div
              v-for="preset in DUAL_THEME_COLOR_PRESETS"
              :key="preset.id"
              class="tm-preset-card"
              :class="{ 'is-selected': state.presetId === preset.id }"
              @click="applyDualThemePreset(preset)"
            >
              <div class="tm-preset-preview">
                <span
                  class="tm-preset-chip light-chip"
                  :style="{ backgroundColor: preset.lightBg, color: preset.lightText, borderColor: preset.lightBorder }"
                >
                  Aa
                </span>
                <span
                  class="tm-preset-chip dark-chip"
                  :style="{ backgroundColor: preset.darkBg, color: preset.darkText, borderColor: preset.darkBorder }"
                >
                  Aa
                </span>
              </div>
              <span class="tm-preset-name">{{ preset.name }}</span>
            </div>
          </div>
        </div>

        <div class="tm-form-row">
          <div class="tm-form-group fn__flex-1">
            <label>背景颜色 (Hex):</label>
            <input v-model="state.backgroundColor" class="b3-text-field fn__block" placeholder="#EBF3FE" />
          </div>
          <div class="tm-form-group fn__flex-1" style="margin-left: 8px;">
            <label>文字颜色 (Hex):</label>
            <input v-model="state.textColor" class="b3-text-field fn__block" placeholder="#1A56DB" />
          </div>
        </div>
        <div class="tm-form-group">
          <label>自定义 Emoji / 符号前缀：</label>
          <input v-model="state.icon" class="b3-text-field fn__block" placeholder="例如：🎬, 💡, 🚀, 💻" />
        </div>
        <div class="tm-form-group">
          <label>别名列表（逗号分隔，支持拼音首字母如 ytb 检索）：</label>
          <input v-model="state.aliasesText" class="b3-text-field fn__block" placeholder="例如：油管, 视频平台" />
        </div>
      </div>
      <div class="tm-modal-footer">
        <button class="b3-button b3-button--cancel" @click="emit('close')">取消</button>
        <button class="b3-button b3-button--primary" @click="emit('save')">保存并即时生效</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';
import { DUAL_THEME_COLOR_PRESETS, type IColorPreset } from '../../styles/palette';
import type { IStyleModalState } from '../../types/ui';

const props = defineProps<{
  state: IStyleModalState;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save'): void;
}>();

function applyDualThemePreset(preset: IColorPreset) {
  props.state.presetId = preset.id;
  props.state.backgroundColor = preset.lightBg;
  props.state.textColor = preset.lightText;
  props.state.darkBackgroundColor = preset.darkBg;
  props.state.darkTextColor = preset.darkText;
}
</script>
