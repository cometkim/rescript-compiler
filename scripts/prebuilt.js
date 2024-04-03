#!/usr/bin/env node

import * as assert from "node:assert";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import packageJson from "rescript/package_meta";

import { compilerDir, libDir, projectDir } from "./lib/paths.js"

const bsVersion = await fs.readFile(
  path.join(compilerDir, "common", "bs_version.ml"),
  "utf-8"
);

/**
 * @param {string} bsVersion
 * @param {string} version
 */
function verifyVersion(bsVersion, version) {
  try {
    let [major, minor] = bsVersion
      .split("\n")
      .find(x => x.startsWith("let version = "))
      .split("=")[1]
      .trim()
      .slice(1, -1)
      .split(".");
    let [specifiedMajor, specifiedMinor] = version.split(".");
    console.log(
      `Version check: package.json: ${specifiedMajor}.${specifiedMinor} vs ABI: ${major}.${minor}`
    );
    return major === specifiedMajor && minor === specifiedMinor;
  } catch (e) {
    return false;
  }
}

/**
 * @param {string} src
 * @param {(file: string) => boolean} filter
 * @param {string} dest
 */
async function installDirBy(src, dest, filter) {
  const files = await fs.readdir(src);
  for (const file of files) {
    if (filter(file)) {
      const x = path.join(src, file);
      const y = path.join(dest, file);
      // console.log(x, '----->', y )
      await fs.copyFile(x, y);
    }
  }
}

async function populateLibDir() {
  const runtime_dir = path.join(compilerDir, "runtime");
  const others_dir = path.join(compilerDir, "others");
  const ocaml_dir = path.join(libDir, "ocaml");
  const stdlib_dir = path.join(compilerDir, "stdlib-406");

  await fs.mkdir(ocaml_dir, { recursive: true });

  await installDirBy(runtime_dir, ocaml_dir, (file) => {
    const y = path.parse(file);
    return y.name === "js";
  });

  // for merlin or other IDE
  const installed_suffixes = [
    ".ml",
    ".mli",
    ".res",
    ".resi",
    ".cmi",
    ".cmj",
    ".cmt",
    ".cmti",
  ];
  await installDirBy(others_dir, ocaml_dir, file => {
    const y = path.parse(file);
    if (y.ext === ".cmi") {
      return !y.base.match(/Belt_internal/i);
    }
    return installed_suffixes.includes(y.ext) && !y.name.endsWith(".cppo");
  });
  await installDirBy(stdlib_dir, ocaml_dir, file => {
    const y = path.parse(file);
    return installed_suffixes.includes(y.ext);
  });
}

assert.ok(verifyVersion(bsVersion, packageJson.version));

await populateLibDir();
