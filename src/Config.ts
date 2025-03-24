import z from "zod";
import type { ProcessorConstructor } from "./processors/index.ts";

export const ConfigType = () =>
  z.object({
    outDir: z.string().default("./out"),
    pagesDir: z.string().default("./pages"),
    staticDir: z.string().default("./static"),

    processors: z.array(z.custom<ProcessorConstructor>()).default([]),

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
