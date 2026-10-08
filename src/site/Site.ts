import debug from "debug";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { Session } from "node:inspector/promises";
import { homedir } from "node:os";
import path from "node:path";
import pMap from "p-map";

import packageJSON from "../../package.json" with { type: "json" };
import { ConfigError } from "../errors/ConfigError.js";
import { LoadError } from "../errors/LoadError.js";
import { ModuleLoader } from "../loader/ModuleLoader.js";
import { symProcessedBy } from "../pipeline/Datum.js";
import { Datum, Pipeline, type PipelineStage } from "../pipeline/index.js";
import { FileMatcher, type FileMatcherOptions } from "../utils/FileMatcher.js";
import { Filesystem } from "../utils/Filesystem.js";
import { isNoEntryError } from "../utils/is.js";
import type { ScreenshotterOptions } from "../utils/Screenshotter.js";
import { SiteData } from "./SiteData.js";

export type DevServerOptions = {
  port: number;
  redirectsPath?: string;
};

export type SiteOptions = {
  /**
   * The directories to watch for changes, in addition to the root directory.
   *
   * If not an absolute path, paths will be relative to the root directory.
   */
  additionalWatchDirs?: readonly string[];

  /**
   * Dev server configuration.
   */
  devServer?: Partial<DevServerOptions>;

  /**
   * Optional configuration for the diff command
   *
   * The key is used as a directory to group all screenshots for a given browser.
   */
  diff?: Record<string, ScreenshotterOptions>;

  /**
   * Files to ignore.
   *
   * These ignores are used to filter out files from the site, both when building and when watching
   * for changes. Follows the gitignore spec for matching.
   *
   * @see https://git-scm.com/docs/gitignore
   */
  ignore?:
    | {
        /**
         * Files with ignore patterns to load (e.g., `.gitignore`).
         *
         * Always includes `.gitignore` and `.git/info/exclude`.
         */
        files?: readonly string[];

        /**
         * Glob patterns to ignore.
         *
         * Will always include various globs that match outputs from m8t itself including, but not limited to:
         *
         * - The `*.cpuprofile` file emitted by the `PROFILE` environment variable
         * - The site's output directory.
         * - The site's diff directory, when using the `diff` command.
         * - The site's `.git/` directory.
         * - m8t's transpile cache directory, `node_modules/.cache/m8t/`.
         */
        globs?: readonly string[];
      }
    | string[];

  /**
   * The mode the site will run in.
   */
  mode?: "development" | "production";

  /**
   * The out directory of the site.
   *
   * If not an absolute path, it will be relative to the root directory.
   *
   * @defaultValue "out"
   */
  out?: string;

  /**
   * The pipelines the site will use to process data.
   */
  pipelines: Record<string, readonly PipelineStage[]>;

  /**
   * The root directory of the site.
   */
  root?: string;

  /**
   * The static directory of the site.
   *
   * If not an absolute path, it will be relative to the root directory.
   *
   * @defaultValue "static"
   */
  static?: string;

  /**
   * Whether or not m8t should cache work to speed up pipelines during rebuilds.
   *
   * Set to `true` to have m8t choose a relevant cache directory for your system. Otherwise set to
   * a string pointing to a path that m8t can use to write cached data to.
   *
   * @defaultValue true
   */
  cache?: boolean | string;
};

/**
 * Site options with all properties resolved/defaulted.
 */
type ResolvedSiteOptions = {
  mode: "development" | "production";
  root: string;
  static: string;
  out: string;
  ignore: FileMatcher;
  pipelines: Record<string, readonly PipelineStage[]>;
  additionalWatchDirs: readonly string[];
  devServer?: Partial<DevServerOptions>;
  diff?: Record<string, ScreenshotterOptions>;
  transpileCache?: { dir: string; namespace: string };
};

/** The default port to serve the dev server on. */
const DEFAULT_PORT = 3000;

/** The filename to use for the CPU profile. */
const CPU_PROFILE_FILENAME = "profile.cpuprofile";

/** Lockfiles whose contents are mixed into the transpile cache namespace. */
const LOCKFILES = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "deno.lock"];

/** Debug logger for the site logs. */
const log = debug("m8t:site");

/**
 * A site is a collection of files and directories that are used to build a website.
 *
 * It is primarily responsible for running the various pipelines that process the site's data, but also
 * maintains various configuration that is used by the various commands.
 */
