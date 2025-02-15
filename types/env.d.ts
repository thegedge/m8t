declare module "process" {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        PUBLISH?: string;
        NETLIFY?: string;
      }
    }
  }
}
