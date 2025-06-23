#!/usr/bin/env NODE_NO_WARNINGS=1 node  --experimental-import-meta-resolve --experimental-vm-modules --experimental-transform-types
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { SiteBuilder } from "../SiteBuilder.js";

const COMMANDS = {
  build: async () => await import("./commands/build.js"),
  help: async () => await import("./commands/help.js"),
  serve: async () => await import("./commands/serve.js"),
  validate: async () => await import("./commands/validate.js"),
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

// Ideally this wouldn't be necessary, but esbuild — used by the tsx loader — lingers.
process.exit();
