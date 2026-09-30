import { HtmlValidate, type Message, type RuleConfig } from "html-validate";
import { pMapSkip } from "p-map";

import type { Site } from "../site/Site.js";

export { type Result } from "html-validate";

/** A result for a single datum produced by a validation */
export type ValidationResult = {
  /** The filename of the datum that failed */
  filename: string;

  /** The HTML content that was passed to the validator */
  content: string;

  /** What kind of result this is */
  description: "aborted" | "skipped-fail-fast" | "failed" | "passed";

  /** The results describing what's wrong. */
  messages: Message[];
};

export type ValidationOptions = {
  /** An optional signal to abort validation */
  signal?: AbortSignal;

  /**
   * If `true`, fail as soon as there's a single failure
   *
   * @defaultValue false
   */
  failFast?: boolean;
};

/**
 * Validates a site's rendered HTML output using html-validate.
 *
 * Iterates every page the site produces, skipping non-HTML output, and validates each page's
 * markup against html-validate's recommended and accessibility rulesets (plus any page-specific
 * overrides set via the `htmlValidateRules` datum). Does not print or format anything itself —
 * callers are responsible for presenting the {@link ValidationSummary} it returns.
 */
export class Validator {
  readonly #validator: HtmlValidate;

  constructor() {
    this.#validator = new HtmlValidate({
      root: true,
      extends: ["html-validate:recommended", "html-validate:a11y"],
    });
  }

  /**
   * Validate every HTML page the site produces.
   *
   * @returns a list of validation results for all datum with a mime type of `text/html`
   */
  public async *run(site: Site, options: ValidationOptions = {}): AsyncGenerator<ValidationResult> {
    const { signal, failFast = false } = options;

    let skipBecauseOfFailure = false;

    for (const url of await site.urls) {
      const datum = await site.dataByUrl(url);
      if (!datum) {
        throw new Error(`Could not build page for URL ${url}`);
      }

      const mimeType = datum.stringOrThrow("mimeType");
      if (mimeType !== "text/html") {
        return pMapSkip;
      }

      const filename = datum.stringOrThrow("filename");
      const content = datum.stringOrThrow("content");

      let description: ValidationResult["description"];
      let messages: Message[];
      if (signal?.aborted) {
        description = "aborted";
        messages = [];
      } else if (skipBecauseOfFailure) {
        description = "skipped-fail-fast";
        messages = [];
      } else {
        let rules: RuleConfig | undefined = undefined;
        if (datum.has("htmlValidateRules")) {
          rules = datum.get("htmlValidateRules") as RuleConfig;
        }

        const { valid, results } = await this.#validator.validateString(content, filename, {
          rules,
        });

        skipBecauseOfFailure ||= !valid && failFast;
        description = valid ? "passed" : "failed";
        messages = results[0]?.messages ?? [];
      }

      yield { filename, content, description, messages };
    }
  }
}
