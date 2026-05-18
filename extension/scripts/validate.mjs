import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "manifest.json",
  "popup.html",
  "popup.css",
  "popup.js",
  "options.html",
  "options.css",
  "options.js",
  "report.html",
  "report.js",
  "privacy.html",
  "background.js",
  "lib/organizer.js",
  "lib/html-parser.js",
  "lib/similarity.js",
  "lib/utils.js",
  "lib/rules-loader.js",
  "lib/legacy-classify.js",
  "lib/legacy-classify-module.js",
  "lib/rules.json",
  "styles/tokens.css",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png",
  "icons/conversion.png",
  "icons/cogwheel.png",
  "icons/sprites.svg",
];

let failed = 0;
for (const rel of required) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    console.error("MISSING:", rel);
    failed++;
  }
}

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) {
  console.error("manifest_version must be 3");
  failed++;
}

const popup = readFileSync(join(root, "popup.html"), "utf8");
if (!popup.includes("popup.css")) {
  console.error("popup.html must link popup.css");
  failed++;
}

for (const f of ["popup.html", "options.html"]) {
  const html = readFileSync(join(root, f), "utf8");
  if (html.includes("motion.")) {
    console.error(`${f} contains invalid motion.* tags`);
    failed++;
  }
}

const libFiles = [
  "lib/settings.js",
  "lib/ai-categorize.js",
  "lib/ai-providers.js",
  "lib/version.js",
  "lib/organize-worker.js",
  "lib/organize-client.js",
];
for (const rel of libFiles) {
  if (!existsSync(join(root, rel))) {
    console.error("MISSING:", rel);
    failed++;
  }
}

const rulesPath = join(root, "lib/rules.json");
try {
  const rulesDoc = JSON.parse(readFileSync(rulesPath, "utf8"));
  const rules = rulesDoc.rules || [];
  if (rules.length < 15) {
    console.error("rules.json should include at least 15 built-in categorization rules");
    failed++;
  }
  const mustHave = [
    "social_networks",
    "shopping",
    "streaming_video",
    "learning_platforms",
    "dev_reference",
  ];
  const ids = new Set(rules.map((r) => r.id));
  for (const id of mustHave) {
    if (!ids.has(id)) {
      console.error("rules.json missing rule id:", id);
      failed++;
    }
  }
} catch (e) {
  console.error("rules.json invalid:", e.message);
  failed++;
}

const repoRoot = join(root, "..");
const versionFile = join(repoRoot, "VERSION");
try {
  const expected = readFileSync(versionFile, "utf8").trim();
  const manifestVer = manifest.version;
  const versionJs = readFileSync(join(root, "lib/version.js"), "utf8");
  const m = /APP_VERSION = "([^"]+)"/.exec(versionJs);
  const appVer = m?.[1];
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (manifestVer !== expected) {
    console.error(`manifest version ${manifestVer} != VERSION ${expected} — run npm run version:sync`);
    failed++;
  }
  if (pkg.version !== expected) {
    console.error(`package.json version ${pkg.version} != VERSION ${expected}`);
    failed++;
  }
  if (appVer !== expected) {
    console.error(`lib/version.js ${appVer} != VERSION ${expected}`);
    failed++;
  }
} catch (e) {
  console.error("version check failed:", e.message);
  failed++;
}

if (failed) {
  process.exit(1);
}
console.log("validate: ok (" + required.length + " files)");
