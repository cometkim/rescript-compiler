#!/usr/bin/env node

import * as assert from "node:assert";
import * as os from "node:os";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import * as cp from "node:child_process";
import { fileURLToPath } from "node:url";

import * as binPath from "#cli/bin_path.js";

import { exec } from "./lib/exec_util.js";
import {
  compilerDir,
  compilerTestDir,
  commonjsLibDir,
  libDir,
  projectDir,
} from "./lib/paths.js";

export {
  vendorNinjaPath,
  updateDev,
  updateRelease,
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runtimeDir = path.join(compilerDir, "runtime");
const othersDir = path.join(compilerDir, "others");

const runtimeFiles = await fs.readdir(runtimeDir, "ascii");
const runtimeMlFiles = runtimeFiles.filter(
  x =>
    !x.startsWith("bs_stdlib_mini") &&
    (x.endsWith(".ml") || x.endsWith(".res")) &&
    x !== "js.ml"
);
const runtimeMliFiles = runtimeFiles.filter(
  x =>
    !x.startsWith("bs_stdlib_mini") &&
    (x.endsWith(".mli") || x.endsWith(".resi")) &&
    x !== "js.mli"
);
const runtimeSourceFiles = runtimeMlFiles.concat(runtimeMliFiles);
const runtimeJsFiles = [...new Set(runtimeSourceFiles.map(baseName))];

const commonBsFlags = `-no-keep-locs -no-alias-deps -bs-no-version-header -bs-no-check-div-by-zero -nostdlib `;
const js_package = pseudoTarget("js_pkg");
const runtimeTarget = pseudoTarget("runtime");
const othersTarget = pseudoTarget("others");
const stdlibTarget = pseudoTarget("$stdlib");
const my_target = binPath.absolutePath;
const bsc_exe = binPath.bsc_exe;
const vendorNinjaPath = binPath.ninja_exe;

/**
 * By default we use vendored,
 * we produce two ninja files which won't overlap
 * one is build.ninja which use  vendored config
 * the other is env.ninja which use binaries from environment
 *
 * In dev mode, files generated for vendor config
 *
 * build.ninja
 * runtime/build.ninja
 * others/build.ninja
 * $stdlib/build.ninja
 * test/build.ninja
 *
 * files generated for env config
 *
 * env.ninja
 * compilerEnv.ninja (no snapshot since env can not provide snapshot)
 * runtime/env.ninja
 * others/env.ninja
 * $stdlib/env.ninja
 * test/env.ninja
 *
 * In release mode:
 *
 * release.ninja
 * runtime/release.ninja
 * others/release.ninja
 * $stdlib/release.ninja
 *
 * Like that our snapshot is so robust that
 * we don't do snapshot in CI, we don't
 * need do test build in CI either
 *
 */

/**
 * @type {string}
 */
let versionString = undefined;

/**
 * @returns {string}
 */
function getVersionString() {
  if (versionString === undefined) {
    const searcher = "version";
    try {
      const output = cp.execSync(`ocamldep.opt -version`, {
        encoding: "ascii",
      });
      versionString = output
        .substring(output.indexOf(searcher) + searcher.length)
        .trim();
    } catch (err) {
      console.error(`This error probably came from that you don't have OCaml installed.
Make sure you have the OCaml compiler available in your path.`);
      console.error(err.message);
      process.exit(err.status);
    }
  }
  return versionString;
};

/**
 * @param {string} ninjaCwd
 */
function ruleCC(ninjaCwd) {
  return `
rule cc
    command = $bsc -bs-cmi -bs-cmj $bsc_flags   -I ${ninjaCwd}  $in
    description = $in -> $out
rule cc_cmi
    command = $bsc -bs-read-cmi -bs-cmi -bs-cmj $bsc_flags  -I ${ninjaCwd}  $in
    description = $in -> $out    
`;
}
/**
 * @param {string} name
 * @param {string} content
 */
async function writeFileAscii(name, content) {
  await fs.writeFile(name, content, "ascii");
}

/**
 * @typedef {{ kind: "file", name: string } | { kind: "pseudo", name: string }} Target
 * @typedef {{ key: string, value: string }} Override
 * @typedef {Target[]} Targets
 * @typedef {Map<string, TargetSet>} DepsMap
 */

class TargetSet {
  /**
   * @param {Targets} [xs=[]]
   */
  constructor(xs = []) {
    this.data = xs;
  }

  /**
   * @param {Target} x
   */
  add(x) {
    const data = this.data;
    let found = false;
    for (let i = 0; i < data.length; ++i) {
      const cur = data[i];
      if (cur.kind === x.kind && cur.name === x.name) {
        found = true;
        break;
      }
    }
    if (!found) {
      this.data.push(x);
    }
    return this;
  }

  /**
   * @returns {Targets} a copy
   */
  toSortedArray() {
    const newData = this.data.slice();
    newData.sort((x, y) => {
      const kindx = x.kind;
      const kindy = y.kind;
      if (kindx > kindy) {
        return 1;
      } else if (kindx < kindy) {
        return -1;
      } else {
        if (x.name > y.name) {
          return 1;
        } else if (x.name < y.name) {
          return -1;
        } else {
          return 0;
        }
      }
    });
    return newData;
  }

  /**
   * @param {(item: Target) => void} callback
   */
  forEach(callback) {
    this.data.forEach(callback);
  }
}

/**
 * @param {string} target
 * @param {string} dependency
 * @param {DepsMap} depsMap
 */
function updateDepsKVByFile(target, dependency, depsMap) {
  const singleton = fileTarget(dependency);
  if (depsMap.has(target)) {
    depsMap.get(target).add(singleton);
  } else {
    depsMap.set(target, new TargetSet([singleton]));
  }
}

/**
 * @param {string} s
 */
function uncapitalize(s) {
  if (s.length === 0) {
    return s;
  }
  return s[0].toLowerCase() + s.slice(1);
}

/**
 * @param {string} target
 * @param {string[]} dependencies
 * @param {DepsMap} depsMap
 */
function updateDepsKVsByFile(target, dependencies, depsMap) {
  const targets = fileTargets(dependencies);
  if (depsMap.has(target)) {
    var s = depsMap.get(target);
    for (var i = 0; i < targets.length; ++i) {
      s.add(targets[i]);
    }
  } else {
    depsMap.set(target, new TargetSet(targets));
  }
}

/**
 * @param {string} target
 * @param {string[]} modules
 * @param {DepsMap} depsMap
 */
function updateDepsKVsByModule(target, modules, depsMap) {
  if (depsMap.has(target)) {
    const s = depsMap.get(target);
    for (const module of modules) {
      const filename = uncapitalize(module);
      const filenameAsCmi = filename + ".cmi";
      const filenameAsCmj = filename + ".cmj";
      if (target.endsWith(".cmi")) {
        if (depsMap.has(filenameAsCmi) || depsMap.has(filenameAsCmj)) {
          s.add(fileTarget(filenameAsCmi));
        }
      } else if (target.endsWith(".cmj")) {
        if (depsMap.has(filenameAsCmj)) {
          s.add(fileTarget(filenameAsCmj));
        } else if (depsMap.has(filenameAsCmi)) {
          s.add(fileTarget(filenameAsCmi));
        }
      }
    }
  }
}

/**
 * @param {string[]}sources
 * @return {DepsMap}
 */
function createDepsMapWithTargets(sources) {
  /**
   * @type {DepsMap}
   */
  const depsMap = new Map();
  for (const source of sources) {
    const target = sourceToTarget(source);
    depsMap.set(target, new TargetSet([]));
  }
  depsMap.forEach((set, name) => {
    /**
     * @type {string}
     */
    let cmiFile;
    if (
      name.endsWith(".cmj") &&
      depsMap.has((cmiFile = replaceExt(name, ".cmi")))
    ) {
      set.add(fileTarget(cmiFile));
    }
  });
  return depsMap;
}

/**
 * @param {Target} file
 * @param {string} cwd
 */
function targetToString(file, cwd) {
  switch (file.kind) {
    case "file":
      return path.join(cwd, file.name);
    case "pseudo":
      return file.name;
    default:
      throw new Error();
  }
}

/**
 * @param {Targets} files
 * @param {string} cwd
 *
 * @returns {string} return a string separated with whitespace
 */
function targetsToString(files, cwd) {
  return files.map(x => targetToString(x, cwd)).join(" ");
}

/**
 * @param {Targets} outputs
 * @param {Targets} inputs
 * @param {Targets} deps
 * @param {Override[]} overrides
 * @param {string} rule
 * @param {string} cwd
 * @return {string}
 */
function ninjaBuild(outputs, inputs, rule, deps, cwd, overrides) {
  const fileOutputs = targetsToString(outputs, cwd);
  const fileInputs = targetsToString(inputs, cwd);
  let stmt = `o ${fileOutputs} : ${rule} ${fileInputs}`;
  if (deps.length > 0) {
    var fileDeps = targetsToString(deps, cwd);
    stmt += ` | ${fileDeps}`;
  }
  if (overrides.length > 0) {
    stmt +=
      `\n` +
      overrides
        .map(x => {
          return `    ${x.key} = ${x.value}`;
        })
        .join("\n");
  }
  return stmt;
}

/**
 * @param {Target} outputs
 * @param {Targets} inputs
 * @param {string} cwd
 */
function phony(outputs, inputs, cwd) {
  return ninjaBuild([outputs], inputs, "phony", [], cwd, []);
}

/**
 * @param {string | string[]} outputs
 * @param {string | string[]} inputs
 * @param {string | string[]} fileDeps
 * @param {string} rule
 * @param {string} cwd
 * @param {[string,string][]} overrides
 * @param {Target | Targets} extraDeps
 */
function ninjaQuickBuild(
  outputs,
  inputs,
  rule,
  cwd,
  overrides,
  fileDeps,
  extraDeps
) {
  const os = Array.isArray(outputs)
    ? fileTargets(outputs)
    : [fileTarget(outputs)];
  const is = Array.isArray(inputs) ? fileTargets(inputs) : [fileTarget(inputs)];
  const ds = Array.isArray(fileDeps)
    ? fileTargets(fileDeps)
    : [fileTarget(fileDeps)];
  const dds = Array.isArray(extraDeps) ? extraDeps : [extraDeps];

  return ninjaBuild(
    os,
    is,
    rule,
    ds.concat(dds),
    cwd,
    overrides.map(x => {
      return { key: x[0], value: x[1] };
    }),
  );
}

/**
 * @typedef {string | string[]} Strings
 * @typedef {[string, string]} KV
 * @typedef {[Strings, Strings, string, string, KV[], Strings, (Target | Targets)]} BuildList
 * @param {BuildList[]} xs
 * @returns {string}
 */
function ninjaQuickBuildList(xs) {
  return xs
    .map(x => ninjaQuickBuild(x[0], x[1], x[2], x[3], x[4], x[5], x[6]))
    .join("\n");
}

/**
 * @typedef {[string, string, string?]} CppoInput
 * @param {CppoInput[]} xs
 * @param {string} cwd
 * @returns {string}
 */
function cppoList(cwd, xs) {
  return xs
    .map(x => {
      /**
       * @type {KV[]}
       */
      let variables;
      if (x[2]) {
        variables = [["type", `-D ${x[2]}`]];
      } else {
        variables = [];
      }
      return ninjaQuickBuild(x[0], x[1], cppoRuleName, cwd, variables, [], []);
    })
    .join("\n");
}
/**
 * @param {string} cwd
 * @param {string[]} xs
 * @returns {string}
 */
function mllList(cwd, xs) {
  return xs
    .map(x => {
      const output = baseName(x) + ".ml";
      return ninjaQuickBuild(output, x, mllRuleName, cwd, [], [], []);
    })
    .join("\n");
}

/**
 * @param {string} name
 * @returns {Target}
 */
function fileTarget(name) {
  return { kind: "file", name };
}

/**
 * @param {string} name
 * @returns {Target}
 */
function pseudoTarget(name) {
  return { kind: "pseudo", name };
}

/**
 * @param {string[]} args
 * @returns {Targets}
 */
function fileTargets(args) {
  return args.map(name => fileTarget(name));
}

/**
 * @param {string[]} outputs
 * @param {string[]} inputs
 * @param {DepsMap} depsMap
 * @param {Override[]} overrides
 * @param {Targets} extraDeps
 * @param {string} rule
 * @param {string} cwd
 */
function buildStmt(outputs, inputs, rule, depsMap, cwd, overrides, extraDeps) {
  const os = outputs.map(fileTarget);
  const is = inputs.map(fileTarget);
  const deps = new TargetSet();
  for (let i = 0; i < outputs.length; ++i) {
    const curDeps = depsMap.get(outputs[i]);
    if (curDeps !== undefined) {
      curDeps.forEach(x => deps.add(x));
    }
  }
  extraDeps.forEach(x => deps.add(x));
  return ninjaBuild(os, is, rule, deps.toSortedArray(), cwd, overrides);
}

/**
 * @param {string} x
 */
function replaceCmj(x) {
  return x.trim().replace("cmx", "cmj");
}

/**
 * @param {string} y
 */
function sourceToTarget(y) {
  if (y.endsWith(".ml") || y.endsWith(".res")) {
    return replaceExt(y, ".cmj");
  } else if (y.endsWith(".mli") || y.endsWith(".resi")) {
    return replaceExt(y, ".cmi");
  }
  return y;
}

/**
 * Note `bsdep.exe` does not need post processing and -one-line flag
 * By default `ocamldep.opt` only list dependencies in its args
 *
 * @param {string[]} files
 * @param {string} dir
 * @param {DepsMap} depsMap
 * @return {Promise<void>}
 */
async function ocamlDepForBscAsync(files, dir, depsMap) {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "resToMl"));
  try {
    const mlfiles = []; // convert .res files to temporary .ml files in tmpdir
    for (const file of files) {
      const { name, ext } = path.parse(file);
      if (ext === ".res" || ext === ".resi") {
        const mlname = ext === ".resi" ? name + ".mli" : name + ".ml";
        try {
          const mlfile = path.join(tmpdir, mlname);
          const { stderr } = await exec(bsc_exe, ["-dsource", "-only-parse", "-bs-no-builtin-ppx", file], {
            cwd: dir,
            encoding: "ascii",
          });
          if (stderr) {
            await writeFileAscii(mlfile, stderr);
          }
          mlfiles.push(mlfile);
        } catch (err) {
          console.log(err);
        }
      }
    }

    const minusI = tmpdir == null ? "" : `-I ${tmpdir}`;

    const { stdout } = await exec(
      "ocamldep.opt",
      ["-allow-approx", "-one-line", minusI, "-native", ...files, ...mlfiles],
      {
        cwd: dir,
        encoding: "ascii",
      },
    );

    const pairs = stdout.split("\n").map(x => x.split(":"));
    for (const pair of pairs) {
      let deps;
      const source = replaceCmj(path.basename(pair[0]));
      if (pair[1] !== undefined && (deps = pair[1].trim())) {
        deps = deps.split(" ");
        updateDepsKVsByFile(
          source,
          deps.map(x => replaceCmj(path.basename(x))),
          depsMap,
        );
      }
    }
  } finally {
    await fs.rm(tmpdir, { recursive: true, force: true });
  }
}

