import { create } from "zustand";

export interface WebDavServerProfile {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly username: string;
}

export interface WebDavConnectionConfig extends WebDavServerProfile {
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
  readonly profiles: readonly WebDavServerProfile[];
  readonly request: WebDavLocationRequest | null;
  setProfiles(profiles: readonly WebDavServerProfile[]): void;
  setRequest(request: WebDavLocationRequest | null): void;
}

interface LegacyWebDavConfig {
  readonly baseUrl: string;
  readonly username: string;
}

const PROFILES_KEY = "cotab:webdav-profiles-v1";
const LEGACY_CONFIG_KEY = "cotab:webdav-config-v1";
const runtimePasswords = new Map<string, string>();
let activeConfig: WebDavConnectionConfig | null = null;

export const useWebDavLocation = create<WebDavLocationState>((set) => ({
  profiles: [],
  request: null,
  setProfiles: (profiles) => set({ profiles }),
  setRequest: (request) => set({ request }),
}));

function createProfileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `webdav-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function profileNameFromUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname || "WebDAV";
  } catch {
    return "WebDAV";
  }
}

function isProfile(value: unknown): value is WebDavServerProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<WebDavServerProfile>;
  return typeof profile.id === "string" &&
    typeof profile.name === "string" &&
    typeof profile.baseUrl === "string" &&
    typeof profile.username === "string";
}

function persistProfiles(profiles: readonly WebDavServerProfile[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function loadProfiles(): readonly WebDavServerProfile[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILES_KEY) ?? "null");
    if (Array.isArray(parsed)) return parsed.filter(isProfile);
  } catch {
    // Ignore malformed local preferences and try the legacy format.
  }

  try {
    const legacy = JSON.parse(
      localStorage.getItem(LEGACY_CONFIG_KEY) ?? "null",
    ) as Partial<LegacyWebDavConfig> | null;
    if (typeof legacy?.baseUrl !== "string") return [];
    const profile: WebDavServerProfile = {
      id: createProfileId(),
      name: profileNameFromUrl(legacy.baseUrl),
      baseUrl: legacy.baseUrl,
      username: typeof legacy.username === "string" ? legacy.username : "",
    };
    persistProfiles([profile]);
    localStorage.removeItem(LEGACY_CONFIG_KEY);
    return [profile];
  } catch {
    return [];
  }
}

function connectionForProfile(
  profile: WebDavServerProfile,
): WebDavConnectionConfig {
  return {
    ...profile,
    password: runtimePasswords.get(profile.id) ?? "",
  };
}

export function createWebDavConnection(): WebDavConnectionConfig {
  return {
    id: createProfileId(),
    name: "",
    baseUrl: "",
    username: "",
    password: "",
  };
}

export function getWebDavConnection(
  profileId: string,
): WebDavConnectionConfig | null {
  const profile = useWebDavLocation.getState().profiles.find(
    (candidate) => candidate.id === profileId,
  );
  return profile ? connectionForProfile(profile) : null;
}

export function removeWebDavProfile(profileId: string): void {
  const profiles = useWebDavLocation.getState().profiles.filter(
    (profile) => profile.id !== profileId,
  );
  runtimePasswords.delete(profileId);
  persistProfiles(profiles);
  useWebDavLocation.getState().setProfiles(profiles);
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

  const profiles = loadProfiles();
  useWebDavLocation.getState().setProfiles(profiles);
  const initialConfig = activeConfig && profiles.some(
    ({ id }) => id === activeConfig?.id,
  ) ? activeConfig :
    (profiles[0] ? connectionForProfile(profiles[0]) : createWebDavConnection());

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
    runtimePasswords.set(location.config.id, location.config.password);
    const profile: WebDavServerProfile = {
      id: location.config.id,
      name: location.config.name,
      baseUrl: location.config.baseUrl,
      username: location.config.username,
    };
    const profiles = useWebDavLocation.getState().profiles;
    const existingIndex = profiles.findIndex(({ id }) => id === profile.id);
    const nextProfiles = existingIndex < 0
      ? [...profiles, profile]
      : profiles.map((existing) => existing.id === profile.id ? profile : existing);
    persistProfiles(nextProfiles);
    useWebDavLocation.getState().setProfiles(nextProfiles);
  }
  request.resolve(location);
}

export function resetWebDavLocationForTests(): void {
  activeConfig = null;
  runtimePasswords.clear();
  const request = useWebDavLocation.getState().request;
  if (request) request.resolve(null);
  useWebDavLocation.setState({ profiles: [], request: null });
}
