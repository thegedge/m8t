#!/usr/bin/env NODE_NO_WARNINGS=1 node  --experimental-import-meta-resolve --experimental-vm-modules --experimental-transform-types
import { register } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "util";
import { Site } from "../Site.ts";

register("@nodejs-loaders/tsx", import.meta.url);

const COMMANDS = {
  build: async () => await import("./commands/build.ts"),
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
  if (!isCommand(command)) {
    // TODO better usage;
    console.log(`Subcommand required: build, serve, validate`);
    return 1;
  }

  const root = args.directory ? path.resolve(args.directory) : process.cwd();
  const site = await Site.forRoot(root);

  const commandModule = await COMMANDS[command]();
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