/**
 * Note `bsdep.exe` does not need post processing and -one-line flag
 * By default `ocamldep.opt` only list dependencies in its args
 *
 * @param {string[]} files
 * @param {string} dir
 * @param {DepsMap} depsMap
 * @return {Promise<void>}
 */
async function depModulesForBscAsync(files, dir, depsMap) {
  const resFiles = files.filter(x => x.endsWith(".res") || x.endsWith(".resi"));
  const ocamlFiles = files.filter(x => x.endsWith(".ml") || x.endsWith(".mli"));

  const { stdout } = await exec(
    bsc_exe,
    ["-modules", "-bs-syntax-only", ...resFiles, ...ocamlFiles],
    {
      cwd: dir,
      encoding: "ascii",
    },
  );

  const pairs = stdout.split("\n").map(x => x.split(":"));
  for (const pair of pairs) {
    let modules;
    let source = sourceToTarget(pair[0].trim());
    if (pair[1] !== undefined && (modules = pair[1].trim())) {
      modules = modules.split(" ");
      updateDepsKVsByModule(source, modules, depsMap);
    }
  }
}

/**
 * We make a set to ensure that `sourceFiles` are not duplicated
 *
 * @typedef {('HAS_ML' | 'HAS_MLI' | 'HAS_BOTH' | 'HAS_RES' | 'HAS_RESI' | 'HAS_BOTH_RES')} FileInfo
 * @param {string[]} sourceFiles
 * @returns {Map<string, FileInfo>}
 */
