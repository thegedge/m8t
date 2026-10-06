import { M8tError, type M8tErrorOptions } from "./M8tError.js";

/**
 * Raised when a site's pages or assets can't be built.
 */
export class BuildError extends M8tError {
  /** The URL of the page being built, if known */
  readonly url: string | undefined;

  constructor(message: string, options?: M8tErrorOptions & { url?: string }) {
    super(message, options);
    this.url = options?.url;
  }
}
