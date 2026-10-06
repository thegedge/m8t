import { M8tError, type M8tErrorOptions } from "./M8tError.js";

/**
 * Raised when a module or a piece of content can't be loaded.
 */
export class LoadError extends M8tError {
  /** The file being loaded, if known */
  readonly filename: string | undefined;

  /** The import specifier that failed to load, if any */
  readonly specifier: string | undefined;

  constructor(
    message: string,
    options?: M8tErrorOptions & { filename?: string; specifier?: string },
  ) {
    super(message, options);
    this.filename = options?.filename;
    this.specifier = options?.specifier;
  }
}
