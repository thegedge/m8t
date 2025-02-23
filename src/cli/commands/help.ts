import chalk from "chalk";
import type { Site } from "../../Site.ts";
import { printLogoWithLines } from "../logo.ts";

const C = chalk.bgHex("#F98C00")(" ");
const S = " ";

export const run = async (_site: Site, _args: Record<string, unknown>): Promise<void> => {
  console.log();
  printLogoWithLines(process.stdout, [
    [S, S, S, S, S, S, S, S, S, C, C, S, S, S, S, S].join(""),
    [C, S, S, S, S, S, S, S, C, S, S, C, S, S, C, S].join(""),
    [C, C, C, S, C, C, S, S, S, C, C, S, S, C, C, C].join(""),
    [C, S, S, C, S, S, C, S, C, S, S, C, S, S, C, S].join(""),
    [C, S, S, C, S, S, C, S, S, C, C, S, S, S, C, S].join(""),
    "",
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
