import { readFile } from "node:fs/promises";
import type { ImportPhase, ImportAttributes } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm, { type Module, type SourceTextModule, type Context } from "node:vm";

import type { MaybePromise } from "../types.js";
import { memoize } from "../utils/memoize.js";
import { canonicalModulePath } from "./canonicalModulePath.js";
import { Resolver } from "./Resolver.js";

/** A function that takes a URL and maybe transpiles it into javascript */
export type Transpiler = (filename: string) => MaybePromise<string | undefined>;

/**
 * Options for {@link ModuleLoader} construction.
 */
export type ModuleLoaderOptions = {
  /**
   * The transpilers the constructed loader should use to transpile files
   *
   * @defaultValue []
   */
  transpilers?: Transpiler[];

  /**
   * The context the used
   *
   * @defaultValue undefined (the surrounding context in which the loader was constructed)
   */
  context?: Context;
};

/**
 * Loads modules in a given realm/context.
 *
 * This class exists to support cache busting by using versioned URLs for cache busting.
 */
export class ModuleLoader {
  /**
   * Construct a {@link ModuleLoader} with a given set of transpilers.
   */
  static with(...transpilers: Transpiler[]) {
    return new ModuleLoader({ transpilers });
  }

  #moduleCache = new Map<string, Promise<Module>>();
  #evaluations = new WeakMap<Module, Promise<void>>();
  #linkQueue: Promise<void>[]; // serialize linking across multiple load calls
  #resolver = new Resolver();
  #transpilers: Transpiler[];
  #context: Context | undefined;

  /**
   * Construct a loader for the given context.
   *
   * By default, the surrounding context is used. Note that if you use a custom context, there's
   * a realm split between builtin modules and libs from `node_modules`, which are loaded with the
   * native loader. Prototypes will differ and certain things may subtly break.
   *
   * @param options - various options to configure the loader
   */
  constructor(options?: ModuleLoaderOptions) {
    if (!checkModuleSupportAvailable()) {
      throw new Error("m8t requires node to be run with --experimental-vm-modules");
    }

    this.#transpilers = [...(options?.transpilers ?? [])];
    this.#context = options?.context;
    this.#linkQueue = [];
  }

  /**
   * Loads the module for a given file.
   *
   * @returns all the exports from the given module
   */
  async load(filename: string): Promise<Record<string, unknown>> {
    // Ideally the signature would be something like this:
    //
    //   async load<F extends string>(filename: F): Promise<typeof import(F)>
    //
    // But TS doesn't support anything like that right now
    const module = await this.#moduleFor(pathToFileURL(filename).href, {});
    await this.#link(module);
    await this.#evaluate(module);
    return module.namespace as Record<string, unknown>;
  }

  /** Asks each provider, in order, for the source of a claimed file. */
  async #loadSource(filename: string): Promise<string | undefined> {
    for (const transpiler of this.#transpilers) {
      try {
        const source = await transpiler(filename);
        if (source !== undefined) {
          return source;
        }
      } catch {
        // TODO
        //   Suppressing for now, but then we're not surfacing useful context for the
        //   user to fix any issues. Three options:
        //     1. Separate into "can parse" and "transpile"
        //     2. Require all transpilers to properly handle errors
        //     3. Collect all errors, report after `load` completes
      }
    }

    if (filename.includes("/node_modules/") || filename.endsWith(".cjs")) {
      // Could be CommonJS, need to let the native system handle.
      // Otherwise, we'd have to parse the exports ourselves. No thank you.
      // TODO read the `package.json`, see if it's type is "module"
      return undefined;
    }

