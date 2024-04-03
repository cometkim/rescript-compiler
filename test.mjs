import * as assert from "node:assert";
import json from 'rescript/package.json' with { type: "json" };
import { rescript_exe } from './cli/bin_path.js';
import { packageJson } from './cli/package_meta.js';

console.log(assert);
console.log(json.name);
console.log(rescript_exe);
console.log(packageJson);
