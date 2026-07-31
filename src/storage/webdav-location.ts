import { create } from "zustand";

export interface WebDavConnectionConfig {
  readonly baseUrl: string;
  readonly username: string;
  readonly password: string;
}

export interface WebDavLocation {
  readonly config: WebDavConnectionConfig;
  readonly path: string;
}

interface WebDavLocationRequest {
  readonly operation: "open" | "save";
  readonly suggestedName: string;
  readonly initialConfig: WebDavConnectionConfig;
  readonly resolve: (location: WebDavLocation | null) => void;
}

interface WebDavLocationState {
  readonly request: WebDavLocationRequest | null;
  setRequest(request: WebDavLocationRequest | null): void;
}

interface RememberedWebDavConfig {
  readonly baseUrl: string;
  readonly username: string;
}

const CONFIG_KEY = "cotab:webdav-config-v1";
let activeConfig: WebDavConnectionConfig | null = null;

export const useWebDavLocation = create<WebDavLocationState>((set) => ({
  request: null,
  setRequest: (request) => set({ request }),
}));

function rememberedConfig(): RememberedWebDavConfig {
  if (typeof localStorage === "undefined") {
    return { baseUrl: "", username: "" };
  }
  try {
    const parsed = JSON.parse(
      localStorage.getItem(CONFIG_KEY) ?? "null",
    ) as Partial<RememberedWebDavConfig> | null;
    return {
      baseUrl: typeof parsed?.baseUrl === "string" ? parsed.baseUrl : "",
      username: typeof parsed?.username === "string" ? parsed.username : "",
    };
  } catch {
    return { baseUrl: "", username: "" };
  }
}

export function getActiveWebDavConfig(): WebDavConnectionConfig | null {
  return activeConfig;
}

export function selectWebDavLocation(
  operation: "open" | "save",
  suggestedName = "",
): Promise<WebDavLocation | null> {
  const current = useWebDavLocation.getState().request;
  if (current) current.resolve(null);
  const remembered = rememberedConfig();
  const initialConfig = activeConfig ?? {
    ...remembered,
    password: "",
  };

  return new Promise((resolve) => {
    useWebDavLocation.getState().setRequest({
      operation,
      suggestedName,
      initialConfig,
      resolve,
    });
  });
}

export function finishWebDavLocation(location: WebDavLocation | null): void {
  const request = useWebDavLocation.getState().request;
  if (!request) return;
  useWebDavLocation.getState().setRequest(null);
  if (location) {
    activeConfig = location.config;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CONFIG_KEY, JSON.stringify({
        baseUrl: location.config.baseUrl,
        username: location.config.username,
      }));
    }
  }
  request.resolve(location);
}

export function resetWebDavLocationForTests(): void {
  activeConfig = null;
  const request = useWebDavLocation.getState().request;
  if (request) request.resolve(null);
  useWebDavLocation.getState().setRequest(null);
}
