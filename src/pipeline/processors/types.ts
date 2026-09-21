import { camelize } from "inflected";
import path from "node:path";

import { dedent } from "../../utils/dedent.js";
import { union } from "../../utils/union.js";
import { uniq } from "../../utils/uniq.js";
import { Datum, symProcessedBy } from "../Datum.js";
import type { ManyProcessor } from "../index.js";
import type { DefaultContext } from "../utils.js";
import { TypescriptLoader } from "./loaders/typescript.js";
import { LayoutTransformer, symLayoutFilename } from "./transformers/layout.js";

const DEFAULT_IGNORED_KEYS = ["components", "content", "htmlValidateRules", "layout", "mimeType"];

/** Options for constructing a {@link TypesProcessor} */
export type TypesProcessorOptions = {
  /** The output path where the types declaration file will be written */
  typesOutputFile: string;

  /** The data keys to omit from the types declaration file */
  ignoredKeys?: readonly string[];

  /** The data keys that should be typed as literals (i.e., as narrow as possible) */
  literalKeys?: readonly string[];
};

/**
 * A m8t pipeline stage that generates a TypeScript type declaration file for the data.
 *
 * It tries its best to simplify the types, but there will be some redundancy. In particular, it uses heuristics
 * for data exported from shared files like layouts and `_data.ts` files.
 *
 * Any TypeScript file in the project can then reference the type with `DataProps` (no need for imports).
 */
export class TypesProcessor implements ManyProcessor {
  readonly #typesFile: string;
  readonly #ignoredKeys: readonly string[];
  readonly #literalKeys: readonly string[];

  constructor(options: TypesProcessorOptions) {
    this.#ignoredKeys = union(DEFAULT_IGNORED_KEYS, options.ignoredKeys ?? []);
    this.#literalKeys = options.literalKeys ?? [];
    this.#typesFile = options.typesOutputFile;
  }

