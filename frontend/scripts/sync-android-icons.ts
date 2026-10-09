import { mkdir, readdir, readFile, copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const androidIconSource = join(import.meta.dir, "..", "src-tauri", "icons", "android");
const androidResourceRoot = join(
  import.meta.dir,
  "..",
  "src-tauri",
  "gen",
  "android",
  "app",
  "src",
  "main",
  "res"
);

const resourceDirectories = [
  "mipmap-hdpi",
  "mipmap-mdpi",
  "mipmap-xhdpi",
  "mipmap-xxhdpi",
  "mipmap-xxxhdpi",
];

for (const directory of resourceDirectories) {
  const sourceDirectory = join(androidIconSource, directory);
  const targetDirectory = join(androidResourceRoot, directory);
  await mkdir(targetDirectory, { recursive: true });

  for (const file of await readdir(sourceDirectory)) {
    await copyFile(join(sourceDirectory, file), join(targetDirectory, file));
  }
}

const adaptiveIconDirectory = join(androidResourceRoot, "mipmap-anydpi-v26");
await mkdir(adaptiveIconDirectory, { recursive: true });
await copyFile(
  join(androidIconSource, "mipmap-anydpi-v26", "ic_launcher.xml"),
  join(adaptiveIconDirectory, "ic_launcher.xml")
);

const colorsPath = join(androidResourceRoot, "values", "colors.xml");
let colors = await readFile(colorsPath, "utf8");
if (!colors.includes('name="ic_launcher_background"')) {
  colors = colors.replace(
    "</resources>",
    '    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>'
  );
  await writeFile(colorsPath, colors);
}

console.log("Android launcher icons synchronized from src-tauri/icons/android.");
