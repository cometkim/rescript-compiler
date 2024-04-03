//@ts-check
import * as path from "node:path";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";

import { projectDir, duneBinDir, buildTestDir } from "./lib/paths.js";
import { exec, execNpmScript } from "./lib/exec_util.js";

let ounitTest = false;
let mochaTest = false;
let bsbTest = false;
let formatTest = false;
let all = false;

if (process.argv.includes("-ounit")) {
  ounitTest = true;
}

if (process.argv.includes("-mocha")) {
  mochaTest = true;
}

if (process.argv.includes("-bsb")) {
  bsbTest = true;
}

if (process.argv.includes("-format")) {
  formatTest = true;
}

if (process.argv.includes("-all")) {
  all = true;
}

if (all) {
  ounitTest = true;
  mochaTest = true;
  bsbTest = true;
  formatTest = true;
}

if (ounitTest) {
  const ounitTestsExe = path.join(duneBinDir, "ounit_tests");
  await exec(ounitTestsExe, [], { stdio: "inherit" });
}

// running generated js tests
if (mochaTest) {
  await exec("npx", ["mocha", "-t", "10000", "jscomp/test/**/*test.js"], {
    cwd: projectDir,
    stdio: "inherit",
  });
}

// TODO: migrate it to node:test
if (bsbTest) {
  console.log("Doing build_tests");
  const files = await fs.readdir(buildTestDir);
  for (const file of files) {
    const testDir = path.join(buildTestDir, file);
    if (file === "node_modules") {
      break;
    }
    const testDirStat = await fs.lstat(testDir);
    if (!testDirStat.isDirectory()) {
      break;
    }

    if (!existsSync(path.join(testDir, "input.js"))) {
      console.warn(`input.js does not exist in ${testDir}`);
    } else {
      console.log(`testing ${file}`);

      // note existsSync test already ensure that it is a directory
      const out = await exec("node", ["input.js"], { cwd: testDir });
      console.log(out.stdout);

      if (out.code === 0) {
        console.log("✅ success in", file);
      } else {
        console.log(`❌ error in ${file} with stderr:\n`, out.stderr);
      }
    }
  }
}

if (formatTest) {
  await execNpmScript("checkFormat", [], {
    stdio: "inherit",
  });
}