  async processMany(data: readonly Datum[], context: DefaultContext): Promise<readonly Datum[]> {
    // A mapping from a base type name to the types for that base.
    // The inner map will map from the datum key to all the types discovered for that key, which we will later reduce to a union.
    const baseTypes = new Map<string, Map<string, Set<string>>>();
    const seenModules = new Set<string>();

    const typesPath = context.site.root.absolute(this.#typesFile);
    const typesString = data
      .map((datum) => {
        const relativeModulePath = path.relative(path.dirname(typesPath), datum.get("filename"));
        if (seenModules.has(relativeModulePath)) {
          return null;
        }
        seenModules.add(relativeModulePath);

        // All the keys in the base types, which we will exclude from the final type for this datum
        const baseKeys = new Set<string>();

        // The type names that we will extend for this datum's interface
        const baseTypeNames = new Set<string>();

        datum.lineage.forEach((ancestor) => {
          const processedBy = ancestor[symProcessedBy];

          let typeName = "";
          if (processedBy instanceof TypescriptLoader) {
            const basePath = path.dirname(path.relative(ancestor.basePath, ancestor.filename));
            typeName = `${camelizePath(basePath)}Data`;
          } else if (processedBy instanceof LayoutTransformer) {
            // TODO layouts should ignore all data keys from the data files
            const basePath = ancestor[symLayoutFilename] as string | undefined;
            if (basePath) {
              typeName = `${camelizePath(basePath)}LayoutData`;
            }
          }

          if (typeName) {
            baseTypeNames.add(typeName);

            const mapping = baseTypes.get(typeName) ?? new Map<string, Set<string>>();
            for (const key of Object.keys(ancestor)) {
              if (this.#ignoredKeys.includes(key)) {
                continue;
              }

              const type = javascriptValueToTypescriptType(ancestor[key], {
                indent: "",
                literal: this.#literalKeys.includes(key),
              });
              if (type) {
                baseKeys.add(key);

                let set = mapping.get(key);
                if (!set) {
                  set = new Set<string>();
                  mapping.set(key, set);
                }
                set.add(type);
              }
            }

            baseTypes.set(typeName, mapping);
          }
        });

        let typeString = javascriptValueToTypescriptType(datum.toRecord(), {
          indent: "",
          literalKeys: this.#literalKeys,
          ignoredKeys: union(Array.from(baseKeys), this.#ignoredKeys),
        });

        if (datum.has("search")) {
          // We don't check `typeof` on the search key, because it gets set to `undefined` by the
          // `SearchProcessor`. We just assume it was a search function for now (but we could check
          // the lineage, which might be best in the future).
          const parts: string[] = [...baseTypeNames];
          if (typeString && typeString !== "Record<string, unknown>") {
            parts.push(typeString.trim());
          }
          parts.push(`Awaited<ReturnType<typeof import("${relativeModulePath}").search>>`);

          typeString = `export type DataProps = ${parts.join(" & ")};`;
        } else if (!typeString) {
          typeString = "export type DataProps = never;";
        } else if (typeString == "Record<string, unknown>") {
          if (baseTypeNames.size == 0) {
            typeString = "export type DataProps = Record<string, unknown>;";
          } else {
            typeString = `export type DataProps = ${[...baseTypeNames].join(" & ")};`;
          }
        } else {
          let extendsString = "";
          if (baseTypeNames.size > 0) {
            extendsString = `extends ${[...baseTypeNames].join(", ")} `;
          }

          // Slice/trim below is removing the curly braces + indent added by `javascriptValueToTypescriptType`
          typeString = dedent`
            export interface DataProps ${extendsString}{
              ${typeString.trim().slice(1, -1).trim()}
            }
          `;
        }

        return dedent`
          declare module "${relativeModulePath}" {
            ${typeString}
          }
        `;
      })
      .filter(Boolean)
      .join("\n\n");

    const baseTypesString = baseTypes
      .entries()
      .map(([typeName, mapping]) => {
        const keyTypes = mapping
          .entries()
          .map(([key, types]) => `${maybeQuote(key)}: ${Array.from(types).join(" | ")}`);
        return dedent`
          export interface ${typeName} {
            ${keyTypes.toArray().join(";\n  ")};
          }
        `;
      })
      .toArray()
      .join("\n\n");

    await context.site.root.writeFile(
      typesPath,
      dedent`
        import "path";

        ${baseTypesString}
        ${typesString}
      `,
    );

    return data;
  }
}

const camelizePath = (path: string) => {
  // Trim leading dots and trailing file extensions
  // Convert non-alpha characters to underscores, so camelize will remove them and do the right thing
  const normalizedPath = path
    .replace(/^\.+\/?/, "")
    .replaceAll(/\.\w+$/g, "")
    .replaceAll(/[^a-zA-Z_]+/g, "_");
  if (normalizedPath === "") {
    return "Root";
  }

  return camelize(normalizedPath).replaceAll("/", "");
};

/**
 * Converts a JavaScript value to a TypeScript type string.
 */
const javascriptValueToTypescriptType = (
  value: unknown,
  options?: {
    /**
     * The indentation string to use.
     *
     * This is incremented by two spaces for each nested level.
     *
     * @defaultValue ""
     */
    indent?: string;

    /**
     * Whether the value should be typed as a literal.
     *
     * @defaultValue false
     */
    literal?: boolean;

    /**
     * The set of values that have already been seen.
     *
     * This is used to avoid infinite recursion.
     *
     * @defaultValue new Set()
     */
    seen?: Set<unknown>;

    /**
     * The keys that should be typed as literals.
     *
     * @defaultValue []
     */
    literalKeys?: readonly string[];

    /**
     * The keys that should be ignored.
     *
     * @defaultValue []
     */
    ignoredKeys?: readonly string[];
  },
): string | undefined => {
  if (value == null) {
    return;
  }

  const {
    indent = "",
    seen = new Set(),
    literal = false,
    literalKeys = [],
    ignoredKeys = [],
  } = options ?? {};
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
    case "object": {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return `unknown[]`;
        }

        // TODO if `literal` is true, we may want to do `[t1, t2, t3]`
        const newOptions = { indent: indent + "  ", literalKeys, ignoredKeys, seen };
        const types = value.map((v) => javascriptValueToTypescriptType(v, newOptions)?.trim());
        const distinctTypes = uniq(types.filter(Boolean));
        if (distinctTypes.length === 0) {
          return `unknown[]`;
        }

        if (distinctTypes.length === 1) {
          return `${distinctTypes[0]}[]`;
        }

        return `(${distinctTypes.join(" | ")})[]`;
      } else if (value instanceof Date) {
        return `Date`;
      } else if (value !== null && Object.getPrototypeOf(value) == Datum.prototype) {
        return `any`;
      }

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

          return `${indent}${maybeQuote(key)}: ${valueString};`;
        })
        .filter(Boolean); // Filter out empty lines

      // It's an object, but no idea what kind, assume a POJO
      if (lines.length === 0) {
        return `Record<string, unknown>`;
      }

      // Single-property objects we'll turn into one-liners
      if (lines.length === 1) {
        return `{ ${lines[0]} }`;
      }

      return `{\n${lines.join("\n")}\n}`;
    }
    case "function":
      return `(...args: any[]) => any`;
    case "string":
      if (literal) {
        return `"${value}"`;
      } else {
        return `string`;
      }
    case "bigint":
    case "boolean":
      if (literal) {
        return `${value}`;
      } else {
        return `${typeof value}`;
      }
    case "number":
      if (literal && Number.isInteger(value)) {
        return `${value}`;
      } else {
        return `number`;
      }
    case "symbol":
      return `symbol`;
  }
};

const maybeQuote = (key: string) => {
  return key.match(/[^a-zA-Z0-9_]/g) ? `"${key}"` : key;
};
