import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "dist/**"],
    execArgv: ["--experimental-vm-modules"],
    setupFiles: ["test/matchers.ts"],
  },
});
