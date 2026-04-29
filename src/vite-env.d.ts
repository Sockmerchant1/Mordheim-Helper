/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ROSTER_API_BASE_URL?: string;
  readonly VITE_ROSTER_STORAGE?: "auto" | "local" | "remote";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