function collectTarget(sourceFiles) {
  /**
   * @type {Map<string,FileInfo>}
   */
  const allTargets = new Map();
  sourceFiles.forEach(x => {
    const { ext, name } = path.parse(x);
    const existExt = allTargets.get(name);
    if (existExt === undefined) {
      if (ext === ".ml") {
        allTargets.set(name, "HAS_ML");
      } else if (ext === ".mli") {
        allTargets.set(name, "HAS_MLI");
      } else if (ext === ".res") {
        allTargets.set(name, "HAS_RES");
      } else if (ext === ".resi") {
        allTargets.set(name, "HAS_RESI");
      }
    } else {
      switch (existExt) {
        case "HAS_ML":
          if (ext === ".mli") {
            allTargets.set(name, "HAS_BOTH");
          }
          break;
        case "HAS_RES":
          if (ext === ".resi") {
            allTargets.set(name, "HAS_BOTH_RES");
          }
          break;
        case "HAS_MLI":
          if (ext === ".ml") {
            allTargets.set(name, "HAS_BOTH");
          }
          break;
        case "HAS_RESI":
          if (ext === ".res") {
            allTargets.set(name, "HAS_BOTH_RES");
          }
          break;
        case "HAS_BOTH":
        case "HAS_BOTH_RES":
          break;
      }
    }
  });
  return allTargets;
}

