import "vitest";

declare module "vitest" {
  interface Matchers<T> {
    toRenderTo(expected: string): Promise<void>;
  }
}
