/**
 * Build release/bookmrkd-v{VERSION}-extension.zip for GitHub Releases.
 * Run from extension/: npm run pack
 */
import { execSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const extRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(extRoot, "..");
const version = readFileSync(join(repoRoot, "VERSION"), "utf8").trim();
const outDir = join(repoRoot, "release");
const zipName = `bookmrkd-v${version}-extension.zip`;
const zipPath = join(outDir, zipName);

console.log("pack: validating…");
execSync("npm run lint", { cwd: extRoot, stdio: "inherit" });

mkdirSync(outDir, { recursive: true });
if (existsSync(zipPath)) rmSync(zipPath);

const exclude = ["node_modules", ".DS_Store"];
const excludeArg =
  process.platform === "win32"
    ? ""
    : `-x '${exclude.map((e) => `*${e}*`).join("' -x '")}'`;

if (process.platform === "win32") {
  const staging = join(outDir, ".staging");
  if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  execSync(
    `powershell -NoProfile -Command "` +
      `Get-ChildItem -Path '${extRoot.replace(/'/g, "''")}' -Exclude node_modules | ` +
      `Copy-Item -Destination '${staging.replace(/'/g, "''")}' -Recurse -Force; ` +
      `Compress-Archive -Path '${staging.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" }
  );
  rmSync(staging, { recursive: true, force: true });
} else {
  execSync(`zip -r "${zipPath}" . -x "node_modules/*" "*.DS_Store"`, {
    cwd: extRoot,
    stdio: "inherit",
  });
}

console.log(`pack: ok → release/${zipName}`);
console.log("pack: for .crx see README (Pack extension section)");
