import { spawn } from "node:child_process";

import { projectDir } from "./paths.js";

export {
  exec,
  execNpmScript,
  execRescript,
};

const signals = {
  SIGINT: 2,
  SIGQUIT: 3,
  SIGKILL: 9,
  SIGTERM: 15,
};

/**
 * @typedef {{ code: number, stdout: string, stderr: string }} ExecResult
 * @param {string} command
 * @param {Array<string>} args
 * @param {import("node:child_process").SpawnOptions} options
 * @return {Promise<ExecResult>}
 */
async function exec(command, args, options) {
  const stdoutChunks = [];
  const stderrChunks = [];

  const subprocess = spawn(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  subprocess.stdout?.on("data", chunk => {
    stdoutChunks.push(chunk);
  });

  subprocess.stderr?.on("data", chunk => {
    stderrChunks.push(chunk);
  });

  return await new Promise((resolve, reject) => {
    subprocess.once("error", err => {
      reject(err);
    });

    subprocess.once("close", (exitCode, signal) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      let code = exitCode ?? 1;
      if (signals[signal]) {
        // + 128 is standard POSIX practice, see also https://nodejs.org/api/process.html#exit-codes
        code = signals[signal] + 128;
      }

      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * @param {string} script 
 * @param {Array<string>} args
 * @param {Exclude<import("node:child_process").SpawnOptions, 'cwd'>} [options]
 */
async function execNpmScript(script, args, options) {
  return await exec("npm", ["run", script, ...args], {
    ...options,
    cwd: projectDir,
  });
}

/**
 * @param {string} subcommand
 * @param {Array<string>} args
 * @param {import("node:child_process").SpawnOptions} [options]
 */
async function execRescript(subcommand, args, options) {
  return await exec("rescript", [subcommand, ...args], options);
}
