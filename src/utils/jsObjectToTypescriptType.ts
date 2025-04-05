import { uniq } from "lodash-es";

export const javascriptValueToTypescriptType = (value: unknown, indent = ""): string => {
  switch (typeof value) {
    case "object":
      if (value === null) {
        return `${indent}null`;
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          return `${indent}unknown[]`;
        } else {
          const types = uniq(value.map((v) => javascriptValueToTypescriptType(v).trim()));
          return `${indent}(${types.join(" | ")})[]`;
        }
      } else if (value instanceof Date) {
        return `${indent}Date`;
      } else {
        const lines = Object.entries(value)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, value]) => {
            const quotedKey = key.match(/[^a-zA-Z0-9_]/g) ? `"${key}"` : key;
            return `${indent}  ${quotedKey}: ${javascriptValueToTypescriptType(value, indent + "  ").trim()};`;
          })
          .join("\n");

        return `${indent}{\n${lines}\n${indent}}`;
      }
    case "function":
      // TODO derive this
      return `${indent}(...args: any[]) => any`;
    case "string":
      // TODO try to find a better way to have the user improve types here. In my own case, I have tags mapping to
      //      icon names, and the tags array in other parts of the codebase is typed as `IconName[]`
      if (value.length < 50 && !value.match(/["\n]/)) {
        return `${indent}"${value}"`;
      } else {
        return `${indent}string`;
      }
    case "bigint":
    case "boolean":
    case "number":
    case "symbol":
    case "undefined":
      return `${indent}${typeof value}`;
  }
};
