/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RAINDROP_CLIENT_ID?: string;
  readonly VITE_RAINDROP_CLIENT_SECRET?: string;
  readonly VITE_RAINDROP_TEST_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*?worker" {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module "*.json" {
  const value: unknown;
  export default value;
}
