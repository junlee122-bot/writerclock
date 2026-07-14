import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function requireFile(relativePath, source) {
  const withoutQuery = relativePath.replace(/[?#].*$/, "");
  const normalized = withoutQuery === "./" ? "index.html" : withoutQuery.replace(/^\.\//, "");
  assert.ok(normalized, `${source}: empty local path`);
  const resolved = path.resolve(root, decodeURIComponent(normalized));
  const relative = path.relative(root, resolved);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `${source}: path leaves repository: ${relativePath}`);
  await access(resolved, constants.R_OK).catch(() => {
    throw new Error(`${source}: missing local file ${normalized}`);
  });
  return normalized.replace(/\\/g, "/");
}

function isLocalReference(value) {
  return !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value);
}

const requiredFiles = [
  "index.html",
  "assets/app.js",
  "assets/style.css",
  "data/ko_quotes.js",
  "manifest.webmanifest",
  "sw.js",
];
await Promise.all(requiredFiles.map((file) => requireFile(file, "application shell")));

const html = await read("index.html");
assert.match(html, /<html\s+[^>]*lang=["']ko["']/i, "index.html must declare Korean content");
assert.match(html, /<meta\s+[^>]*name=["']viewport["']/i, "index.html must declare a viewport");
assert.match(html, /<main\b/i, "index.html must contain a main landmark");
assert.match(html, /aria-live=["']polite["']/i, "index.html must expose quote updates to assistive technology");
assert.doesNotMatch(html, /gyuminlee-repo/i, "index.html still references the upstream deployment");

const htmlIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]));
assert.equal(htmlIds.size, [...html.matchAll(/\bid=["']([^"']+)["']/gi)].length, "HTML ids must be unique");

const localReferences = [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)]
  .map((match) => match[1])
  .filter(isLocalReference);
await Promise.all(localReferences.map((value) => requireFile(value, "index.html")));

const appSource = await read("assets/app.js");
const elementBlock = appSource.match(/var elements\s*=\s*\{\};([\s\S]*?)\.forEach\(function\s*\(id\)/);
assert.ok(elementBlock, "assets/app.js element registry could not be inspected");
const referencedIds = [...elementBlock[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
for (const id of referencedIds) {
  assert.ok(htmlIds.has(id), `assets/app.js expects missing #${id}`);
}

const manifest = JSON.parse(await read("manifest.webmanifest"));
for (const field of ["name", "short_name", "start_url", "scope", "display", "icons"]) {
  assert.ok(manifest[field], `manifest.webmanifest is missing ${field}`);
}
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "manifest must provide install icons");
await requireFile(manifest.start_url, "manifest.webmanifest start_url");
await Promise.all(manifest.icons.map((icon) => requireFile(icon.src, "manifest.webmanifest icon")));

const serviceWorker = await read("sw.js");
const precacheBlock = serviceWorker.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/);
assert.ok(precacheBlock, "sw.js must declare PRECACHE_URLS");
const precache = [...precacheBlock[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
await Promise.all(precache.map((value) => requireFile(value, "sw.js PRECACHE_URLS")));

for (const required of ["./index.html", "assets/style.css", "assets/app.js", "data/ko_quotes.js", "manifest.webmanifest"]) {
  assert.ok(precache.includes(required), `sw.js precache is missing ${required}`);
}

console.log(
  `Static check passed: ${localReferences.length} page references, ` +
    `${referencedIds.length} DOM bindings, ${manifest.icons.length} manifest icons, ${precache.length} precache entries.`,
);
