/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_ENVIRONMENT: 'dev' | 'prod'
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }