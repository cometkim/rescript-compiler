import * as path from "node:path";
import { fileURLToPath } from "node:url";

export {
  projectDir,
  compilerDir,
  compilerTestDir,
  buildTestDir,
  duneBinDir,
  ninjaDir,
  libDir,
  commonjsLibDir,
  esmoduleLibDIr,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const projectDir = path.join(__dirname, "..", "..");

const compilerDir = path.join(projectDir, "jscomp");

const compilerTestDir = path.join(compilerDir, "test");

const buildTestDir = path.join(compilerDir, "build_tests");

const duneBinDir = path.join(
  projectDir,
  "_build",
  "install",
  "default",
  "bin",
);

const ninjaDir = path.join(projectDir, "ninja");

const libDir = path.join(projectDir, "lib");

const commonjsLibDir = path.join(libDir, "js");

const esmoduleLibDIr = path.join(libDir, "es6");
