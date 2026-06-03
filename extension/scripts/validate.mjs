import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const extRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] || process.env.BUILD_TARGET || "chromium";
const distRoot = join(extRoot, target === "firefox" ? "dist-firefox" : "dist");
const srcManifestPath = join(extRoot, "src", "manifest.json");

let failed = 0;

function fail(msg) {
  console.error(msg);
  failed++;
}

if (!existsSync(distRoot)) {
  fail(`${distRoot.replace(extRoot, "").slice(1)}/ missing — run npm run build${target === "firefox" ? ":firefox" : ""} first`);
} else {
  const manifestPath = join(distRoot, "manifest.json");
  if (!existsSync(manifestPath)) {
    fail(`manifest.json missing in ${distRoot}`);
  } else {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.manifest_version !== 3) fail("manifest_version must be 3");

    if (target === "firefox") {
      const gecko = manifest.browser_specific_settings?.gecko;
      if (!gecko?.id) fail("Firefox build missing browser_specific_settings.gecko.id");
      const scripts = manifest.background?.scripts;
      if (!scripts?.includes("background.js")) {
        fail("Firefox build must use background.scripts: [\"background.js\"]");
      }
      if (!existsSync(join(distRoot, "background.js"))) fail("MISSING background.js in dist-firefox");
    }

    const requiredDist = [
      "manifest.json",
      "icons/icon16.png",
      "icons/icon48.png",
      "icons/icon128.png",
    ];
    for (const rel of requiredDist) {
      if (!existsSync(join(distRoot, rel))) fail(`MISSING ${rel} in ${distRoot}`);
    }
  }
}

const srcRequired = [
  "src/manifest.json",
  "src/manifest.firefox.json",
  "src/popup/index.html",
  "src/options/index.html",
  "src/background/index.ts",
  "src/storage/idb.ts",
  "src/lib/version.ts",
  "src/features/organize/organizer.js",
  "src/features/organize/rules.json",
];

for (const rel of srcRequired) {
  if (!existsSync(join(extRoot, rel))) fail(`MISSING ${rel}`);
}

const rulesPath = join(extRoot, "src/features/organize/rules.json");
try {
  const rulesDoc = JSON.parse(readFileSync(rulesPath, "utf8"));
  const rules = rulesDoc.rules || [];
  if (rules.length < 15) fail("rules.json should include at least 15 rules");
} catch (e) {
  fail(`rules.json invalid: ${e.message}`);
}

const repoRoot = join(extRoot, "..");
try {
  const expected = readFileSync(join(repoRoot, "VERSION"), "utf8").trim();
  const srcManifest = JSON.parse(readFileSync(srcManifestPath, "utf8"));
  const versionTs = readFileSync(join(extRoot, "src/lib/version.ts"), "utf8");
  const m = /APP_VERSION = "([^"]+)"/.exec(versionTs);
  const pkg = JSON.parse(readFileSync(join(extRoot, "package.json"), "utf8"));
  if (srcManifest.version !== expected) {
    fail(`src/manifest version ${srcManifest.version} != VERSION ${expected}`);
  }
  if (pkg.version !== expected) fail(`package.json version mismatch`);
  if (m?.[1] !== expected) fail(`version.ts mismatch`);
} catch (e) {
  fail(`version check: ${e.message}`);
}

if (failed) process.exit(1);
console.log(`validate: ok (${target})`);
