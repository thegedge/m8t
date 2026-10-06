import { inspect } from "node:util";

import { errorDetails, indent, styled, type ErrorFormatOptions } from "../errors/formatting.js";
import { M8tError } from "../errors/M8tError.js";

/**
 * Formats any thrown value for display.
 *
 * Uses {@link M8tError.format} for any m8t error. Otherwise, reported as an unknown error.
 */
export const formatError = (error: unknown, options?: ErrorFormatOptions): string => {
  if (error instanceof M8tError) {
    return error.format(options);
  }

  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : inspect(error);
  const headline = `${styled(["bold", "red"], "Unknown error:")} ${message}`;
  const hint = options?.verbose
    ? "This is likely a bug in m8t"
    : "This is likely a bug in m8t (run with --verbose to see a stack trace)";
  const details = errorDetails(error, options);
  return [headline, styled("dim", indent(hint)), details].filter(Boolean).join("\n");
};
