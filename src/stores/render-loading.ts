export const RENDER_LOADING_DELAY_MS = 250;
export const RENDER_LOADING_MIN_VISIBLE_MS = 250;

export interface RenderLoadingState {
  isRendering: boolean;
  showLoadingOverlay: boolean;
}

interface RenderLoadingControllerOptions {
  publish: (state: Partial<RenderLoadingState>) => void;
  delayMs?: number;
  minVisibleMs?: number;
  now?: () => number;
}

export interface RenderLoadingController {
  start(): void;
  finish(): void;
  dispose(): void;
}

export function createRenderLoadingController({
  publish,
  delayMs = RENDER_LOADING_DELAY_MS,
  minVisibleMs = RENDER_LOADING_MIN_VISIBLE_MS,
  now = Date.now,
}: RenderLoadingControllerOptions): RenderLoadingController {
  let active = false;
  let visible = false;
  let visibleSince = 0;
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const clearShowTimer = () => {
    if (showTimer === null) return;
    clearTimeout(showTimer);
    showTimer = null;
  };
  const clearHideTimer = () => {
    if (hideTimer === null) return;
    clearTimeout(hideTimer);
    hideTimer = null;
  };
  const hide = () => {
    hideTimer = null;
    if (active || !visible) return;
    visible = false;
    publish({ showLoadingOverlay: false });
  };

  return {
    start() {
      if (active) return;
      active = true;
      clearHideTimer();
      publish({ isRendering: true });
      if (visible || showTimer !== null) return;
      showTimer = setTimeout(() => {
        showTimer = null;
        if (!active || visible) return;
        visible = true;
        visibleSince = now();
        publish({ showLoadingOverlay: true });
      }, delayMs);
    },

    finish() {
      if (!active && showTimer === null && !visible) return;
      active = false;
      clearShowTimer();
      publish({ isRendering: false });
      if (!visible) return;

      const remaining = minVisibleMs - (now() - visibleSince);
      if (remaining <= 0) {
        hide();
        return;
      }
      clearHideTimer();
      hideTimer = setTimeout(hide, remaining);
    },

    dispose() {
      active = false;
      clearShowTimer();
      clearHideTimer();
      visible = false;
      publish({ isRendering: false, showLoadingOverlay: false });
    },
  };
}
