import { readFile } from "node:fs/promises";


/**
 * Note:
 *
 * This is replacement of `require("rescript/package.json")` in CommonJS
 *
 * We need this because importing JSON module is still experimental feature of Node.js
 *
 * This wll be replaced by `import packageJson from "rescript/package.json" with { type: "json" }` in the future.
 *
 * @type {Record<string, string>}
 */
export default JSON.parse(
  await readFile(
    new URL("../package.json", import.meta.url),
  ),
);
