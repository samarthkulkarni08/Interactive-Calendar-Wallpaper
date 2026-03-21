import { useEffect } from "react";

type MouseMode = "passthrough" | "interactive";

type Api = {
  setWallpaperMouseMode?: (mode: MouseMode) => void;
};

function isInsideInteractive(el: EventTarget | null): boolean {
  return el instanceof Element && !!el.closest("[data-wallpaper-interactive]");
}

/**
 * Windows: transparent frameless windows capture mouse at the HWND unless we use
 * setIgnoreMouseEvents(true, { forward: true }). We flip to "interactive" when
 * the pointer is over [data-wallpaper-interactive] or the user is using the
 * keyboard inside that subtree.
 *
 * Important: we do NOT drop to passthrough on focusout — native time/date pickers
 * and focus moves blur inputs briefly and would freeze the UI. Passthrough is
 * driven by pointer position + window blur instead.
 */
export function useWallpaperMousePassthrough() {
  useEffect(() => {
    const api = (window as unknown as { api?: Api }).api;
    if (!api?.setWallpaperMouseMode) return;

    let last: MouseMode | null = null;

    function setMode(mode: MouseMode) {
      if (mode === last) return;
      last = mode;
      api.setWallpaperMouseMode!(mode);
    }

    /** Hit-test without rAF — delayed updates lose the first click after passthrough */
    function updateFromPoint(clientX: number, clientY: number) {
      const el = document.elementFromPoint(clientX, clientY);
      const interactive = el?.closest("[data-wallpaper-interactive]");
      setMode(interactive ? "interactive" : "passthrough");
    }

    function onPointerMove(e: PointerEvent) {
      updateFromPoint(e.clientX, e.clientY);
    }

    /**
     * Switch to interactive BEFORE the browser handles mousedown/click so the first
     * click on the calendar (coming from desktop) is not lost.
     */
    function onPointerDownCapture(e: PointerEvent) {
      if (isInsideInteractive(e.target)) {
        setMode("interactive");
      }
    }

    function onWindowLeave() {
      last = null;
      api.setWallpaperMouseMode!("passthrough");
    }

    function onFocusIn(e: FocusEvent) {
      if (isInsideInteractive(e.target)) {
        setMode("interactive");
      }
    }

    function onWindowBlur() {
      setMode("passthrough");
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        setMode("passthrough");
      }
    }

    setMode("passthrough");
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDownCapture, true);
    window.addEventListener("mouseleave", onWindowLeave);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.removeEventListener("mouseleave", onWindowLeave);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      api.setWallpaperMouseMode!("passthrough");
    };
  }, []);
}
