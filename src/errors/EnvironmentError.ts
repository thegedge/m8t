import { M8tError, type M8tErrorOptions } from "./M8tError.js";

/**
 * Raised when the environment m8t runs in is unsuitable, such as node lacking a required
 * experimental flag, or a required environment variable being unset or invalid.
 */
export class EnvironmentError extends M8tError {
  /** The node flag that's required, if any */
  readonly flag: string | undefined;

  constructor(message: string, options?: M8tErrorOptions & { flag?: string }) {
    super(message, {
      hint: options?.flag
        ? `Run node with ${options.flag} (e.g., via NODE_OPTIONS), or use the m8t binary, which sets it for you`
        : undefined,
      ...options,
    });
    this.flag = options?.flag;
  }
}
