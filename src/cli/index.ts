#!/usr/bin/env -S node --no-warnings --experimental-vm-modules --experimental-import-meta-resolve
import { Command, Help, type OptionValues } from "@commander-js/extra-typings";
import debug from "debug";
import { stop } from "esbuild";
import module from "node:module";
import path from "node:path";
import { styleText } from "node:util";

import packageJSON from "../../package.json" with { type: "json" };
import { formatError } from "./formatError.js";
import { printLogoAndTitleWithLines } from "./tui/logo.js";

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

const runCommand = <
  ArgsT extends any[],
  OptsT extends OptionValues,
  GlobalOptsT extends { directory?: string },
>(
  run: (runOptions: {
    opts: GlobalOptsT & OptsT;
    args: ArgsT;
    root: string;
    signal: AbortSignal;
  }) => Promise<number>,
): ((...args: [...ArgsT, OptsT, Command<ArgsT, OptsT, GlobalOptsT>]) => Promise<void>) => {
  return async (...args: unknown[]) => {
    const command = args.pop()! as unknown as Command<ArgsT, OptsT, GlobalOptsT>;
    args.pop();

    const { directory, ...commandOpts } = command.optsWithGlobals();
    const root = directory ? path.resolve(directory) : process.cwd();

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

    try {
      process.exitCode = await Promise.race([
        timedOut,
        run({
          opts: commandOpts as unknown as GlobalOptsT & OptsT,
          args: args as unknown as ArgsT, // we've popped off the command and opts
          root,
          signal: exiting.signal,
        }),
      ]);
    } catch (e) {
      // Work rejected because the user asked us to stop isn't worth reporting
      if (exiting.signal.aborted && e instanceof Error && e.name === "AbortError") {
        process.exitCode = 1;
        return;
      }
      throw e;
    }
  };
};

const program = new Command()
  .name("m8t")
  .description("Static site generator")
  .version(packageJSON.version)
  .option("-C, --directory <path>", "directory to run in")
  .option("-v, --verbose", "emit more verbose output");

program.configureHelp({
  styleTitle(str) {
    return styleText("bold", str);
  },

  styleSubcommandTerm(str) {
    return styleText(["bold", "green"], str);
  },

  styleOptionTerm(str) {
    return styleText(["bold", "blue"], str);
  },

  formatHelp(cmd, helper) {
    const text = Help.prototype.formatHelp.call(helper, cmd, helper);
    printLogoAndTitleWithLines(process.stdout, text.split("\n"));
    return "";
  },
});

program
  .command("build")
  .description("Emit the site's pages to the output directory")
  .action(
    runCommand(async ({ root, signal }) => {
      const { run } = await import("./commands/build.js");
      return await run({ root, signal });
    }),
  );

program
  .command("diff")
  .description("Diff the site's pages against the persisted set of screenshots")
  .action(
    runCommand(async ({ root, signal }) => {
      const { run } = await import("./commands/diff.js");
      return await run({ root, signal });
    }),
  );

program
  .command("serve")
  .description("Start a reloading dev server for the site")
  .action(
    runCommand(async ({ root, signal }) => {
      const { run } = await import("./commands/serve.js");
      return await run({ root, signal });
    }),
  );

program
  .command("validate")
  .description("Validate the site's pages")
  .option("--fail-fast", "stop when the first validation failure is encountered")
  .action(
    runCommand(async ({ root, signal, opts }) => {
      const { failFast = false, verbose = false } = opts;
      const { run } = await import("./commands/validate.js");
      return await run({
        root,
        signal,
        failFast,
        verbose,
      });
    }),
  );

try {
  await program.parseAsync(process.argv);
} catch (e) {
  const { verbose = false } = program.opts();
  process.stderr.write(formatError(e, { verbose }) + "\n");
  process.exitCode ??= 1;
} finally {
  // TODO allow the pipeline to dispose itself once completed so that we don't have this here
  await stop();
}
