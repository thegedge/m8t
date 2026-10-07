import { HtmlValidate, type Message, type RuleConfig } from "html-validate";

import type { Datum } from "../pipeline/Datum.js";

export { type Result } from "html-validate";

/** A result for a single datum produced by a validation */
export type ValidationResult = {
  /** The filename of the datum that failed */
  filename: string;

  /** The HTML content that was passed to the validator */
  content: string;

  /** What kind of result this is */
  description: "failed" | "warned" | "passed";

  /** The results describing what's wrong. */
  messages: Message[];
};

export type ValidationOptions = {
  /** An optional signal to abort validation */
  signal?: AbortSignal;
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
   * Validate every HTML page in a snapshot of site data.
   *
   * @returns a list of validation results for all datum with a mime type of `text/html`
   */
  public async validate(
    datum: Datum,
    options: ValidationOptions = {},
  ): Promise<ValidationResult | null> {
    const mimeType = datum.stringOrThrow("mimeType");
    if (mimeType !== "text/html") {
      return null;
    }

    const { signal } = options;
    signal?.throwIfAborted();

    const filename = datum.stringOrThrow("filename");
    const content = datum.stringOrThrow("content");

    let rules: RuleConfig | undefined = undefined;
    if (datum.has("htmlValidateRules")) {
      rules = datum.get("htmlValidateRules") as RuleConfig;
    }

    const { valid, results } = await this.#validator.validateString(content, filename, { rules });
    const warningCount = results[0]?.warningCount || 0;

    return {
      filename,
      content,
      description: valid ? (warningCount == 0 ? "passed" : "warned") : "failed",
      messages: results[0]?.messages ?? [],
    };
  }
}
