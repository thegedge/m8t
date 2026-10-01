import { describe, expect, test, vi } from "vitest";

import { run } from "../../../src/cli/commands/help.js";

describe("help command", () => {
  test("lists the available commands and the global -C/--directory flag", async () => {
    using write = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    const code = await run("/site", { _: [] }, new AbortController().signal);
    expect(code).toBe(0);

    const output = write.mock.calls.map((call) => call[0]).join("");
    expect(output).toContain("build");
    expect(output).toContain("serve");
    expect(output).toContain("validate");
    expect(output).toContain("-C, --directory");
  });
});
