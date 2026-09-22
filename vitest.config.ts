import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "dist/**"],
    execArgv: ["--experimental-vm-modules"],
    setupFiles: ["test/matchers.ts"],

    // Default is 5 seconds, but none of these tests need that long
    testTimeout: 1000,

    // page_defaults.test.ts has some longer ones
    taskTitleValueFormatTruncate: 60,
  },
});
