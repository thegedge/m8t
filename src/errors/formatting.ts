import { inspect, styleText, type InspectColor } from "node:util";

/**
 * Options for {@link M8tError.format}.
 */
export type ErrorFormatOptions = {
  /** Whether to include extra details, such as stack traces */
  verbose?: boolean;

  /**
   * The max depth to descend into a cause chain.
   *
   * @defaultValue 10
   */
  maxCauseDepth?: number;
};

/**
 * Format text with a given style.
 *
 * A small wrapper around node's {@link styleText}. Text will remain unstyled for the same
 * conditions (e.g., NO_COLOR=1 is set in the env).
 *
 * @see {@link styleText}
 */
export const styled = (format: InspectColor | readonly InspectColor[], text: string) => {
  return styleText(format, text, { stream: process.stderr });
};

/** Indents every line of the given text. */
export const indent = (text: string, prefix = "  ") => {
  return text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
};

/**
 * Formats the details of an error chain.
 *
 * @param error - the error to format
 * @param options - formatting options
 *
 * @returns formatted string containing details of the given error
 */
export const errorDetails = (error: unknown, options: ErrorFormatOptions = {}): string => {
  const { verbose, maxCauseDepth = 10 } = options;

  const lines: string[] = [];
  if (verbose) {
    lines.push(...stackFrames(error));
  }

  for (
    let cause = causeOf(error), depth = 1;
    cause && depth <= maxCauseDepth;
    cause = causeOf(cause), ++depth
  ) {
    const prefix = "  ".repeat(depth);
    lines.push(indent(`${styled("bold", "Caused by:")} ${describe(cause)}`, prefix));
    if (options.verbose) {
      lines.push(...stackFrames(cause).map((line) => prefix + line));
    }
  }

  return lines.join("\n");
};

/** Format the stack frames of an error. */
const stackFrames = (error: unknown): string[] => {
  if (!(error instanceof Error) || !error.stack) {
    return [];
  }

  const lines = error.stack.split("\n");
  const firstFrame = lines.findIndex((line) => /^\s+at /.test(line));
  if (firstFrame === -1) {
    return [];
  }

  return lines.slice(firstFrame).map((line) => styled("dim", `    ${line.trim()}`));
};

/** Extract a potential cause of an error */
const causeOf = (error: unknown): unknown => {
  return error instanceof Error ? error.cause : undefined;
};

/** Provide a simple description of an error */
const describe = (value: unknown): string => {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  return typeof value === "string" ? value : inspect(value);
};
