import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dir, "..");
const tauriConfPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
const bundleDir = path.join(rootDir, "src-tauri", "target", "release", "bundle", "nsis");

if (!fs.existsSync(bundleDir)) {
  console.error("Error: Bundle directory not found. Please run `bun run tauri:build:signed` first.");
  process.exit(1);
}

const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"));
const version = tauriConf.version || "1.0.0";

// Find the .exe and .sig in nsis bundle directory
const files = fs.readdirSync(bundleDir);
const exeFile = files.find((f) => f.endsWith("-setup.exe"));
const sigFile = files.find((f) => f.endsWith("-setup.exe.sig"));

if (!exeFile || !sigFile) {
  console.error("Error: Could not find setup .exe or .sig file in", bundleDir);
  process.exit(1);
}

const signature = fs.readFileSync(path.join(bundleDir, sigFile), "utf-8").trim();

const manifest = {
  version,
  notes: `Rilis Sistem Informasi Absensi DAMKAR Mimika v${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/franselmanuhutu-bpbd/Sistem-Absen-Damkar/releases/download/v${version}/${encodeURIComponent(exeFile)}`,
    },
  },
};

const outputPath = path.join(bundleDir, "latest.json");
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), "utf-8");

console.log("\n=======================================================");
console.log("  Update Manifest (latest.json) Generated Successfully ");
console.log("=======================================================\n");
console.log("Path:", outputPath);
console.log("Version:", version);
console.log("\nUpload the following files to your GitHub Release (tag: v" + version + "):");
console.log("  1. " + exeFile);
console.log("  2. " + sigFile);
console.log("  3. latest.json\n");
