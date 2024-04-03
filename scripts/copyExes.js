#!/usr/bin/env node
// Copy exes built by dune to platform bin dir

import * as path from "node:path";
import * as fs from "node:fs";
import { execSync } from "node:child_process";

import { absolutePath as platformBinDir } from "#cli/bin_path.js";
import { duneBinDir, ninjaDir } from "./lib/paths.js";

/**
 * @param {string} dir
 * @param {string} exe
 */
function copyExe(dir, exe) {
  const ext = process.platform === "win32" ? ".exe" : "";
  const src = path.join(dir, exe + ext);
  const dest = path.join(platformBinDir, exe + ".exe");

  // For some reason, the copy operation fails in Windows CI if the file already exists.
  if (process.platform === "win32" && fs.existsSync(dest)) {
    fs.rmSync(dest);
  }

  fs.copyFileSync(src, dest);

  if (process.platform !== "win32") {
    execSync(`strip ${dest}`);
  }
}

fs.mkdirSync(platformBinDir, { recursive: true });
copyExe(duneBinDir, "rescript");
copyExe(duneBinDir, "bsc");
copyExe(duneBinDir, "bsb_helper");
copyExe(ninjaDir, "ninja");
