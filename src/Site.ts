import debug from "debug";
import EventEmitter from "node:events";
import { Session } from "node:inspector/promises";
import path from "node:path";
import pMap from "p-map";

import { Filesystem } from "./Filesystem.js";
import { symProcessedBy } from "./pipeline/Datum.js";
import { Datum, Pipeline, type PipelineStage } from "./pipeline/index.js";
import { FileMatcher, type FileMatcherOptions } from "./utils/FileMatcher.js";
import { keyBy } from "./utils/keyBy.js";

export type SiteEventMap = {
  afterBuild: [site: Site];
};

export type DevServerOptions = {
  port: number;
  redirectsPath?: string;
};

export type SiteOptions = {
  /**
   * The mode the site will run in.
   */
  mode?: "development" | "production";

  /**
   * The root directory of the site.
   */
  root?: string;

  /**
   * The static directory of the site.
   *
   * If not an absolute path, it will be relative to the root directory.
   *
   * @default "static"
   */
  static?: string;

  /**
   * The out directory of the site.
   *
   * If not an absolute path, it will be relative to the root directory.
   *
   * @default "out"
   */
  out?: string;

  /**
   * Files to ignore.
   *
   * These ignores are used to filter out files from the site, both when building and when watching for changes.
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
         */
        globs?: readonly string[];
      }
    | string[];

  /**
   * The pipelines the site will use to process data.
   */
  pipelines: Record<string, readonly PipelineStage[]>;

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
};

/**
 * Site options with all properties resolved/defaulted.
 *
 * @private
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
};

/** The default port to serve the dev server on. */
const DEFAULT_PORT = 3000;

/** The filename to use for the CPU profile. */
const CPU_PROFILE_FILENAME = "profile.cpuprofile";

/** Debug logger for the site logs. */
const log = debug("m8t:site");

/**
 * A site is a collection of files and directories that are used to build a website.
 *
 * It is primarily responsible for running the various pipelines that process the site's data, but also
 * maintains various configuration that is used by the various commands.
 */
export class Site extends EventEmitter<SiteEventMap> {
  /**
   * Initialize a site from a root directory.
   *
   * @param root - The root directory of the site, which should contain a `site.ts` file.
   *
   * @returns A {@linkcode Site} instance.
   */
  static async forRoot(root: string): Promise<Site> {
    log("initializing site from %s", root);

    const { default: siteOptions } = (await import(path.join(root, "site.ts"))) as {
      default: SiteOptions;
    };
    if (typeof siteOptions !== "object" || siteOptions === null) {
      throw new Error("site.ts must export site options");
    }

    const siteRoot = path.resolve(root, siteOptions.root || "");
    const staticRoot = path.resolve(siteRoot, siteOptions.static || "static");
    const outRoot = path.resolve(siteRoot, siteOptions.out || "out");

    let fileMatcherOptions: FileMatcherOptions = {
      base: siteRoot,
      globs: [CPU_PROFILE_FILENAME, "out/", "diff/", ".git/"],
      files: [".gitignore", ".git/info/exclude"],
      dot: false,
    };

    if (Array.isArray(siteOptions.ignore)) {
      fileMatcherOptions.globs = [...fileMatcherOptions.globs, ...siteOptions.ignore];
    } else if (typeof siteOptions.ignore === "object") {
      fileMatcherOptions = {
        ...fileMatcherOptions,
        globs: [...fileMatcherOptions.globs, ...(siteOptions.ignore.globs ?? [])],
        files: [...fileMatcherOptions.files, ...(siteOptions.ignore.files ?? [])],
      };
    }

    return new Site({
      root: siteRoot,
      static: staticRoot,
      out: outRoot,
      mode: siteOptions.mode || (process.env.PUBLISH ? "production" : "development"),
      additionalWatchDirs: siteOptions.additionalWatchDirs ?? [],
      ignore: await FileMatcher.fromOptions(fileMatcherOptions),
      pipelines: siteOptions.pipelines,
      devServer: siteOptions.devServer,
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

  private data_: Promise<readonly Datum[]> | null = null;
  private dataByUrl_: Promise<Readonly<Record<string, Datum>>> | null = null;

  private constructor(options: ResolvedSiteOptions) {
    super({ captureRejections: true });

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
  }

  /**
   * All of the `url`s that have been processed by the site, sorted alphabetically.
   *
   * @returns a list of all the `url` properties found in the processed data.
   */
  get urls(): Promise<readonly string[]> {
    this.dataByUrl_ ??= this.data.then((data) => keyBy(data, (d) => d.maybeGetString("url") || ""));
    return this.dataByUrl_.then((dataByUrl) => Object.keys(dataByUrl).sort());
  }

  /**
   * Get data for a given url.
   *
   * @returns the datum with the given url, or `undefined` if no datum is found with the given url.
   */
  async dataByUrl(url: string): Promise<Datum | undefined> {
    this.dataByUrl_ ??= this.data.then((data) => keyBy(data, (d) => d.maybeGetString("url") || ""));
    const dataByUrl = await this.dataByUrl_;
    return dataByUrl[url];
  }

  /**
   * Whether or not this site is operating in development mode.
   */
  get isDevelopment(): boolean {
    return this.mode === "development";
  }

  /**
   * Get all processed data.
   *
   * Note that this will start processing data if it hasn't already began processing.
   */
  get data(): Promise<readonly Datum[]> {
    this.data_ ??= this.process();
    return this.data_;
  }

  /** @private */
  private async process() {
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
          const data = await pipeline.add(
            [new Datum({ filename: basePath, basePath, [symProcessedBy]: "root" })],
            {
              site: this,
              signal: AbortSignal.timeout(30_000),
            },
          );
          return data;
        },
        { concurrency: 4 },
      );
      return results.flat();
    } finally {
      if (session) {
        const { profile } = await session.post("Profiler.stop");
        await this.root.writeFile(CPU_PROFILE_FILENAME, JSON.stringify(profile));
        session.disconnect();
      }
    }
  }
}
