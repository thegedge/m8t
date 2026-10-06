import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { formatError } from "../../src/cli/formatError.js";
import { ConfigError } from "../../src/errors/ConfigError.js";
import type { ErrorFormatOptions } from "../../src/errors/formatting.js";
import { M8tError } from "../../src/errors/M8tError.js";

describe("formatError", () => {
  beforeEach(() => {
    vi.stubEnv("NO_COLOR", "1");
    vi.stubEnv("FORCE_COLOR", undefined); // takes precedence over NO_COLOR, so we have to unset
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("uses an M8tError's own format", () => {
    const error = new ConfigError("site.ts must export site options", { hint: "export an object" });

    expect(formatError(error, { verbose: false })).toBe(error.format({ verbose: false }));
  });

  test("uses a subclass's overridden format", () => {
    class CustomError extends M8tError {
      override format({ verbose }: ErrorFormatOptions) {
        return `custom (verbose: ${verbose})`;
      }
    }

    expect(formatError(new CustomError("x"), { verbose: true })).toBe("custom (verbose: true)");
  });

  describe("with an unknown error", () => {
    test("reports it as an unknown error, suggesting --verbose", () => {
      const lines = formatError(new TypeError("boom"), { verbose: false }).split("\n");

      expect(lines[0]).toBe("Unknown error: boom");
      expect(lines[1]).toContain("--verbose");
      expect(lines).toHaveLength(2);
    });

    test.each([
      ["a string", "boom", "Unknown error: boom"],
      ["an object", { code: 1 }, "Unknown error: { code: 1 }"],
    ])("formats %s that was thrown", (_, thrown, expected) => {
      expect(formatError(thrown, { verbose: false }).split("\n")[0]).toBe(expected);
    });

    test("shows its cause", () => {
      const error = new Error("outer", { cause: new Error("inner") });

      expect(formatError(error, { verbose: false }).split("\n")).toContain(
        "  Caused by: Error: inner",
      );
    });

    test("includes the stack trace when verbose", () => {
      const lines = formatError(new TypeError("boom"), { verbose: true }).split("\n");

      expect(lines[0]).toBe("Unknown error: boom");
      expect(lines[1]).not.toContain("--verbose");
      expect(lines.slice(2).every((line) => /^ {4}at /.test(line))).toBe(true);
      expect(lines.length).toBeGreaterThan(2);
    });
  });
});
