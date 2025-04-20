#!/usr/bin/env NODE_NO_WARNINGS=1 node  --experimental-import-meta-resolve --experimental-vm-modules --experimental-transform-types
import path from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "util";
import { SiteBuilder } from "../SiteBuilder.ts";

const COMMANDS = {
  build: async () => await import("./commands/build.ts"),
  help: async () => await import("./commands/help.ts"),
  serve: async () => await import("./commands/serve.ts"),
  validate: async () => await import("./commands/validate.ts"),
};

const isCommand = (command: string | undefined): command is keyof typeof COMMANDS => {
  return !!command && command in COMMANDS;
};

type Args = {
  _: string[];
  directory?: string;
  [key: string]: unknown;
};

const main = async (command: string | undefined, args: Args) => {
  let actualCommand: keyof typeof COMMANDS;
  if (isCommand(command)) {
    actualCommand = command;
  } else {
    actualCommand = "help";
  }

  const root = args.directory ? path.resolve(args.directory) : process.cwd();
  const site = await SiteBuilder.siteForRoot(root);

  const commandModule = await COMMANDS[actualCommand]();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  await commandModule.run(site, args as any);
  return 0;
};

const entryFile = process.argv?.[1];
const __filename = fileURLToPath(import.meta.url);
if (entryFile !== __filename && !entryFile.endsWith("node_modules/.bin/mate")) {
  console.log("Can only run this file as a main script");
  process.exit(1);
}

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  strict: true,
  options: {
    directory: {
      type: "string",
      short: "C",
    },
  },
});
const subcommand = positionals.shift();
process.exitCode = await main(subcommand, {
  ...values,
  _: positionals,
});