/**
 * @param {Map<string, FileInfo>} allTargets
 * @param {string[]} collIn
 * @returns {string[]} A new copy which is
 */
function scanFileTargets(allTargets, collIn) {
  const coll = collIn.slice();
  allTargets.forEach((ext, mod) => {
    switch (ext) {
      case "HAS_RESI":
      case "HAS_MLI":
        coll.push(`${mod}.cmi`);
        break;
      case "HAS_BOTH_RES":
      case "HAS_BOTH":
        coll.push(`${mod}.cmi`, `${mod}.cmj`);
        break;
      case "HAS_RES":
      case "HAS_ML":
        coll.push(`${mod}.cmi`, `${mod}.cmj`);
        break;
    }
  });
  return coll;
}

/**
 * @param {DepsMap} depsMap
 * @param {Map<string,string>} allTargets
 * @param {string} cwd
 * @param {Targets} [extraDeps=[]]
 * @return {string[]}
 */
function generateNinja(depsMap, allTargets, cwd, extraDeps = []) {
  /**
   * @type {string[]}
   */
  const build_stmts = [];
  allTargets.forEach((x, mod) => {
    const output_cmj = mod + ".cmj";
    const output_cmi = mod + ".cmi";
    const input_ml = mod + ".ml";
    const input_mli = mod + ".mli";
    const input_res = mod + ".res";
    const input_resi = mod + ".resi";
    /**
     * @type {Override[]}
     */
    const overrides = [];
    /**
     * @param {string[]} outputs
     * @param {string[]} inputs
     * @param {string} [rule="cc"]
     */
    const mk = (outputs, inputs, rule = "cc") => {
      return build_stmts.push(
        buildStmt(outputs, inputs, rule, depsMap, cwd, overrides, extraDeps),
      );
    };
    switch (x) {
      case "HAS_BOTH":
        mk([output_cmj], [input_ml], "cc_cmi");
        mk([output_cmi], [input_mli]);
        break;
      case "HAS_BOTH_RES":
        mk([output_cmj], [input_res], "cc_cmi");
        mk([output_cmi], [input_resi]);
        break;
      case "HAS_RES":
        mk([output_cmi, output_cmj], [input_res]);
        break;
      case "HAS_ML":
        mk([output_cmi, output_cmj], [input_ml]);
        break;
      case "HAS_RESI":
        mk([output_cmi], [input_resi]);
        break;
      case "HAS_MLI":
        mk([output_cmi], [input_mli]);
        break;
    }
  });
  return build_stmts;
}

