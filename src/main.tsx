import React from "react";
import ReactDOM from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./App";
import "./i18n";
import "./index.css";

// Expose internals for E2E tests (dev/test builds only)
if (import.meta.env.DEV) {
  import("./core/store").then((mod) => {
    (window as unknown as Record<string, unknown>).__COTAB_TAB_STORE__ = mod.useTabStore;
    (window as unknown as Record<string, unknown>).__COTAB_STORE__ = mod;
  });
  import("./core/sync").then((mod) => {
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
