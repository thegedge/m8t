import { styleText } from "node:util";
import type { Site } from "../../Site.js";
import { printLogoAndTitleWithLines } from "../tui/logo.js";

export const run = async (_site: Site, _args: Record<string, unknown>, _signal: AbortSignal): Promise<number> => {
  console.log();
  printLogoAndTitleWithLines(process.stdout, [
    `${styleText("bold", "Available commands")}:`,
    "",
    `  ${styleText(["bold", "blue"], "build")}          Build the website for production`,
    `  ${styleText(["bold", "blue"], "serve")}          Run a local dev server with live reloading`,
    `  ${styleText(["bold", "blue"], "validate")}       Validate the output of the site`,
    "",
    `${styleText("bold", "Global flags")}:`,
    "",
    `  ${styleText(["bold", "blue"], "-C, --directory")}`,
    `      The directory to run the command in ${styleText("dim", `(default: ".")`)}`,
  ]);
  console.log();

  return 0;
};