export class Site {
  /**
   * Initialize a site from a root directory.
   *
   * @param root - the root directory of the site, which should contain a `site.ts` file.
   *
   * @returns A {@link Site} instance.
   */
  static async forRoot(root: string): Promise<Site> {
    log("initializing site from %s", root);

    const sitePath = path.join(root, "site.ts");
    if (!(await isFile(sitePath))) {
      throw new LoadError(`could not find a site.ts file in ${root}`, {
        filename: sitePath,
        hint: "Run m8t from the site's root directory, or point to it with -C <path>",
      });
    }

    let siteOptions: SiteOptions;
    try {
      ({ default: siteOptions } = await import(sitePath));
    } catch (e) {
      throw new LoadError(`could not load ${sitePath}`, { cause: e, filename: sitePath });
    }

    if (typeof siteOptions !== "object" || siteOptions === null) {
      throw new ConfigError("site.ts must export site options", {
        hint: "Default-export an object of site options from site.ts",
      });
    }

    return await Site.fromOptions(root, siteOptions);
  }

  /**
   * Initial a site from a given set of options
   *
   * @param root - the root directory of the site
   * @param options - the options to initialize the site from
   *
   * @returns A {@link Site} instance.
   */
  static async fromOptions(root: string, options: SiteOptions) {
    const siteRoot = path.resolve(root, options.root || "");

    const staticRoot = path.resolve(siteRoot, options.static || "static");
    if (!staticRoot.startsWith(siteRoot)) {
      throw new ConfigError("static dir must be a subdirectory of the site root", {
        hint: `Set the \`static\` option in site.ts to a path inside ${siteRoot}`,
      });
    }

    const outRoot = path.resolve(siteRoot, options.out || "out");
    if (!outRoot.startsWith(siteRoot)) {
      throw new ConfigError("output dir must be a subdirectory of the site root", {
        hint: `Set the \`out\` option in site.ts to a path inside ${siteRoot}`,
      });
    }

    let cacheDir: string | undefined = undefined;
    switch (typeof options.cache) {
      case "undefined":
      case "boolean":
        if (options.cache !== false) {
          cacheDir = await firstThatExists(
            [process.env.XDG_CACHE_HOME, "m8t"],
            [path.join(homedir(), "Library/Caches"), "ca.gedge.m8t"], // macos
            [path.join(siteRoot, "node_modules"), ".cache/m8t"],
          );
        }
        break;
      case "string":
        if (options.cache) {
          cacheDir = path.resolve(siteRoot, options.cache);
        }
      default:
        // TODO warning
        break;
    }

    let fileMatcherOptions: FileMatcherOptions = {
      base: siteRoot,
      globs: [
        CPU_PROFILE_FILENAME,
        "out/",
        "diff/",
        ".git/",
        "_tmp_*", // Playwright emits stuff like this
        `${cacheDir}/`,
      ],
      files: [".gitignore", ".git/info/exclude"],
    };

    if (Array.isArray(options.ignore)) {
      fileMatcherOptions.globs = [...fileMatcherOptions.globs, ...options.ignore];
    } else if (typeof options.ignore === "object") {
      fileMatcherOptions = {
        ...fileMatcherOptions,
        globs: [...fileMatcherOptions.globs, ...(options.ignore.globs ?? [])],
        files: [...fileMatcherOptions.files, ...(options.ignore.files ?? [])],
      };
    }

    const mode =
      options.mode ||
      (process.env.PUBLISH && "production") ||
      (process.env.NODE_ENV == "production" && "production") ||
      "development";

    return new Site({
      root: siteRoot,
      static: staticRoot,
      out: outRoot,
      diff: options.diff,
      mode,
      additionalWatchDirs: options.additionalWatchDirs ?? [],
      ignore: await FileMatcher.fromOptions(fileMatcherOptions),
      pipelines: options.pipelines,
      devServer: options.devServer,
      transpileCache: cacheDir
        ? {
            dir: path.join(cacheDir, "transpile-cache"),
            namespace: await transpileCacheNamespace(root, mode),
          }
        : undefined,
    });
  }

  /** The root filesystem */
  readonly root: Filesystem;

  /** The filesystem for build outputs */
  readonly out: Filesystem;

  /** The filesystem under which static files are copied/served */
  readonly static: Filesystem;

  /** The files ignored when building/serving/etc */
  readonly ignoredFilesMatcher: FileMatcher;

  /**
   * The loader pipelines should use for modules
   * @internal
   */
  readonly loader: ModuleLoader;

  /**
   * The pipelines used to process site data.
   *
   * Maps a root directory to a given set of stages.
   */
  readonly pipelines: Record<string, readonly PipelineStage[]>;

  /** The directories being watched (for reloads when serving data) */
  readonly watchDirs: readonly Filesystem[];

