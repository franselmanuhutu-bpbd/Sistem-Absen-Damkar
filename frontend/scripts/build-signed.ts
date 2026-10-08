import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const rootDir = path.resolve(import.meta.dir, "..");
const keyPath = path.join(rootDir, "src-tauri", "damkar.key");

if (!fs.existsSync(keyPath)) {
  console.error("Error: Private key not found at", keyPath);
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, "utf-8").trim();

const env = {
  ...process.env,
  TAURI_SIGNING_PRIVATE_KEY: privateKey,
};

console.log("\n=======================================================");
console.log("  Building Signed Tauri Desktop App with Auto-Updater  ");
console.log("=======================================================\n");

const child = spawn("bunx", ["tauri", "build"], {
  cwd: rootDir,
  env,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  if (code === 0) {
    console.log("\nBuild & signing completed successfully!");
    // Generate latest.json manifest
    try {
      import("./generate-manifest.ts");
    } catch (e) {
      console.error("Notice: Could not auto-generate latest.json:", e);
    }
  } else {
    process.exit(code ?? 0);
  }
});
