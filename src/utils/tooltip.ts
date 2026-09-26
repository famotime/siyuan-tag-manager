import type { Directive, DirectiveBinding } from 'vue';

let tooltipEl: HTMLDivElement | null = null;
let showTimer: any = null;
let hideTimer: any = null;
let currentTarget: HTMLElement | null = null;

function ensureTooltipElement(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tm-tooltip-bubble';
    tooltipEl.style.position = 'fixed';
    tooltipEl.style.zIndex = '999999';
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.opacity = '0';
    tooltipEl.style.transform = 'scale(0.96)';
    tooltipEl.style.transition = 'opacity 0.12s cubic-bezier(0.16, 1, 0.3, 1), transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)';
    tooltipEl.style.padding = '4px 8px';
    tooltipEl.style.fontSize = '11px';
    tooltipEl.style.lineHeight = '14px';
    tooltipEl.style.borderRadius = '4px';
    tooltipEl.style.whiteSpace = 'nowrap';
    tooltipEl.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.25)';
    tooltipEl.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    tooltipEl.style.backgroundColor = 'rgba(24, 27, 34, 0.92)';
    tooltipEl.style.color = '#ffffff';
    tooltipEl.style.backdropFilter = 'blur(6px)';
    tooltipEl.style.fontWeight = '500';
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function showTooltip(el: HTMLElement, text: string) {
  if (!text) return;
  const bubble = ensureTooltipElement();
  bubble.textContent = text;

  const rect = el.getBoundingClientRect();
  const bubbleRect = bubble.getBoundingClientRect();

  // 计算理想位置：元素上方居中
  let top = rect.top - bubbleRect.height - 6;
  let left = rect.left + (rect.width - bubbleRect.width) / 2;

  // 边界保护：若上方空间不足，则翻转至下方
  if (top < 10) {
    top = rect.bottom + 6;
  }
  // 左侧防溢出
  if (left < 8) {
    left = 8;
  }
  // 右侧防溢出
  const viewportWidth = window.innerWidth;
  if (left + bubbleRect.width > viewportWidth - 8) {
    left = viewportWidth - bubbleRect.width - 8;
  }

  bubble.style.top = `${top}px`;
  bubble.style.left = `${left}px`;
  bubble.style.opacity = '1';
  bubble.style.transform = 'scale(1)';
}

function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.style.opacity = '0';
    tooltipEl.style.transform = 'scale(0.96)';
  }
  currentTarget = null;
}

export const vTooltip: Directive<HTMLElement, string | undefined> = {
  mounted(el, binding) {
    el.setAttribute('data-tm-tooltip', binding.value || '');

    const onMouseEnter = () => {
      const text = el.getAttribute('data-tm-tooltip');
      if (!text) return;
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      currentTarget = el;
      // 150ms 延迟淡入，即时但避免鼠标快速掠过时误触发
      showTimer = setTimeout(() => {
        if (currentTarget === el) {
          showTooltip(el, text);
        }
      }, 150);
    };

    const onMouseLeave = () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      if (currentTarget === el) {
        // 80ms 快速消失
        hideTimer = setTimeout(() => {
          hideTooltip();
        }, 80);
      }
    };

    (el as any)._tmTooltipEnter = onMouseEnter;
    (el as any)._tmTooltipLeave = onMouseLeave;

    el.addEventListener('mouseenter', onMouseEnter);
    el.addEventListener('mouseleave', onMouseLeave);
  },
  updated(el, binding) {
    el.setAttribute('data-tm-tooltip', binding.value || '');
    if (currentTarget === el && tooltipEl && tooltipEl.style.opacity === '1') {
      tooltipEl.textContent = binding.value || '';
    }
  },
  unmounted(el) {
    if ((el as any)._tmTooltipEnter) {
      el.removeEventListener('mouseenter', (el as any)._tmTooltipEnter);
    }
    if ((el as any)._tmTooltipLeave) {
      el.removeEventListener('mouseleave', (el as any)._tmTooltipLeave);
    }
    if (currentTarget === el) {
      hideTooltip();
    }
  },
};
