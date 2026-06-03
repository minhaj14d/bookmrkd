/**
 * Build dist/ + dist-firefox/ and zip release/bookmrkd-v{VERSION}-{chromium|firefox}.zip
 */
import { execSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const extRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(extRoot, "..");
const version = readFileSync(join(repoRoot, "VERSION"), "utf8").trim();
const outDir = join(repoRoot, "release");

function zipDist(distRoot, zipName) {
  const zipPath = join(outDir, zipName);
  if (existsSync(zipPath)) rmSync(zipPath);

  if (process.platform === "win32") {
    const staging = join(outDir, `.staging-${zipName}`);
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
}

function buildAndValidate(target, buildScript) {
  execSync(buildScript, { cwd: extRoot, stdio: "inherit", env: { ...process.env, BUILD_TARGET: target } });
  execSync(`node scripts/validate.mjs ${target}`, { cwd: extRoot, stdio: "inherit" });
}

mkdirSync(outDir, { recursive: true });

buildAndValidate("chromium", "npm run build");
const chromiumDist = join(extRoot, "dist");
if (!existsSync(chromiumDist)) {
  console.error("pack: dist/ not found after build");
  process.exit(1);
}
zipDist(chromiumDist, `bookmrkd-v${version}-chromium.zip`);

buildAndValidate("firefox", "npm run build:firefox");
const firefoxDist = join(extRoot, "dist-firefox");
if (!existsSync(firefoxDist)) {
  console.error("pack: dist-firefox/ not found after build");
  process.exit(1);
}
zipDist(firefoxDist, `bookmrkd-v${version}-firefox.zip`);
