import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

import { compilerDir } from "./lib/paths.js";
import { exec } from "./lib/exec_util.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keywordsFile = path.join(compilerDir, "keywords.list");
const reservedMap = path.join(compilerDir, "ext", "js_reserved_map.ml");

const browser = await puppeteer.launch();
const page = await browser.newPage();

try {
  /**
  * @type string[]
  */
  const result = await page.evaluate(`Object.getOwnPropertyNames(window)`);

  await fs.writeFile(
    keywordsFile,
    result
      .filter(x => /^[A-Z]/.test(x))
      .sort()
      .join("\n"),
    "utf8",
  );

} finally {
  await browser.close();
}

await exec("ocaml", ["build_reserved.ml", keywordsFile, reservedMap], {
  cwd: __dirname,
});
