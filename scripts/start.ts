#!/usr/bin/env bun

import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bunExecutable = process.execPath;
const childEnvironment = {
  ...process.env,
  PATH: `${dirname(bunExecutable)}${delimiter}${process.env.PATH ?? ""}`,
};

console.log(`Starting Zypp from ${projectDirectory}`);

const install = Bun.spawnSync([bunExecutable, "install"], {
  cwd: projectDirectory,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env: childEnvironment,
});

if (install.exitCode !== 0) {
  process.exit(install.exitCode);
}

const development = Bun.spawn([bunExecutable, "run", "dev"], {
  cwd: projectDirectory,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env: childEnvironment,
});

process.on("SIGINT", () => development.kill());
process.on("SIGTERM", () => development.kill());

process.exit(await development.exited);
