declare module "process" {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        PUBLISH?: string;
        SITE_ROOT?: string;
        PROFILE?: string;
      }
    }
  }
}