    return await readFile(filename, "utf8");
  }

  /**
   * Resolves a request from `referrer` to a module
   *
   * Note: does not link/evaluate the module.
   */
  #moduleFrom(specifier: string, referrer: Module, attributes: ImportAttributes): Promise<Module> {
    let resolved: string;
    try {
      resolved = this.#resolver.resolve(specifier, referrer.identifier);
    } catch (error) {
      throw new Error(`unable to resolve "${specifier}" from ${referrer.identifier}`, {
        cause: error,
      });
    }

    const resolvedPath = canonicalModulePath(resolved);
    const referrerPath = canonicalModulePath(referrer.identifier);
    if (resolvedPath !== undefined && referrerPath !== undefined) {
      // TODO this.#graph.add(referrerPath, resolvedPath);
    }

    return this.#moduleFor(resolved, attributes);
  }

  #moduleFor(url: string, attributes: ImportAttributes): Promise<Module> {
    let m = this.#moduleCache.get(url);
    if (!m) {
      m = this.#createModule(url, attributes);
      this.#moduleCache.set(url, m);
    }
    return m;
  }

  /**
   * Load the module for the given url.
   *
   * Uses the current set of transpilers to attempt to transpile the file into javascript.
   */
  async #createModule(url: string, attributes: ImportAttributes): Promise<Module> {
    const filename = canonicalModulePath(url);
    if (!filename) {
      return await this.#nativeModule(url, attributes);
    }

    const source = await this.#loadSource(filename);
    if (source === undefined) {
      return await this.#nativeModule(url, attributes);
    }

    return new vm.SourceTextModule(source, {
      identifier: url,
      context: this.#context,
      importModuleDynamically: (specifier, referrer, attributes, phase) => {
        return this.#importModuleDynamically(specifier, referrer, attributes, phase);
      },
      initializeImportMeta: (meta) => {
        meta.url = url;
        meta.filename = filename;
        meta.dirname = path.dirname(filename);
        meta.resolve = (specifier: string) => this.#resolver.resolve(specifier, url);
      },
    });
  }

  /**
   * Loads a module using the builtin import.
   */
  async #nativeModule(url: string, attributes: ImportAttributes): Promise<Module> {
    const definedAttributes = Object.fromEntries(
      Object.entries(attributes).filter((v): v is [string, string] => !!v[1]),
    );
    const namespace: Record<string, unknown> = await import(url, { with: definedAttributes });
    const exportNames = Object.keys(namespace).filter((name) => name != "module.exports");

    return new vm.SyntheticModule(
      exportNames,
      function () {
        for (const exportName of exportNames) {
          this.setExport(exportName, namespace[exportName]);
        }
      },
      {
        identifier: url,
        context: this.#context,
      },
    );
  }

  async #importModuleDynamically(
    specifier: string,
    referrer: SourceTextModule,
    attributes: ImportAttributes,
    _phase: ImportPhase,
  ) {
    const module = await this.#moduleFrom(specifier, referrer, attributes);
    if (module.status !== "evaluating") {
      await this.#link(module);
      await this.#evaluate(module);
    }
    return module;
  }

  /**
   * Link the given module.
   */
  #link(module: Module): Promise<void> {
    let promise: Promise<void>;
    switch (module.status) {
      case "unlinked":
        const lastLink = this.#linkQueue.at(-1);
        if (lastLink) {
          const run = () => {
            if (module.status !== "unlinked") {
              return;
            }

            return module.link((specifier, referrer, extra) => {
              return this.#moduleFrom(specifier, referrer, extra.attributes);
            });
          };

          // We also run if the previous link fails, so that a link chain isn't completely
          // poisoned by one bad load
          promise = lastLink.then(run, run);
        } else {
          promise = module.link((specifier, referrer, extra) => {
            return this.#moduleFrom(specifier, referrer, extra.attributes);
          });
        }

        // Important to first push the promise. If it were already resolved, we'd shift something
        // else off of the queue THEN push
        this.#linkQueue.push(promise);
        promise.finally(() => this.#linkQueue.shift());

        break;
      case "linking":
        promise = this.#linkQueue.at(-1) ?? Promise.resolve();
        break;
      case "linked":
      case "evaluating":
      case "evaluated":
        promise = Promise.resolve();
        break;
      case "errored":
        promise = Promise.reject(module.error);
        break;
    }

    return promise;
  }

  /**
   * Evaluate the given module.
   */
  #evaluate(module: Module): Promise<void> {
    let promise: Promise<void>;
    switch (module.status) {
      case "unlinked":
      case "linking":
        promise = Promise.reject();
        break;
      case "linked":
        promise = module.evaluate();
        break;
      case "evaluating": {
        const maybePromise = this.#evaluations.get(module);
        if (!maybePromise) {
          // In theory, we could create a polling promise on the status
          return Promise.reject("module's evaluation promise was lost");
        }
        promise = maybePromise;
        break;
      }
      case "evaluated":
        promise = Promise.resolve();
        break;
      case "errored":
        promise = Promise.reject(module.error);
        break;
    }

    this.#evaluations.set(module, promise);
    return promise;
  }
}

const checkModuleSupportAvailable = memoize(() => {
  return typeof vm.SourceTextModule == "function" && typeof vm.SyntheticModule == "function";
});