const BSC_COMPILER = `bsc = ${bsc_exe}`;

async function runtimeNinja(devmode = true) {
  const ninjaCwd = "runtime";
  const compilerTarget = pseudoTarget("$bsc");
  const externalDeps = devmode ? [compilerTarget] : [];
  const ninjaOutput = devmode ? "build.ninja" : "release.ninja";
  const templateRuntimeRules = `
bsc_no_open_flags =  ${commonBsFlags} -bs-cross-module-opt -make-runtime  -nopervasives  -unsafe -w +50 -warn-error A
bsc_flags = $bsc_no_open_flags -open Bs_stdlib_mini
${ruleCC(ninjaCwd)}
${ninjaQuickBuildList([
  [
    "bs_stdlib_mini.cmi",
    "bs_stdlib_mini.resi",
    "cc",
    ninjaCwd,
    [["bsc_flags", "-nostdlib -nopervasives"]],
    [],
    externalDeps,
  ],
  [
    ["js.cmj", "js.cmi"],
    "js.ml",
    "cc",
    ninjaCwd,
    [["bsc_flags", "$bsc_no_open_flags"]],
    [],
    externalDeps,
  ],
])}
`;
  /**
   * @type {DepsMap}
   */
  const depsMap = new Map();
  const allTargets = collectTarget([...runtimeMliFiles, ...runtimeMlFiles]);
  const manualDeps = ["bs_stdlib_mini.cmi", "js.cmj", "js.cmi"];
  const allFileTargetsInRuntime = scanFileTargets(allTargets, manualDeps);
  allTargets.forEach((ext, mod) => {
    switch (ext) {
      case "HAS_MLI":
      case "HAS_BOTH":
      case "HAS_RESI":
      case "HAS_BOTH_RES":
        updateDepsKVsByFile(mod + ".cmi", manualDeps, depsMap);
        break;
      case "HAS_ML":
      case "HAS_RES":
        updateDepsKVsByFile(mod + ".cmj", manualDeps, depsMap);
        break;
    }
  });
  // FIXME: in dev mode, it should not rely on reading js file
  // since it may cause a bootstrapping issues
  await Promise.all([
    runJSCheckAsync(depsMap),
    ocamlDepForBscAsync(runtimeSourceFiles, runtimeDir, depsMap),
  ]);
  const stmts = generateNinja(depsMap, allTargets, ninjaCwd, externalDeps);
  stmts.push(
    phony(runtimeTarget, fileTargets(allFileTargetsInRuntime), ninjaCwd)
  );
  await writeFileAscii(
    path.join(runtimeDir, ninjaOutput),
    templateRuntimeRules + stmts.join("\n") + "\n"
  );
}

const cppoRuleName = "cppo";
const cppoRule = (flags = "") => `
rule ${cppoRuleName}
    command = cppo -V OCAML:${getVersionString()} ${flags} $type $in -o $out
    generator = true
`;

const mllRuleName = "mll";
const mllRule = `
rule ${mllRuleName}
    command = $ocamllex $in
    generator = true
`;

async function othersNinja(devmode = true) {
  const compilerTarget = pseudoTarget("$bsc");
  const externalDeps = [
    compilerTarget,
    fileTarget("belt_internals.cmi"),
    fileTarget("js.cmi"),
  ];
  const ninjaOutput = devmode ? "build.ninja" : "release.ninja";
  const ninjaCwd = "others";

  const templateOthersRules = `
bsc_primitive_flags =  ${commonBsFlags} -bs-cross-module-opt -make-runtime   -nopervasives  -unsafe  -w +50 -warn-error A
bsc_flags = $bsc_primitive_flags -open Belt_internals
${ruleCC(ninjaCwd)}
${ninjaQuickBuildList([
  [
    ["belt.cmj", "belt.cmi"],
    "belt.res",
    "cc",
    ninjaCwd,
    [["bsc_flags", "$bsc_primitive_flags"]],
    [],
    [compilerTarget],
  ],
  [
    ["js.cmj", "js.cmi"],
    "js.ml",
    "cc",
    ninjaCwd,
    [["bsc_flags", "$bsc_primitive_flags"]],
    [],
    [compilerTarget],
  ],
  [
    ["belt_internals.cmi"],
    "belt_internals.resi",
    "cc",
    ninjaCwd,
    [["bsc_flags", "$bsc_primitive_flags"]],
    [],
    [compilerTarget],
  ],
])}
`;
  const othersDirFiles = await fs.readdir(othersDir, "ascii");
  const jsPrefixSourceFiles = othersDirFiles.filter(
    x =>
      x.startsWith("js") &&
      (x.endsWith(".ml") ||
        x.endsWith(".mli") ||
        x.endsWith(".res") ||
        x.endsWith(".resi")) &&
      !x.includes(".cppo") &&
      !x.includes(".pp") &&
      !x.includes("#") &&
      x !== "js.ml"
  );
  const othersFiles = othersDirFiles.filter(
    x =>
      !x.startsWith("js") &&
      x !== "belt.res" &&
      x !== "belt_internals.resi" &&
      (x.endsWith(".ml") ||
        x.endsWith(".mli") ||
        x.endsWith(".res") ||
        x.endsWith(".resi")) &&
      !x.includes("#") &&
      !x.includes(".cppo")
  );
  const jsTargets = collectTarget(jsPrefixSourceFiles);
  const allJsTargets = scanFileTargets(jsTargets, []);
  const jsDepsMap = new Map();
  const depsMap = new Map();
  await Promise.all([
    ocamlDepForBscAsync(jsPrefixSourceFiles, othersDir, jsDepsMap),
    ocamlDepForBscAsync(othersFiles, othersDir, depsMap),
  ]);
  const jsOutput = generateNinja(jsDepsMap, jsTargets, ninjaCwd, externalDeps);
  jsOutput.push(phony(js_package, fileTargets(allJsTargets), ninjaCwd));

  // Note compiling belt.ml still try to read
  // belt_xx.cmi we need enforce the order to
  // avoid data race issues
  const beltPackage = fileTarget("belt.cmi");
  const beltTargets = collectTarget(othersFiles);
  depsMap.forEach((s, k) => {
    if (k.startsWith("belt")) {
      s.add(beltPackage);
    }
    s.add(js_package);
  });
  const allOthersTarget = scanFileTargets(beltTargets, []);
  const beltOutput = generateNinja(depsMap, beltTargets, ninjaCwd, externalDeps);
  beltOutput.push(phony(othersTarget, fileTargets(allOthersTarget), ninjaCwd));
  await writeFileAscii(
    path.join(othersDir, ninjaOutput),
    templateOthersRules +
      jsOutput.join("\n") +
      "\n" +
      beltOutput.join("\n") +
      "\n",
  );
}

