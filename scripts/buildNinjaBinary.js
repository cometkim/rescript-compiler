#!/usr/bin/env node

import { ninjaDir } from "./lib/paths.js";
import { exec } from "./lib/exec_util.js";

const platform = process.platform;
const buildCommand = "python3 configure.py --bootstrap --verbose";

if (platform === "win32") {
  // On Windows, the build uses the MSVC compiler which needs to be on the path.
  await exec(buildCommand, [], { cwd: ninjaDir });
} else {
  const env = {
    ...process.env,
    ...process.platform === "darwin" && {
      CXXFLAGS: "-flto",
    },
  };
  await exec(buildCommand, { stdio: "inherit", cwd: ninjaDir, env });
  await exec("strip", ["ninja"], { stdio: "inherit", cwd: ninjaDir, env });
}
