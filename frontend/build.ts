import tailwind from "bun-plugin-tailwind";
import { rm } from "node:fs/promises";
import path from "node:path";

const outdir = path.join(process.cwd(), "dist");
await rm(outdir, { recursive: true, force: true });

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Copy public files if present
const publicDir = path.join(process.cwd(), "public");
for (const filename of ["sw.js", "favicon.svg"]) {
  const src = path.join(publicDir, filename);
  const dest = path.join(outdir, filename);
  if (await Bun.file(src).exists()) {
    await Bun.write(dest, Bun.file(src));
    console.log(`  Copied public/${filename} to dist/${filename}`);
  }
}

console.log("Build successful:");
for (const output of result.outputs) {
  console.log(`  ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`);
}
