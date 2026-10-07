import { link } from "ansi-escapes";

import { Site } from "../../site/Site.js";
import { Validator, type ValidationResult } from "../../utils/Validator.js";

export const run = async (opts: {
  root: string;
  signal: AbortSignal;
  verbose: boolean;
  failFast: boolean;
}): Promise<number> => {
  const { root, signal, verbose, failFast } = opts;
  const site = await Site.forRoot(root);
  const siteData = await site.load({ signal });
  const validator = new Validator();

  let exitCode = 0;
  for (const datum of siteData) {
    const result = await validator.validate(datum, { signal });
    switch (result?.description) {
      case "passed":
        if (verbose) {
          console.log(`✅ ${result.filename}`);
        }
        break;
      case "warned":
        // TODO "warnings = errors" option
        console.log(`⚠️ ${result.filename}:`);
        dumpMessages(result);
        break;
      case "failed":
        console.log(`❌ ${result.filename}:`);
        dumpMessages(result);
        exitCode = 1;
        if (failFast) {
          return 1;
        }
    }
  }

  return exitCode;
};

const dumpMessages = ({ content, messages }: ValidationResult) => {
  for (const { message, ruleId, ruleUrl, offset, severity, line, column } of messages) {
    let prefix: string;
    switch (severity) {
      case 2:
        prefix = "❌";
        break;
      case 1:
        prefix = "⚠️";
        break;
      default:
        prefix = "ℹ️";
    }

    const rule = ruleUrl ? link(ruleId, ruleUrl) : ruleId;

    console.log(`  - ${prefix} ${line}:${column} ${message} (${rule})`);
    if (content) {
      console.log();
      console.log(contextString(content, offset, { indent: "    " }));
      console.log();
    }
  }
};

const contextString = (
  source: string,
  offset: number,
  options?: { context?: number; indent?: string },
) => {
  const { context = 100, indent = "" } = options || {};
  const maybeStartEllipsis = offset > context ? `${indent}...` : "";
  const maybeEndEllipsis = offset + context < source.length ? "..." : "";
  const contextChars = source.slice(Math.max(0, offset - context), offset + context + 1);
  const contextCharsWithIndentation = contextChars
    .split("\n")
    .map((v, index) => (index == 0 ? v : indent + v))
    .join("\n");

  return `${maybeStartEllipsis}${contextCharsWithIndentation}${maybeEndEllipsis}`;
};
