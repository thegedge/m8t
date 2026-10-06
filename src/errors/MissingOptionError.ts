import type { SiteOptions } from "../site/Site.js";
import { ConfigError } from "./ConfigError.js";

/**
 * Raised when an operation requires a site option that `site.ts` doesn't specify.
 */
export class MissingOptionError extends ConfigError {
  /** The site option that is missing */
  readonly option: keyof SiteOptions;

  constructor(option: keyof SiteOptions) {
    super(`site.ts doesn't specify the \`${option}\` option`, {
      hint: `Add a \`${option}\` entry to the options exported from site.ts`,
    });
    this.option = option;
  }
}
