import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dir, "..");
const androidRoot = path.join(rootDir, "src-tauri", "gen", "android");
const releaseDir = path.join(androidRoot, "app", "build", "outputs", "apk", "universal", "release");
const unsignedApk = path.join(releaseDir, "app-universal-release-unsigned.apk");
const alignedApk = path.join(releaseDir, "damkar-absensi-aligned.apk");
const signedApk = path.join(releaseDir, "Damkar-Absensi.apk");

const keystorePath = path.resolve(process.env.ANDROID_KEYSTORE_PATH
    || path.join(rootDir, "src-tauri", "damkar-release.keystore"),
);

const keyAlias = process.env.ANDROID_KEY_ALIAS || "damkar-release";
const keystorePassword = process.env.ANDROID_KEYSTORE_PASSWORD;
const keyPassword = process.env.ANDROID_KEY_PASSWORD || keystorePassword;

function fail(message: string): never {
    console.error(`\nAndroid signing failed: ${message}`);
    process.exit(1);
}

function commandPath(name: string): string {
    const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    if (!sdkRoot) {
        fail("ANDROID_HOME or ANDROID_SDK_ROOT is not configured.");
    }

    const buildToolsRoot = path.join(sdkRoot, "build-tools");
    if (!fs.existsSync(buildToolsRoot)) {
        fail(`Android build-tools directory was not found: ${buildToolsRoot}`);
    }

    const versions = fs
        .readdirSync(buildToolsRoot)
        .filter((version) => fs.statSync(path.join(buildToolsRoot, version)).isDirectory())
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    const executable =
        process.platform === "win32"
            ? name === "apksigner"
                ? "apksigner.bat"
                : `${name}.exe`
            : name;

    const result = path.join(buildToolsRoot, versions[0] || "", executable);

    if (!fs.existsSync(result)) fail(`${name} was not found in Android build-tools.`);
    return result;
}

function run(command: string, args: string[], env?: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: rootDir,
            stdio: "inherit",
            shell: process.platform === "win32" && command.endsWith(".bat"),
            env: env ? { ...process.env, ...env } : process.env,
        });

        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${path.basename(command)} exited with code ${code ?? "unknown"}`));
        });
    });
}

if (!fs.existsSync(keystorePath)) {
    fail(`Keystore was not found: ${keystorePath}`);
}
if (!keystorePassword) {
    fail("ANDROID_KEYSTORE_PASSWORD is not set.");
}
if (!keyPassword) {
    fail("ANDROID_KEY_PASSWORD is not set.");
}

console.log("Building unsigned Android APK...");
try {
    await run("bun", ["run", "tauri:android:build"]);

    if (!fs.existsSync(unsignedApk)) {
        fail(`Unsigned APK was not generated: ${unsignedApk}`);
    }

    const zipalign = commandPath("zipalign");
    const apksigner = commandPath("apksigner");

    console.log("Aligning APK...");
    await run(zipalign, ["-p", "-f", "4", unsignedApk, alignedApk]);

    console.log("Signing APK...");
    await run(apksigner, [
        "sign",
        "--ks",
        keystorePath,
        "--ks-key-alias",
        keyAlias,
        "--ks-pass",
        "env:ANDROID_SIGNING_STORE_PASSWORD",
        "--key-pass",
        "env:ANDROID_SIGNING_KEY_PASSWORD",
        "--out",
        signedApk,
        alignedApk,
    ], {
        ANDROID_SIGNING_STORE_PASSWORD: keystorePassword,
        ANDROID_SIGNING_KEY_PASSWORD: keyPassword,
    });

    console.log("Verifying APK signature...");
    await run(apksigner, ["verify", "--verbose", "--print-certs", signedApk]);
    console.log(`\nSigned APK created:\n${signedApk}`);
} catch (error) {
    fail(error instanceof Error ? error.message : String(error));
}
