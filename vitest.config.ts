import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "dist/**"],
    execArgv: ["--experimental-vm-modules"],
    setupFiles: ["test/matchers.ts"],

    // page_defaults.test.ts has some longer ones
    taskTitleValueFormatTruncate: 60,
  },
});
