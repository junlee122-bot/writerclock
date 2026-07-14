import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

const copyFile = async (from, to = from) => {
  await fs.mkdir(path.dirname(path.join(dist, to)), { recursive: true });
  await fs.copyFile(path.join(root, from), path.join(dist, to));
};

const copyDir = async (from, to = from) => {
  await fs.cp(path.join(root, from), path.join(dist, to), { recursive: true });
};

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });

await Promise.all([
  copyFile("index.html"),
  copyFile("404.html"),
  copyFile("manifest.webmanifest"),
  copyFile("sw.js"),
  copyFile("robots.txt"),
  copyFile("sitemap.xml"),
  copyDir("assets"),
  copyFile("data/ko_quotes.js"),
  copyFile("data/ko_coverage.json"),
  copyFile("data/LITERATURE_CLOCK_LICENSE.md"),
  copyFile("docs/SOURCE_AUDIT.md"),
  copyFile("firmware/OFL.txt"),
  copyFile("LICENSE"),
  copyFile("NOTICE.md"),
  copyFile("DATA_LICENSE.md"),
]);

await fs.writeFile(path.join(dist, ".nojekyll"), "");
