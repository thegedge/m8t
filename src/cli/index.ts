#!/usr/bin/env -S node --no-warnings --experimental-vm-modules --experimental-import-meta-resolve
import debug from "debug";
import module from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";

const log = debug("m8t:cli");

if (!import.meta.main) {
  log("must only run this file as a main script");
  process.exit(1);
}

try {
  module.enableCompileCache();
} catch {
  // best effort, not necessary though
}

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

const main = async (command: string | undefined, args: Args): Promise<number> => {
  let actualCommand: keyof typeof COMMANDS;
  if (isCommand(command)) {
    actualCommand = command;
  } else {
    actualCommand = "help";
  }

  const root = args.directory ? path.resolve(args.directory) : process.cwd();

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
  return await Promise.race([commandModule.run(root, args as any, exiting.signal), timedOut]);
};

try {
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
} catch (e) {
  // TODO nicer formatting for errors, since users see this
  console.error(e);
  process.exitCode = 1;
} finally {
  // Ideally this wouldn't be necessary, but esbuild (for importing tsx/jsx) lingers.
  // TODO now that we have our own loader and use node for type stripping, we can probably
  //      ask the loader to shut down esbuild.
  process.exit();
}
