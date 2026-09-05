import { link } from "ansi-escapes";
import debug from "debug";
import { HtmlValidate, type Result, type RuleConfig } from "html-validate";

import type { Site } from "../../Site.js";

const log = debug("m8t:validate");

export const run = async (
  site: Site,
  args: { _: string[]; "fail-fast": boolean },
  signal: AbortSignal,
): Promise<number> => {
  const validator = new HtmlValidate({
    root: true,
    extends: ["html-validate:recommended", "html-validate:a11y"],
  });

  // TODO verify that all pages have distinct urls and output paths

  for (const url of await site.urls) {
    if (signal.aborted) {
      return 0;
    }

    log("validating %s", url);

    const datum = await site.dataByUrl(url);
    if (!datum) {
      throw new Error(`Could not build page for URL ${url}`);
    }

    const outputPath = datum.stringOrThrow("outputPath");
    if (!outputPath.endsWith(".html")) {
      continue;
    }

    const filename = datum.stringOrThrow("filename");
    const content = datum.stringOrThrow("content");

    let rules: RuleConfig | undefined = undefined;
    if (datum.has("htmlValidateRules")) {
      rules = datum.get("htmlValidateRules") as RuleConfig;
    }

    const { valid, results } = await validator.validateString(content, filename, { rules });
    if (!valid) {
      console.log(`--> ${filename}:`);
      dumpMessages(results);

      if (args["fail-fast"]) {
        return 1;
      }
    }
  }

  return 0;
};

const dumpMessages = (results: Result[]) => {
  for (const { messages, source } of results) {
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
      if (source) {
        console.log();
        console.log(contextString(source, offset, { indent: "    " }));
        console.log();
      }
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
