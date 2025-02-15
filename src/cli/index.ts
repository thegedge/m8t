#!/usr/bin/env -S bun run
import path from "path";
import { parseArgs } from "util";
import { Site } from "../Site";

const COMMANDS = {
  build: await import("./commands/build"),
  serve: await import("./commands/serve"),
  validate: await import("./commands/validate"),
};

const isCommand = (command: string | undefined): command is keyof typeof COMMANDS => {
  return !!command && command in COMMANDS;
};

type Args = {
  directory?: string;
  _: string[];
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

  const commandModule = COMMANDS[command];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  await commandModule.run(site, args as any);
  return 0;
};

if (import.meta.path !== Bun.main) {
  console.log("Can only run this file as a main script");
  process.exit(1);
}

const { positionals, values } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  // TODO enable strict once we can figure out how to define flags for the individual subcommands
  // strict: true,
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
