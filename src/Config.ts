import z from "zod";
import type { LoaderConstructor } from "./loaders/index.ts";
import type { RendererConstructor } from "./renderers/index.ts";
import type { PageData } from "./types.ts";

export const ConfigType = <DataT extends PageData = PageData>() =>
  z.object({
    outDir: z.string().default("./out"),
    pagesDir: z.string().default("./pages"),

    loaders: z.array(z.custom<LoaderConstructor<DataT>>()).default([]),
    renderers: z.array(z.custom<RendererConstructor<DataT>>()).default([]),

    devServer: z
      .object({
        port: z.number().default(3000),
        redirectsPath: z.string().optional(),
      })
      .default({}),
  });

export type Config<DataT extends PageData = PageData> = z.input<ReturnType<typeof ConfigType<DataT>>>;
export type ResolvedConfig<DataT extends PageData = PageData> = DeepReadonly<
  z.output<ReturnType<typeof ConfigType<DataT>>>
>;

type DeepReadonly<T> =
  T extends Record<string, unknown>
    ? {
        readonly [K in keyof T]: DeepReadonly<T[K]>;
      }
    : T;