/**
 * generate build.ninja/release.ninja for stdlib-402
 *
 * @param {boolean} [devmode=true]
 */
async function stdlibNinja(devmode = true) {
  const stdlibVersion = "stdlib-406";
  const ninjaCwd = stdlibVersion;
  const stdlibDir = path.join(compilerDir, stdlibVersion);
  const compilerTarget = pseudoTarget("$bsc");
  const externalDeps = [compilerTarget, othersTarget];
  const ninjaOutput = devmode ? "build.ninja" : "release.ninja";
  const bsc_flags = "bsc_flags";
  /**
   * @type [string,string][]
   */
  const bsc_builtin_overrides = [[bsc_flags, `$${bsc_flags} -nopervasives`]];
  // It is interesting `-w -a` would generate not great code sometimes
  // deprecations diabled due to string_of_float
  const warnings = "-w -9-3-106 -warn-error A";
  const templateStdlibRules = `
${bsc_flags} = ${commonBsFlags} -bs-cross-module-opt -make-runtime ${warnings} -I others
${ruleCC(ninjaCwd)}
${ninjaQuickBuildList([
  // we make it still depends on external
  // to enjoy free ride on dev config for compiler-deps
  [
    "pervasives.cmj",
    "pervasives.res",
    "cc_cmi",
    ninjaCwd,
    bsc_builtin_overrides,
    "pervasives.cmi",
    externalDeps,
  ],
  [
    "pervasives.cmi",
    "pervasives.resi",
    "cc",
    ninjaCwd,
    bsc_builtin_overrides,
    [],
    externalDeps,
  ],
])}
`;
  const stdlibDirFiles = await fs.readdir(stdlibDir, "ascii");
  const sources = stdlibDirFiles.filter(x => {
    return (
      !x.startsWith("pervasives.") &&
      (x.endsWith(".res") || x.endsWith(".resi"))
    );
  });

  const depsMap = new Map();
  await ocamlDepForBscAsync(sources, stdlibDir, depsMap);

  const targets = collectTarget(sources);
  const allTargets = scanFileTargets(targets, [
    "pervasives.cmi",
    "pervasives.cmj",
  ]);
  targets.forEach((ext, mod) => {
    switch (ext) {
      case "HAS_MLI":
      case "HAS_BOTH":
      case "HAS_RESI":
      case "HAS_BOTH_RES":
        updateDepsKVByFile(mod + ".cmi", "pervasives.cmj", depsMap);
        break;
      case "HAS_ML":
      case "HAS_RES":
        updateDepsKVByFile(mod + ".cmj", "pervasives.cmj", depsMap);
        break;
    }
  });
  const output = generateNinja(depsMap, targets, ninjaCwd, externalDeps);
  output.push(phony(stdlibTarget, fileTargets(allTargets), ninjaCwd));

  await writeFileAscii(
    path.join(stdlibDir, ninjaOutput),
    templateStdlibRules + output.join("\n") + "\n"
  );
}

/**
 * @param {string} text
 */
function getDeps(text) {
  /**
   * @type {string[]}
   */
  const deps = [];
  text.replace(
    /(\/\*[\w\W]*?\*\/|\/\/[^\n]*|[.$]r)|\brequire\s*\(\s*["']([^"']*)["']\s*\)/g,
    (_, ignore, id) => {
      if (!ignore) deps.push(id);
      return ""; // TODO: examine the regex
    }
  );
  return deps;
}

