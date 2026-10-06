import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ConfigError } from "../../src/errors/ConfigError.js";
import { LoadError } from "../../src/errors/LoadError.js";

describe("M8tError", () => {
  beforeEach(() => {
    vi.stubEnv("NO_COLOR", "1");
    vi.stubEnv("FORCE_COLOR", undefined); // takes precedence over NO_COLOR, so must be unset
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("format", () => {
    test("shows the name, message and hint", () => {
      const error = new ConfigError("site.ts must export site options", {
        hint: "export an object",
      });

      expect(error.format({ verbose: false }).split("\n")).toEqual([
        "ConfigError: site.ts must export site options",
        "  export an object",
      ]);
    });

    test("omits the hint line when there is no hint", () => {
      const error = new ConfigError("bad config");

      expect(error.format({ verbose: false })).toBe("ConfigError: bad config");
    });

    test("shows the chain of causes", () => {
      const error = new LoadError("outer", {
        cause: new Error("middle", { cause: "innermost" }),
      });

      expect(error.format({ verbose: false }).split("\n")).toEqual([
        "LoadError: outer",
        "  Caused by: Error: middle",
        "    Caused by: innermost",
      ]);
    });

    test("shows the chain of causes to the given depth", () => {
      const error = new LoadError("outer", {
        cause: new Error("middle", { cause: "innermost" }),
      });

      expect(error.format({ verbose: false, maxCauseDepth: 1 }).split("\n")).toEqual([
        "LoadError: outer",
        "  Caused by: Error: middle",
      ]);
    });

    test("omits stack traces unless verbose", () => {
      const error = new ConfigError("bad");

      expect(error.format({ verbose: false })).not.toMatch(/^\s+at /m);
    });

    test("includes stack frames, without the message line, when verbose", () => {
      const error = new ConfigError("bad config", { cause: new Error("inner") });
      const lines = error.format({ verbose: true }).split("\n");

      expect(lines[0]).toBe("ConfigError: bad config");
      expect(lines.filter((line) => line.includes("bad config"))).toHaveLength(1);
      expect(lines[1]).toMatch(/^ {4}at /);

      const causeIndex = lines.indexOf("  Caused by: Error: inner");
      expect(causeIndex).toBeGreaterThan(1);
      expect(lines[causeIndex + 1]).toMatch(/^ {6}at /);
    });
  });
});
