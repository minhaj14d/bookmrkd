/**
 * Produce dist-firefox/ from dist/ with Gecko manifest + background scripts.
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const extRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const chromiumDist = join(extRoot, "dist");
const firefoxDist = join(extRoot, "dist-firefox");

if (!existsSync(chromiumDist)) {
  console.log("build-firefox: running chromium build…");
  execSync("npm run build", { cwd: extRoot, stdio: "inherit" });
}

if (!existsSync(join(chromiumDist, "manifest.json"))) {
  console.error("build-firefox: dist/manifest.json missing");
  process.exit(1);
}

if (existsSync(firefoxDist)) rmSync(firefoxDist, { recursive: true, force: true });
cpSync(chromiumDist, firefoxDist, { recursive: true });

const overlay = JSON.parse(
  readFileSync(join(extRoot, "src", "manifest.firefox.json"), "utf8")
);
const manifestPath = join(firefoxDist, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

manifest.browser_specific_settings = overlay.browser_specific_settings;
manifest.background = overlay.background;

// Firefox background script — same entry as Chromium service-worker-loader.js.
const swLoader = join(chromiumDist, "service-worker-loader.js");
if (!existsSync(swLoader)) {
  console.error("build-firefox: service-worker-loader.js missing in dist/");
  process.exit(1);
}
cpSync(swLoader, join(firefoxDist, "background.js"));

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(
  "build-firefox: ok → dist-firefox/ (gecko:",
  overlay.browser_specific_settings.gecko.id,
  ", background.js)"
);
