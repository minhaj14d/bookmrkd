/**
 * Sync semver from repo root VERSION into manifest, package.json, and lib/version.js.
 * Usage: node scripts/sync-version.mjs (from extension/)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const extRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(extRoot, "..");
const version = readFileSync(join(repoRoot, "VERSION"), "utf8").trim();

if (!/^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(version)) {
  console.error("sync-version: invalid VERSION:", version);
  process.exit(1);
}

const manifestPath = join(extRoot, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const pkgPath = join(extRoot, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const versionJsPath = join(extRoot, "lib", "version.js");
const versionJs = readFileSync(versionJsPath, "utf8");
const appVersionRe = /export const APP_VERSION = ["'][^"']+["'];?/;
if (!appVersionRe.test(versionJs)) {
  console.error(
    "sync-version: lib/version.js must export APP_VERSION = \"x.y.z\";"
  );
  process.exit(1);
}
const next = versionJs.replace(
  appVersionRe,
  `export const APP_VERSION = "${version}";`
);
writeFileSync(versionJsPath, next);

console.log("sync-version: ok →", version);
