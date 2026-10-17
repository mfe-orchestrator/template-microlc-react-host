/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MFE_BACKEND_URL: string
  readonly VITE_MFE_PROJECT_ID: string
  /** Optional: omit it and the backend resolves the environment from the domain. */
  readonly VITE_MFE_ENVIRONMENT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// The slice of micro-lc's element this host uses. micro-lc's own typings cannot be
// resolved with bundler resolution (see tsconfig.json), so it is declared here.
interface HTMLElementTagNameMap {
  'micro-lc': HTMLElement & {
    config: import('@micro-lc/interfaces/v2').Config
    getApi(): { router: { goToApplication(id: string): Promise<void> } }
  }
}
