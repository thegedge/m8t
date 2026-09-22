import "vitest";

declare module "vitest" {
  interface Matchers<T> {
    toRenderTo(expected: string): Promise<void>;
    toBeInRange(expected: T, range: T): Promise<void>;
  }

  interface CustomMatchers<R = unknown> {
    toMatchPath: (path: string) => R;
  }

  interface Assertion<T = any> extends CustomMatchers<T> {}
}
