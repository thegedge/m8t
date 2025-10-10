import path from "node:path";
import type { ManyProcessor } from "../../index.js";
import { union } from "../../utils/union.js";
import { uniq } from "../../utils/uniq.js";
import type { Datum } from "../Datum.js";
import type { DefaultContext } from "../utils.js";

const DEFAULT_IGNORED_KEYS = ["components", "content", "htmlValidateRules", "layout"];

export class TypesProcessor implements ManyProcessor {
  #typesFile: string;
  #ignoredKeys: readonly string[];
  #literalKeys: readonly string[];

  constructor(options: {
    /** The output path where the types declaration file will be written */
    typesOutputFile: string;

    /** The data keys to omit from the types declaration file */
    ignoredKeys?: readonly string[];

    /** The data keys that should be typed as literals (i.e., as narrow as possible) */
    literalKeys?: readonly string[];
  }) {
    this.#typesFile = options.typesOutputFile;
    this.#ignoredKeys = union(DEFAULT_IGNORED_KEYS, options.ignoredKeys ?? []);
    this.#literalKeys = options.literalKeys ?? [];
  }

  async processMany(data: readonly Datum[], context: DefaultContext): Promise<readonly Datum[]> {
    const typesPath = context.site.root.absolute(this.#typesFile);
    const typesDeclContent = data
      .map((datum) => {
        const relativeModulePath = path.relative(path.dirname(typesPath), datum.get("filename"));
        const typeString = javascriptValueToTypescriptType(datum.toRecord(), {
          indent: "  ",
          literalKeys: this.#literalKeys,
          ignoredKeys: this.#ignoredKeys,
        })?.trim();

        if (!typeString) {
          return "";
        }

        return `
declare module "${relativeModulePath}" {
  export type DataProps = ${typeString};
}
`;
      })
      .join("");

    await context.site.root.writeFile(typesPath, `import "path";\n\n${typesDeclContent}`);

    return data;
  }
}

export const javascriptValueToTypescriptType = (
  value: unknown,
  options: {
    indent?: string;
    literal?: boolean;
    seen?: Set<unknown>;
    literalKeys?: readonly string[];
    ignoredKeys?: readonly string[];
  } = { indent: "" },
): string | undefined => {
  if (value == null) {
    return;
  }

  const { indent = "", seen = new Set(), literal = false, literalKeys = [], ignoredKeys = [] } = options;
  if (indent.length > 50) {
    // Avoid too much recursion
    return "any";
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      // TODO we could have a mapping and have it point to the result, we'd just need to avoid
      //      infinite recursion in the case of a cyclic structure.
      return "any";
    } else {
      seen.add(value);
    }
  }

  switch (typeof value) {
    case "object":
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return `${indent}unknown[]`;
        }

        // TODO if `literal` is true, we may want to do either `[t1, t2, t3]` or `(t1 | t2 | t3)[]`
        const newOptions = { indent: indent + "  ", literalKeys, ignoredKeys, seen };
        const types = value.map((v) => javascriptValueToTypescriptType(v, newOptions)?.trim());
        const distinctTypes = uniq(types.filter(Boolean));
        if (distinctTypes.length === 0) {
          return `${indent}unknown[]`;
        }

        return `${indent}(${distinctTypes.join(" | ")})[]`;
      } else if (value instanceof Date) {
        return `${indent}Date`;
      } else {
        const lines = Object.entries(value)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, value]) => {
            if (ignoredKeys.includes(key)) {
              return "";
            }

            const literal = literalKeys.includes(key);
            const newOptions = { indent: indent + "  ", literalKeys, ignoredKeys, seen, literal };
            const valueString = javascriptValueToTypescriptType(value, newOptions)?.trim();
            if (!valueString) {
              return "";
            }

            if (value && typeof value === "object" && Object.keys(value).includes("Consumer")) {
              return `${indent}  ${key}: ${valueString};`;
            }

            const quotedKey = key.match(/[^a-zA-Z0-9_]/g) ? `"${key}"` : key;
            return `${indent}  ${quotedKey}: ${valueString};`;
          })
          .filter(Boolean)
          .join("\n");

        return `${indent}{\n${lines}\n${indent}}`;
      }
    case "function":
      // TODO can we derive this?
      return `${indent}(...args: any[]) => any`;
    case "string":
      if (literal) {
        return `${indent}"${value}"`;
      } else {
        return `${indent}string`;
      }
    case "bigint":
    case "boolean":
      if (literal) {
        return `${indent}${value}`;
      } else {
        return `${indent}${typeof value}`;
      }
    case "number":
      if (literal && Number.isInteger(value)) {
        return `${indent}${value}`;
      } else {
        return `${indent}number`;
      }
    case "symbol":
      return `${indent}symbol`;
  }
};