/**
 * @param {string} x
 * @param {string} newExt
 * @example
 *
 * ```js
 * replaceExt('xx.cmj', '.a') // return 'xx.a'
 * ```
 *
 */
function replaceExt(x, newExt) {
  const index = x.lastIndexOf(".");
  if (index < 0) {
    return x;
  }
  return x.slice(0, index) + newExt;
}
/**
 * @param {string} x
 */
function baseName(x) {
  return x.substring(0, x.indexOf("."));
}

/**
 * @returns {Promise<void>}
 */
async function testNinja() {
  const ninjaOutput = "build.ninja";
  const ninjaCwd = `test`;
  const templateTestRules = `
bsc_flags = -bs-cross-module-opt -make-runtime-test -bs-package-output commonjs:jscomp/test  -w -3-6-26-27-29-30-32..40-44-45-52-60-9-106+104 -warn-error A  -I runtime -I $stdlib -I others
${ruleCC(ninjaCwd)}


${mllRule}
${mllList(ninjaCwd, [
  "arith_lexer.mll",
  "number_lexer.mll",
  "simple_lexer_test.mll",
])}
`;
  const testDirFiles = await fs.readdir(compilerTestDir, "ascii");
  const sources = testDirFiles.filter(x => {
    return (
      x.endsWith(".resi") ||
      x.endsWith(".res") ||
      x.endsWith(".ml") ||
      x.endsWith(".mli")
    );
  });

  const depsMap = createDepsMapWithTargets(sources);
  await depModulesForBscAsync(sources, compilerTestDir, depsMap);

  const targets = collectTarget(sources);
  const output = generateNinja(depsMap, targets, ninjaCwd, [
    runtimeTarget,
    stdlibTarget,
    pseudoTarget("$bsc"),
  ]);
  output.push(
    phony(
      pseudoTarget("test"),
      fileTargets(scanFileTargets(targets, [])),
      ninjaCwd
    )
  );
  await writeFileAscii(
    path.join(compilerTestDir, ninjaOutput),
    templateTestRules + output.join("\n") + "\n"
  );
}

/**
 * @param {DepsMap} depsMap
 * @return {Promise<number>}
 */
async function runJSCheckAsync(depsMap) {
  let count = 0;
  let skip = false;
  const tasks = runtimeJsFiles.length;
  const updateTick = () => {
    count++;
    if (count === tasks) {
      skip = true;
    }
  };
  for (const name of runtimeJsFiles) {
    if (skip) break;

    const jsFile = path.join(commonjsLibDir, name + ".js");
    try {
      const fileContent = await fs.readFile(jsFile, "utf8");
      const deps = getDeps(fileContent).map(x => path.parse(x).name + ".cmj");
      const exists = existsSync(path.join(runtimeDir, name + ".mli"));
      if (exists) {
        deps.push(name + ".cmi");
      }
      updateDepsKVsByFile(`${name}.cmj`, deps, depsMap);
      updateTick();
    } catch {
      updateTick();
    }
  }
  return count;
}

function checkEffect() {
  const jsPaths = runtimeJsFiles.map(x => path.join(commonjsLibDir, x + ".js"));
  const effect = jsPaths
    .map(x => {
      return {
        file: x,
        content: fs.readFileSync(x, "utf8"),
      };
    })
    .map(({ file, content: x }) => {
      if (/No side effect|This output is empty/.test(x)) {
        return {
          file,
          effect: "pure",
        };
      } else if (/Not a pure module/.test(x)) {
        return {
          file,
          effect: "false",
        };
      } else {
        return {
          file,
          effect: "unknown",
        };
      }
    })
    .filter(({ effect }) => effect !== "pure")
    .map(({ file, effect }) => {
      return { file: path.basename(file), effect };
    });

  const black_list = new Set(["caml_lexer.js", "caml_parser.js"]);

  assert.ok(
    effect.length === black_list.size &&
      effect.every(x => black_list.has(x.file)),
  );

  console.log(effect);
}

async function updateRelease() {
  await runtimeNinja(false);
  await stdlibNinja(false);
  await othersNinja(false);
}

async function updateDev() {
  await writeFileAscii(
    path.join(compilerDir, "build.ninja"),
    `
stdlib = stdlib-406
${BSC_COMPILER}
ocamllex = ocamllex.opt
subninja runtime/build.ninja
subninja others/build.ninja
subninja $stdlib/build.ninja
subninja test/build.ninja
o all: phony runtime others $stdlib test
`
  );
  await writeFileAscii(
    path.join(libDir, "build.ninja"),
    `
ocamlopt = ocamlopt.opt 
ext = exe
INCL= "4.06.1+BS"
include body.ninja               
`,
  );

  await preprocessorNinja(); // This is needed so that ocamldep makes sense

  await runtimeNinja();
  await stdlibNinja(true);
  if (existsSync(bsc_exe)) {
    await testNinja();
  }
  await othersNinja();
}

