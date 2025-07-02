/** @type {import("prettier").Config} */
const config = {
  overrides: [
    {
      files: "**/*.{ts,tsx}",
      options: {
        parser: "typescript",
      },
    },
  ],
  plugins: ["prettier-plugin-organize-imports", "prettier-plugin-packagejson"],
  printWidth: 120,
  proseWrap: "always",
  semi: true,
  tabWidth: 2,
  trailingComma: "all",
  useTabs: false,
};

export default config;
