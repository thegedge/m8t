#!/usr/bin/env -S node --no-warnings --experimental-vm-modules --experimental-import-meta-resolve
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import debug from "debug";

import { Site } from "../Site.js";

type Args = {
  _: string[];
  directory?: string;
  [key: string]: unknown;
};

const COMMANDS = {
  build: async () => await import("./commands/build.js"),
  diff: async () => await import("./commands/diff.js"),
  help: async () => await import("./commands/help.js"),
  serve: async () => await import("./commands/serve.js"),
  validate: async () => await import("./commands/validate.js"),
};

const isCommand = (command: string | undefined): command is keyof typeof COMMANDS => {
  return !!command && command in COMMANDS;
};

const log = debug("m8t:cli");

const main = async (command: string | undefined, args: Args): Promise<number> => {
  let actualCommand: keyof typeof COMMANDS;
  if (isCommand(command)) {
    actualCommand = command;
  } else {
    actualCommand = "help";
  }

  const root = args.directory ? path.resolve(args.directory) : process.cwd();
  const site = await Site.forRoot(root);

  const exiting = new AbortController();
  let { resolve: resolveTimedOut, promise: timedOut } = Promise.withResolvers<number>();
  const shutdown = () => {
    exiting.abort();
    setTimeout(() => {
      resolveTimedOut(100);
    }, 1500);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const commandModule = await COMMANDS[actualCommand]();
  return await Promise.race([await commandModule.run(site, args as any, exiting.signal), timedOut]);
};

const entryFile = process.argv?.[1];
const __filename = fileURLToPath(import.meta.url);
if (entryFile !== __filename && !entryFile.endsWith("node_modules/.bin/m8t")) {
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
log("running command %s", subcommand);

process.exitCode = await main(subcommand, {
  ...values,
  _: positionals,
});

// Ideally this wouldn't be necessary, but esbuild — used by the tsx loader — lingers.
process.exit();
