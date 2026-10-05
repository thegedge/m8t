/**
 * Sanitize a given string so that it can be used as a filename.
 */
export const sanitizeForFilename = (value: string) => {
  if (!value || value == "/") {
    return "__root__";
  }

  let encoded: string;
  if (value.includes("--")) {
    encoded = encodeURIComponent(value);
  } else {
    // If we won't have any collisions with --, replace `/` with `--` for nicer filenames
    encoded = encodeURIComponent(value.replaceAll("/", "--"));
  }

  // Replace some other common URI-escaped characters with valid path characters
  encoded = encoded.replaceAll("%20", " ");

  // Finally, `.` and `..` aren't a great idea. By this point, we should have a relative
  // path without any dots. Encode something a bit obnoxious, so it stands out.
  return encoded.replaceAll(".", "__dot__");
};
