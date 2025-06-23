import chalk from "chalk";
import type { Site } from "../../Site.js";
import { printLogoAndTitleWithLines } from "../logo.js";

export const run = async (_site: Site, _args: Record<string, unknown>): Promise<void> => {
  console.log();
  printLogoAndTitleWithLines(process.stdout, [
    `${chalk.bold("Available commands")}:`,
    "",
    `  ${chalk.bold.blue("build")}          Build the website for production`,
    `  ${chalk.bold.blue("serve")}          Run a local dev server with live reloading`,
    `  ${chalk.bold.blue("validate")}       Validate the output of the site`,
    "",
    `${chalk.bold("Global flags")}:`,
    "",
    `  ${chalk.bold.blue("-C, --directory")}`,
    `      The directory to run the command in ${chalk.dim(`(default: ".")`)}`,
  ]);
  console.log();
};
