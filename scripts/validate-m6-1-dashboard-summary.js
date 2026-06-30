const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const esbuild = require(path.join(root, "plugin", "node_modules", "esbuild"));

async function main() {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "fishbone-m61-"));
  const outfile = path.join(outdir, "dashboard-summary.cjs");
  esbuild.buildSync({
    entryPoints: [path.join(root, "tests", "plugin", "m6-1-dashboard-summary.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile,
    logLevel: "silent"
  });
  await import(pathToFileURL(outfile).href);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
