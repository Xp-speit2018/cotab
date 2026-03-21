import React from "react";
import ReactDOM from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./App";
import "./i18n";
import "../index.css";

// Expose internals for E2E tests (dev/test builds only)
if (import.meta.env.DEV) {
  Promise.all([
    import("./stores/editor-store"),
    import("./core/engine"),
    import("./stores/render-store"),
    import("./stores/snap-grid"),
    import("./stores/render-api"),
  ]).then(([storeMod, engineMod, renderStoreMod, snapGridMod, renderApiMod]) => {
    (window as unknown as Record<string, unknown>).__COTAB_TAB_STORE__ = storeMod.useEditorStore;
    (window as unknown as Record<string, unknown>).__COTAB_STORE__ = engineMod;
    (window as unknown as Record<string, unknown>).__COTAB_RENDER_STORE__ = renderStoreMod;
    (window as unknown as Record<string, unknown>).__COTAB_SNAP_GRID__ = snapGridMod;
    (window as unknown as Record<string, unknown>).__COTAB_RENDER_API__ = renderApiMod;
  });
  import("./core/converters").then((mod) => {
    (window as unknown as Record<string, unknown>).__COTAB_SYNC__ = mod;
  });
  import("./core/schema").then((mod) => {
    (window as unknown as Record<string, unknown>).__COTAB_SCHEMA__ = mod;
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </React.StrictMode>,
);
