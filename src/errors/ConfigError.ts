import { M8tError } from "./M8tError.js";

/**
 * Raised when a site is misconfigured.
 *
 * For example, an invalid `site.ts`, or a command that requires options the site doesn't
 * specify.
 */
export class ConfigError extends M8tError {}
