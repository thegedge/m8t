import { errorDetails, indent, styled, type ErrorFormatOptions } from "./formatting.js";

/**
 * Options for constructing an {@link M8tError}.
 */
export type M8tErrorOptions = ErrorOptions & {
  /** A suggestion for how to resolve the error, shown beneath the message */
  hint?: string;
};

/**
 * Base class for all errors raised by m8t.
 *
 * The CLI formats these with {@link M8tError.format}, which subclasses may override.
 */
export class M8tError extends Error {
  /** A suggestion for how to resolve the error */
  readonly hint: string | undefined;

  constructor(message: string, options?: M8tErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.hint = options?.hint;
  }

  /**
   * Formats this error for display to a user.
   *
   * Shows the error's name and message, its hint (if any), and its chain of causes. When verbose,
   * also includes stack traces.
   */
  format(options?: ErrorFormatOptions): string {
    const headline = `${styled(["bold", "red"], `${this.name}:`)} ${this.message}`;
    const hint = this.hint ? styled("dim", indent(this.hint)) : "";
    const details = errorDetails(this, options);
    return [headline, hint, details].filter(Boolean).join("\n");
  }
}
