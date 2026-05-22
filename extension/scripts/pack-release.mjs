/**
 * Build dist/ and zip release/bookmrkd-v{VERSION}-extension.zip for GitHub Releases.
 */
import { execSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const extRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(extRoot, "..");
const version = readFileSync(join(repoRoot, "VERSION"), "utf8").trim();
const distRoot = join(extRoot, "dist");
const outDir = join(repoRoot, "release");
const zipName = `bookmrkd-v${version}-extension.zip`;
const zipPath = join(outDir, zipName);

execSync("npm run build", { cwd: extRoot, stdio: "inherit" });
console.log("pack: validating…");
execSync("npm run lint", { cwd: extRoot, stdio: "inherit" });

if (!existsSync(distRoot)) {
  console.error("pack: dist/ not found after build");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
if (existsSync(zipPath)) rmSync(zipPath);

if (process.platform === "win32") {
  const staging = join(outDir, ".staging");
  if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  execSync(
    `powershell -NoProfile -Command "` +
      `Copy-Item -Path '${distRoot.replace(/'/g, "''")}\\*' -Destination '${staging.replace(/'/g, "''")}' -Recurse -Force; ` +
      `Compress-Archive -Path '${staging.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" }
  );
  rmSync(staging, { recursive: true, force: true });
} else {
  execSync(`zip -r "${zipPath}" .`, { cwd: distRoot, stdio: "inherit" });
}

console.log(`pack: ok → release/${zipName}`);