  /** The mode this site is operating in */
  readonly mode: "development" | "production";

  /** An optional dev server configuration */
  readonly devServer: DevServerOptions | null;

  /** The filesystem under which static files are copied/served */
  readonly diff: Record<string, ScreenshotterOptions> | null;

  private constructor(options: ResolvedSiteOptions) {
    this.root = new Filesystem(options.root);
    this.out = new Filesystem(path.resolve(options.root, options.out || "./out"));
    this.static = new Filesystem(path.resolve(options.root, options.static || "./static"));

    this.mode = options.mode;
    this.pipelines = options.pipelines;
    this.ignoredFilesMatcher = options.ignore;

    this.watchDirs = [
      this.root,
      ...options.additionalWatchDirs.map((dir) => new Filesystem(path.resolve(options.root, dir))),
    ];

    this.devServer = options.devServer
      ? {
          port: options.devServer.port ?? DEFAULT_PORT,
          redirectsPath: options.devServer.redirectsPath,
        }
      : null;

    this.diff = options.diff ?? null;

    this.loader = new ModuleLoader({
      transpilers: Object.values(options.pipelines).flatMap((p) => {
        return p.flatMap((s) => s.transpilersFor?.(this) ?? []);
      }),
      cache: options.transpileCache,
    });
  }

  /**
   * Whether or not this site is operating in development mode.
   */
  get isDevelopment(): boolean {
    return this.mode === "development";
  }

  /**
   * Process all of the site's data by running it through the site's pipelines.
   *
   * Every call processes the site from scratch; nothing is cached between calls.
   *
   * @param options - `signal` stops processing when aborted.
   *
   * @returns a snapshot of the processed data.
   */
  async load(options: { signal?: AbortSignal } = {}): Promise<SiteData> {
    const { signal } = options;

    let session: Session | undefined = undefined;
    if (process.env.PROFILE) {
      session = new Session();
    }

    if (session) {
      session.connect();
      await session.post("Profiler.enable");
      await session.post("Profiler.start");
    }

    try {
      const results = await pMap(
        Object.entries(this.pipelines),
        async ([pipelineRoot, stages]) => {
          const pipeline = new Pipeline({ stages });
          const basePath = this.root.absolute(pipelineRoot);
          return await pipeline.add(
            [new Datum({ filename: basePath, basePath, [symProcessedBy]: "root" })],
            { site: this, signal },
          );
        },
        { concurrency: 4, signal },
      );
      return new SiteData(results.flat());
    } finally {
      if (session) {
        const { profile } = await session.post("Profiler.stop");
        await this.root.writeFile(CPU_PROFILE_FILENAME, JSON.stringify(profile));
        session.disconnect();
      }
    }
  }
}

/**
 * Compute a cache namespace that changes whenever transpiler output could change.
 *
 * Transpiler options (e.g., MDX plugins) are functions, so they can't be hashed directly. Instead,
 * hash `site.ts` and the lockfile, which covers changes to plugin lists and plugin versions.
 */
const transpileCacheNamespace = async (root: string, mode: string): Promise<string> => {
  const hash = createHash("sha1").update(
    JSON.stringify({
      m8t: packageJSON.version,
      node: process.version,
      // Changes which path the typescript loader takes
      typescript: process.features.typescript,
      mode,
    }),
  );

  for (const filename of [
    path.join(root, "site.ts"),
    ...LOCKFILES.map((lockfile) => path.join(root, lockfile)),
  ]) {
    try {
      const contents = await readFile(filename);
      hash.update("\0").update(filename).update("\0").update(contents);
    } catch (e) {
      if (!isNoEntryError(e)) {
        throw e;
      }
    }
  }

  return hash.digest("hex");
};

/**
 * Take the first of a set of paths that exists.
 *
 * Each argument is a pair. The first item is the path checked for existence. If it exists, it
 * is joined with the second item of the pair to form the returned path.
 *
 */
const firstThatExists = async (...paths: [path: string | undefined, subdir: string][]) => {
  for (const [pathToCheck, subdir] of paths) {
    if (!pathToCheck) {
      continue;
    }

    try {
      await stat(pathToCheck);
      return path.join(pathToCheck, subdir);
    } catch (e) {
      if (!isNoEntryError(e)) {
        throw e;
      }
    }
  }
};

const isFile = async (filename: string): Promise<boolean> => {
  try {
    return (await stat(filename)).isFile();
  } catch (e) {
    if (isNoEntryError(e)) {
      return false;
    }
    throw e;
  }
};
