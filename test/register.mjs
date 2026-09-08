import * as nodeModule from "node:module";
import { resolve } from "./alias-loader.mjs";

if (typeof nodeModule.registerHooks === "function") {
  nodeModule.registerHooks({ resolve });
} else {
  nodeModule.register("./alias-loader.mjs", import.meta.url);
}
