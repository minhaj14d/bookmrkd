/// <reference types="vite/client" />

declare module "*?worker" {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module "*.json" {
  const value: unknown;
  export default value;
}
