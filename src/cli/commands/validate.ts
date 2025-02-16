import { link } from "ansi-escapes";
import { HtmlValidate, type Result } from "html-validate/node";
import { Pages } from "../../Pages.ts";
import type { Site } from "../../Site.ts";

export const run = async (site: Site, args: { _: string[]; "fail-fast": boolean }): Promise<void> => {
  const validator = new HtmlValidate({
    root: true,
    extends: ["html-validate:recommended", "html-validate:a11y"],

    // TODO allow this to be configurable
    rules: {
      // REMOVEME once React renders these as proper boolean attributes
      "attribute-boolean-style": "off",
      "long-title": "off",
    },
  });

  const pages = await Pages.forSite(site);
  for (const url of pages.urls()) {
    const page = await pages.page(url);
    if (!page) {
      throw new Error(`Could not build page for URL ${url}`);
    }

    if (!page.outputPath.endsWith(".html")) {
      continue;
    }

    const { valid, results } = await validator.validateString(page.content, page.filename, {
      rules: page.data.htmlValidateRules,
    });
    if (!valid) {
      process.exitCode = 1;

      console.log(page.filename);
      dumpMessages(results);

      if (args["fail-fast"]) {
        return;
      }
    }
  }
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

const contextString = (source: string, offset: number, options?: { context?: number; indent?: string }) => {
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
