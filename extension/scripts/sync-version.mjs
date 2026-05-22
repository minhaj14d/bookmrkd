/**
 * Sync semver from repo root VERSION into src/manifest.json, package.json, and src/lib/version.ts.
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

const manifestPath = join(extRoot, "src", "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const pkgPath = join(extRoot, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const versionTsPath = join(extRoot, "src", "lib", "version.ts");
const versionTs = readFileSync(versionTsPath, "utf8");
const appVersionRe = /export const APP_VERSION = ["'][^"']+["'];?/;
if (!appVersionRe.test(versionTs)) {
  console.error('sync-version: src/lib/version.ts must export APP_VERSION = "x.y.z";');
  process.exit(1);
}
writeFileSync(
  versionTsPath,
  versionTs.replace(appVersionRe, `export const APP_VERSION = "${version}";`)
);

console.log("sync-version: ok →", version);
