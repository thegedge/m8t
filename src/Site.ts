import debug from "debug";
import { keyBy } from "lodash-es";
import EventEmitter from "node:events";
import { Session } from "node:inspector/promises";
import path from "node:path";
import { Filesystem } from "./Filesystem.js";
import { Datum, Pipeline, type PipelineStage } from "./pipeline/index.js";

export type SiteEventMap = {
  afterBuild: [site: Site];
};

export type DevServerOptions = {
  port: number;
  redirectsPath?: string;
};

export type SiteOptions = {
  mode?: "development" | "production";
  root: string;

  static?: string;
  out?: string;
  typesFile?: string;

  pipelines: Record<string, readonly PipelineStage[]>;
  watchDirs?: readonly string[];
  devServer?: Partial<DevServerOptions>;
};

const DEFAULT_PORT = 3000;
const log = debug("m8t:site");

export class Site extends EventEmitter<SiteEventMap> {
  static async forRoot(root: string): Promise<Site> {
    log("initializing site from %s", root);

    const { default: siteOptions } = await import(path.join(root, "site.ts"));
    if (typeof siteOptions !== "object" || siteOptions === null) {
      throw new Error("site.ts must export site options");
    }

    return new Site(siteOptions);
  }

  readonly root: Filesystem;
  readonly out: Filesystem;
  readonly static: Filesystem;

  readonly pipelines: Record<string, readonly PipelineStage[]>;
  readonly watchDirs: readonly Filesystem[];
  readonly mode: "development" | "production";
  readonly typesFile: string | null;
  readonly devServer: DevServerOptions | null;

  private data_: Promise<readonly Datum[]> | null = null;
  private dataByUrl_: Promise<Readonly<Record<string, Datum>>> | null = null;

  private constructor(options: SiteOptions) {
    super({ captureRejections: true });

    this.root = new Filesystem(options.root);
    this.out = new Filesystem(path.resolve(options.root, options.out || "./out"));
    this.static = new Filesystem(path.resolve(options.root, options.static || "./static"));
    this.typesFile = options.typesFile ? path.resolve(options.root, options.typesFile) : null;

    this.mode = options.mode || (process.env.PUBLISH ? "production" : "development");
    this.pipelines = options.pipelines;

    this.watchDirs = [
      this.root,
      ...(options.watchDirs ?? []).map((dir) => new Filesystem(path.resolve(options.root, dir))),
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
   */
  get urls(): Promise<readonly string[]> {
    this.dataByUrl_ ??= this.data.then((data) => keyBy(data, (d) => d.maybeGetString("url") || ""));
    return this.dataByUrl_.then((dataByUrl) => Object.keys(dataByUrl).sort());
  }

  async dataByUrl(url: string): Promise<Datum | undefined> {
    this.dataByUrl_ ??= this.data.then((data) => keyBy(data, (d) => d.maybeGetString("url") || ""));
    const dataByUrl = await this.dataByUrl_;
    return dataByUrl[url];
  }

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
      const results: Datum[] = [];
      for (const [pipelineRoot, stages] of Object.entries(this.pipelines)) {
        const pipeline = new Pipeline({ stages });
        const basePath = this.root.absolute(pipelineRoot);
        const data = await pipeline.add([new Datum({ filename: basePath, basePath })], {
          site: this,
          signal: AbortSignal.timeout(10_000),
        });
        results.push(...data);
      }
      return results;
    } finally {
      if (session) {
        const { profile } = await session.post("Profiler.stop");
        await this.root.writeFile("profile.cpuprofile", JSON.stringify(profile));
        session.disconnect();
      }
    }
  }

  get isDevelopment(): boolean {
    return this.mode === "development";
  }
}
