import { M8tError, type M8tErrorOptions } from "./M8tError.js";

/**
 * Raised when an invariant is violated, which typically indicates a bug in m8t or in a custom
 * processor.
 */
export class InternalError extends M8tError {
  constructor(message: string, options?: M8tErrorOptions) {
    super(message, {
      hint: "This is likely a bug in m8t or in one of the site's custom processors",
      ...options,
    });
  }
}