async function preprocessorNinja() {
  const dTypeString = "TYPE_STRING";
  const dTypeInt = "TYPE_INT";

  const cppoNative = `
${cppoRule("-n")}
${cppoList("others", [
  ["belt_HashSetString.res", "hashset.cppo.res", dTypeString],
  ["belt_HashSetString.resi", "hashset.cppo.resi", dTypeString],
  ["belt_HashSetInt.res", "hashset.cppo.res", dTypeInt],
  ["belt_HashSetInt.resi", "hashset.cppo.resi", dTypeInt],
  ["belt_HashMapString.res", "hashmap.cppo.res", dTypeString],
  ["belt_HashMapString.resi", "hashmap.cppo.resi", dTypeString],
  ["belt_HashMapInt.res", "hashmap.cppo.res", dTypeInt],
  ["belt_HashMapInt.resi", "hashmap.cppo.resi", dTypeInt],
  ["belt_MapString.res", "map.cppo.res", dTypeString],
  ["belt_MapString.resi", "map.cppo.resi", dTypeString],
  ["belt_MapInt.res", "map.cppo.res", dTypeInt],
  ["belt_MapInt.resi", "map.cppo.resi", dTypeInt],
  ["belt_SetString.res", "belt_Set.cppo.res", dTypeString],
  ["belt_SetString.resi", "belt_Set.cppo.resi", dTypeString],
  ["belt_SetInt.res", "belt_Set.cppo.res", dTypeInt],
  ["belt_SetInt.resi", "belt_Set.cppo.resi", dTypeInt],
  ["belt_MutableMapString.res", "mapm.cppo.res", dTypeString],
  ["belt_MutableMapString.resi", "mapm.cppo.resi", dTypeString],
  ["belt_MutableMapInt.res", "mapm.cppo.res", dTypeInt],
  ["belt_MutableMapInt.resi", "mapm.cppo.resi", dTypeInt],
  ["belt_MutableSetString.res", "setm.cppo.res", dTypeString],
  ["belt_MutableSetString.resi", "setm.cppo.resi", dTypeString],
  ["belt_MutableSetInt.res", "setm.cppo.res", dTypeInt],
  ["belt_MutableSetInt.resi", "setm.cppo.resi", dTypeInt],
  ["belt_SortArrayString.res", "sort.cppo.res", dTypeString],
  ["belt_SortArrayString.resi", "sort.cppo.resi", dTypeString],
  ["belt_SortArrayInt.res", "sort.cppo.res", dTypeInt],
  ["belt_SortArrayInt.resi", "sort.cppo.resi", dTypeInt],
  ["belt_internalMapString.res", "internal_map.cppo.res", dTypeString],
  ["belt_internalMapInt.res", "internal_map.cppo.res", dTypeInt],
  ["belt_internalSetString.res", "internal_set.cppo.res", dTypeString],
  ["belt_internalSetInt.res", "internal_set.cppo.res", dTypeInt],
])}

rule copy
  command = cp $in $out
  description = $in -> $out    
`;
  const cppoNinjaFile = "cppoVendor.ninja";
  await writeFileAscii(path.join(compilerDir, cppoNinjaFile), cppoNative);
  await exec(vendorNinjaPath, ["-f", cppoNinjaFile, "--verbose", "-v"], {
    cwd: compilerDir,
    stdio: "inherit",
  });
}

// Main entry
if (process.argv[1] === __filename) {
  if (process.argv.includes("-check")) {
    checkEffect();
  }

  const subcommand = process.argv[2];
  switch (subcommand) {
    case "build":
      try {
        await exec(vendorNinjaPath, ["all"], {
          cwd: compilerDir,
          stdio: "inherit",
        });
      } catch (e) {
        console.log(e.message);
        console.log(`please run "./scripts/ninja.js config" first`);
        process.exit(2);
      }
      break;
    case "clean":
      try {
        await exec(vendorNinjaPath, ["-t", "clean"], {
          cwd: compilerDir,
          stdio: "inherit",
        });
      } catch (e) {}
      await exec("git", ["clean", "-dfx", "jscomp", my_target, "lib"], {
        cwd: projectDir,
        stdio: "inherit",
      });
      await exec("rm", ["-rm", "lib/js/*.js", "lib/es6/*.js"], {
        cwd: projectDir,
        stdio: "inherit",
      });
      break;
    case "config":
      console.log(`config for the first time may take a while`);
      await updateDev();
      await updateRelease();

      break;
    case "cleanbuild":
      console.log(`run cleaning first`);
      await exec("node", [__filename, "clean"], {
        cwd: __dirname,
        stdio: "inherit",
      });
      await exec("node", [__filename, "config"], {
        cwd: __dirname,
        stdio: "inherit",
      });
      await exec("node", [__filename, "build"], {
        cwd: __dirname,
        stdio: "inherit",
      });
      break;
    case "help":
      console.log(`supported subcommands:
[exe] config        
[exe] build
[exe] cleanbuild
[exe] help
[exe] clean
      `);
      break;
    default:
      if (process.argv.length === 2) {
        await updateDev();
        await updateRelease();
      } else {
        const dev = process.argv.includes("-dev");
        const release = process.argv.includes("-release");
        const all = process.argv.includes("-all");
        if (all) {
          await updateDev();
          await updateRelease();
        } else if (dev) {
          await updateDev();
        } else if (release) {
          await updateRelease();
        }
      }
      break;
  }
}
