import * as path from "node:path";
import { fileURLToPath } from "node:url";

export {
  dirName,
  absolutePath,
  bsc_exe,
  ninja_exe,
  rescript_exe,
};

// `import.meta.filename` and `import.meta.dirname` is supported from Node.js v21
// This could be replaced after our Node.js target is updated or the API is backported.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @type {string}
 *
 * For compatibility reasons, if the architecture is x64, omit it from the bin directory name.
 * So we'll have "darwin", "linux" and "win32" for x64 arch,
 * but "darwinarm64" and "linuxarm64" for arm64 arch.
 */
const dirName =
  process.arch === "x64" ? process.platform : process.platform + process.arch;

/**
 *
 * @type {string}
 */
const absolutePath = path.join(__dirname, "..", dirName);

/**
 * @type {string}
 */
const bsc_exe = path.join(absolutePath, "bsc.exe");

/**
 * @type {string}
 */
const ninja_exe = path.join(absolutePath, "ninja.exe");

/**
 * @type {string}
 */
const rescript_exe = path.join(absolutePath, "rescript.exe");
