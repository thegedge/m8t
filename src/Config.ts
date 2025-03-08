import z from "zod";
import type { LoaderConstructor } from "./loaders/index.ts";
import type { RendererConstructor } from "./renderers/index.ts";

export const ConfigType = () =>
  z.object({
    outDir: z.string().default("./out"),
    pagesDir: z.string().default("./pages"),

    loaders: z.array(z.custom<LoaderConstructor>()).default([]),
    renderers: z.array(z.custom<RendererConstructor>()).default([]),

    devServer: z
      .object({
        port: z.number().default(3000),
        redirectsPath: z.string().optional(),
      })
      .default({}),
  });

export type Config = z.input<ReturnType<typeof ConfigType>>;
export type ResolvedConfig = DeepReadonly<z.output<ReturnType<typeof ConfigType>>>;

type DeepReadonly<T> =
  T extends Record<string, unknown>
    ? {
        readonly [K in keyof T]: DeepReadonly<T[K]>;
      }
    : T;
