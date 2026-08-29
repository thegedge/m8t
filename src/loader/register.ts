import { registerHooks } from "node:module";

import { load } from "./hooks.js";

const REGISTERED_KEY = Symbol.for("m8t.loader.registered");
const globals = globalThis as { [REGISTERED_KEY]?: boolean };
if (!globals[REGISTERED_KEY]) {
  globals[REGISTERED_KEY] = true;
  registerHooks({ load });
}
