import { M8tError, type M8tErrorOptions } from "./M8tError.js";

/**
 * Raised when work is stopped because its abort signal fired.
 *
 * Named like the platform's own abort errors, so code checking for `name === "AbortError"` treats
 * both alike.
 */
export class AbortError extends M8tError {
  constructor(message = "work stopped", options?: M8tErrorOptions) {
    super(message, options);
  }
}
