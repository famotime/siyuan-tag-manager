<template>
  <div v-if="state.visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card tm-style-modal-card">
      <div class="tm-modal-title">
        <SyLineIcon name="palette" :size="16" />
        <span>设置标签样式与别名</span>
      </div>

      <div class="tm-modal-body">
        <p class="tm-modal-target">正在定制标签：<b>#{{ state.label }}#</b></p>

        <!-- 1. 实时效果对比 (Live Preview) -->
        <div class="tm-preview-section">
          <div class="tm-preview-header">
            <span>实时效果对比 (Live Preview)：</span>
          </div>
          <div class="tm-preview-cards">
            <!-- 亮色模式预览 -->
            <div class="tm-preview-box tm-preview-box--light">
              <span class="tm-preview-label">☀️ Light 亮色</span>
              <div class="tm-preview-capsule-wrap">
                <span class="tm-preview-capsule" :style="lightPreviewStyle">
                  {{ state.icon ? state.icon + ' ' : '' }}{{ state.label || '标签' }}
                </span>
              </div>
            </div>
            <!-- 暗黑模式预览 -->
            <div class="tm-preview-box tm-preview-box--dark">
              <span class="tm-preview-label">🌙 Dark 暗黑</span>
              <div class="tm-preview-capsule-wrap">
                <span class="tm-preview-capsule" :style="darkPreviewStyle">
                  {{ state.icon ? state.icon + ' ' : '' }}{{ state.label || '标签' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. 双主题预设与自定义主题 -->
        <div class="tm-form-group">
          <div class="tm-section-label-row">
            <label>预设双主题自适应色彩 (Light / Dark 智能对偶)：</label>
            <button
              v-if="!showCreatePreset"
              type="button"
              class="b3-button b3-button--text tm-btn-add-preset"
              title="将当前配色保存为新预设主题"
              @click="openCreatePreset"
            >
              <SyLineIcon name="plus" :size="12" />
              <span>保存当前为新预设</span>
            </button>
          </div>

          <!-- 保存为新预设内联栏 -->
          <div v-if="showCreatePreset" class="tm-create-preset-bar">
            <input
              v-model="newPresetName"
              class="b3-text-field fn__flex-1"
              placeholder="输入新预设主题名称 (如：高优待办)"
              @keydown.enter="confirmCreatePreset"
            />
            <button class="b3-button b3-button--primary b3-button--small" @click="confirmCreatePreset">保存</button>
            <button class="b3-button b3-button--cancel b3-button--small" @click="showCreatePreset = false">取消</button>
          </div>

          <div class="tm-color-palette-grid">
            <div
              v-for="preset in allPresets"
              :key="preset.id"
              class="tm-preset-card"
              :class="{ 'is-selected': state.presetId === preset.id, 'is-custom': preset.isCustom }"
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
              <button
                v-if="preset.isCustom"
                type="button"
                class="tm-preset-delete-btn"
                title="删除此自定义主题"
                @click.stop="handleRemovePreset(preset.id)"
              >
                <SyLineIcon name="close" :size="10" />
              </button>
            </div>
          </div>
        </div>

        <!-- 3. 背景颜色与文字颜色可视化选取 -->
        <div class="tm-form-row">
          <!-- 背景色选取 -->
          <div class="tm-form-group fn__flex-1">
            <label>背景颜色 (Hex):</label>
            <div class="tm-color-picker-input-wrap">
              <label class="tm-color-picker-label" title="点击调起系统拾色器">
                <input
                  type="color"
                  class="tm-color-input-native"
                  :value="ensureHex6(state.backgroundColor, '#EBF3FE')"
                  @input="onNativeBgColorChange"
                />
                <span class="tm-color-swatch-circle" :style="{ backgroundColor: state.backgroundColor || '#EBF3FE' }"></span>
              </label>
              <input
                v-model="state.backgroundColor"
                class="b3-text-field fn__flex-1 tm-color-hex-input"
                placeholder="#EBF3FE"
                @change="onManualColorChange"
              />
            </div>
            <!-- 推荐底色快捷小圆点 -->
            <div class="tm-fast-colors-row">
              <span
                v-for="c in RECOMMENDED_BG_COLORS"
                :key="c"
                class="tm-fast-color-dot"
                :style="{ backgroundColor: c }"
                :title="`套用底色 ${c}`"
                @click="pickBgColor(c)"
              ></span>
            </div>
          </div>

          <!-- 文字色选取 -->
          <div class="tm-form-group fn__flex-1" style="margin-left: 12px;">
            <label>文字颜色 (Hex):</label>
            <div class="tm-color-picker-input-wrap">
              <label class="tm-color-picker-label" title="点击调起系统拾色器">
                <input
                  type="color"
                  class="tm-color-input-native"
                  :value="ensureHex6(state.textColor, '#1A56DB')"
                  @input="onNativeTextColorChange"
                />
                <span class="tm-color-swatch-circle" :style="{ backgroundColor: state.textColor || '#1A56DB' }"></span>
              </label>
              <input
                v-model="state.textColor"
                class="b3-text-field fn__flex-1 tm-color-hex-input"
                placeholder="#1A56DB"
                @change="onManualColorChange"
              />
            </div>
            <!-- 推荐字色快捷小圆点 -->
            <div class="tm-fast-colors-row">
              <span
                v-for="c in RECOMMENDED_TEXT_COLORS"
                :key="c"
                class="tm-fast-color-dot"
                :style="{ backgroundColor: c }"
                :title="`套用字色 ${c}`"
                @click="pickTextColor(c)"
              ></span>
            </div>
          </div>
        </div>

        <!-- 4. 自定义 Emoji / 符号前缀与预置候选项 -->
        <div class="tm-form-group">
          <div class="tm-section-label-row">
            <label>自定义 Emoji / 符号前缀：</label>
            <button
              v-if="state.icon"
              type="button"
              class="b3-button b3-button--text tm-btn-clear-emoji"
              title="清空已配置的图标"
              @click="state.icon = ''"
            >
              清空图标
            </button>
          </div>
          <div class="tm-emoji-input-wrap">
            <input
              v-model="state.icon"
              class="b3-text-field fn__block"
              placeholder="点击下方候选项或手动输入，例如：🎬, 💡, 🚀, 💻"
            />
          </div>

          <!-- Emoji 分类标签与候选网格 -->
          <div class="tm-emoji-picker-container">
            <div class="tm-emoji-tabs">
              <button
                v-for="cat in EMOJI_CATEGORIES"
                :key="cat.id"
                type="button"
                class="tm-emoji-tab-btn"
                :class="{ 'is-active': activeEmojiCat === cat.id }"
                @click="activeEmojiCat = cat.id"
              >
                <span>{{ cat.icon }}</span>
                <span>{{ cat.name }}</span>
              </button>
            </div>
            <div class="tm-emoji-grid">
              <button
                v-for="emoji in currentEmojis"
                :key="emoji"
                type="button"
                class="tm-emoji-grid-item"
                :class="{ 'is-selected': state.icon === emoji }"
                :title="`使用 ${emoji}`"
                @click="selectEmoji(emoji)"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
        </div>

        <!-- 5. 别名列表 -->
        <div class="tm-form-group">
          <label>别名列表（逗号分隔，支持拼音首字母如 ytb 检索）：</label>
          <input v-model="state.aliasesText" class="b3-text-field fn__block" placeholder="例如：油管, 视频平台" />
        </div>
      </div>

      <div class="tm-modal-footer">
        <button
          type="button"
          class="b3-button b3-button--cancel tm-button--reset"
          title="将设置的标签主题还原为最初状态（不清空符号前缀和别名列表）"
          @click="resetTheme"
        >
          重置
        </button>
        <div class="fn__flex-1"></div>
        <button class="b3-button b3-button--cancel" @click="emit('close')">取消</button>
        <button class="b3-button b3-button--primary" @click="emit('save')">保存并即时生效</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';
import {
  DUAL_THEME_COLOR_PRESETS,
  RECOMMENDED_BG_COLORS,
  RECOMMENDED_TEXT_COLORS,
  EMOJI_CATEGORIES,
  type IColorPreset,
} from '../../styles/palette';
import { TagVisualService } from '../../services/TagVisualService';
import type { IStyleModalState } from '../../types/ui';

const props = withDefaults(
  defineProps<{
    state: IStyleModalState;
    customPresets?: IColorPreset[];
  }>(),
  {
    customPresets: () => [],
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save'): void;
  (e: 'reset'): void;
  (e: 'save-preset', preset: IColorPreset): void;
  (e: 'remove-preset', presetId: string): void;
}>();

// 1. 全部可用预设列表（官方预设 + 用户自定义预设）
const allPresets = computed<IColorPreset[]>(() => {
  return [...DUAL_THEME_COLOR_PRESETS, ...(props.customPresets || [])];
});

// 2. 自定义预设创建状态
const showCreatePreset = ref(false);
const newPresetName = ref('');

function openCreatePreset() {
  newPresetName.value = '';
  showCreatePreset.value = true;
}

function confirmCreatePreset() {
  const name = newPresetName.value.trim();
  if (!name) return;

  const bg = props.state.backgroundColor || '#EBF3FE';
  const text = props.state.textColor || '#1A56DB';
  const derived = TagVisualService.deriveDarkModeStyles(bg, text);

  const newPreset: IColorPreset = {
    id: `custom-${Date.now()}`,
    name,
    lightBg: bg,
    lightText: text,
    lightBorder: 'rgba(0, 0, 0, 0.1)',
    darkBg: props.state.darkBackgroundColor || derived.darkBg,
    darkText: props.state.darkTextColor || derived.darkText,
    darkBorder: 'rgba(255, 255, 255, 0.15)',
    isCustom: true,
  };

  emit('save-preset', newPreset);
  props.state.presetId = newPreset.id;
  showCreatePreset.value = false;
}

function handleRemovePreset(presetId: string) {
  if (props.state.presetId === presetId) {
    props.state.presetId = '';
  }
  emit('remove-preset', presetId);
}

// 3. 颜色工具与双主题推导
function ensureHex6(val?: string, fallback = '#000000'): string {
  if (!val) return fallback;
  const clean = val.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean;
  if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
    return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  }
  return fallback;
}

function syncDarkStyles() {
  if (props.state.backgroundColor && props.state.textColor) {
    const derived = TagVisualService.deriveDarkModeStyles(props.state.backgroundColor, props.state.textColor);
    props.state.darkBackgroundColor = derived.darkBg;
    props.state.darkTextColor = derived.darkText;
  }
}

function applyDualThemePreset(preset: IColorPreset) {
  props.state.presetId = preset.id;
  props.state.backgroundColor = preset.lightBg;
  props.state.textColor = preset.lightText;
  props.state.darkBackgroundColor = preset.darkBg;
  props.state.darkTextColor = preset.darkText;
}

function onNativeBgColorChange(event: Event) {
  const target = event.target as HTMLInputElement;
  props.state.backgroundColor = target.value;
  props.state.presetId = '';
  syncDarkStyles();
}

function onNativeTextColorChange(event: Event) {
  const target = event.target as HTMLInputElement;
  props.state.textColor = target.value;
  props.state.presetId = '';
  syncDarkStyles();
}

function pickBgColor(hex: string) {
  props.state.backgroundColor = hex;
  props.state.presetId = '';
  syncDarkStyles();
}

function pickTextColor(hex: string) {
  props.state.textColor = hex;
  props.state.presetId = '';
  syncDarkStyles();
}

function onManualColorChange() {
  props.state.presetId = '';
  syncDarkStyles();
}

// 4. Emoji 候选分类与选择
const activeEmojiCat = ref('status');

const currentEmojis = computed(() => {
  const category = EMOJI_CATEGORIES.find(c => c.id === activeEmojiCat.value);
  return category ? category.emojis : EMOJI_CATEGORIES[0].emojis;
});

function selectEmoji(emoji: string) {
  props.state.icon = emoji;
}

// 5. 实时效果对比样式
const lightPreviewStyle = computed(() => {
  const bg = props.state.backgroundColor || 'var(--b3-theme-surface-lighter, #f1f3f5)';
  const color = props.state.textColor || 'var(--b3-theme-on-surface, #333333)';
  return {
    backgroundColor: bg,
    color: color,
  };
});

const darkPreviewStyle = computed(() => {
  let bg = props.state.darkBackgroundColor;
  let color = props.state.darkTextColor;

  if (!bg && props.state.backgroundColor && props.state.textColor) {
    const derived = TagVisualService.deriveDarkModeStyles(props.state.backgroundColor, props.state.textColor);
    bg = derived.darkBg;
    color = derived.darkText;
  }

  return {
    backgroundColor: bg || 'rgba(255, 255, 255, 0.12)',
    color: color || '#e2e8f0',
  };
});

// 6. 重置逻辑 (保留符号前缀和别名)
function resetTheme() {
  props.state.presetId = '';
  props.state.backgroundColor = '';
  props.state.textColor = '';
  props.state.darkBackgroundColor = '';
  props.state.darkTextColor = '';
  emit('reset');
}

defineExpose({
  resetTheme,
  applyDualThemePreset,
});
</script>
