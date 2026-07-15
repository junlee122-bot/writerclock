import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const config = JSON.parse(await read("capacitor.config.json"));
assert.equal(config.appId, "io.github.junlee122.writerclock");
assert.equal(config.webDir, "dist");

const gradle = await read("android/app/build.gradle");
assert.match(gradle, /applicationId\s+"io\.github\.junlee122\.writerclock"/);
assert.match(gradle, /versionName\s+"1\.2\.0"/);
assert.match(gradle, /storeType\s+"PKCS12"/);

const manifest = await read("android/app/src/main/AndroidManifest.xml");
assert.match(manifest, /android:screenOrientation="fullSensor"/);
assert.match(manifest, /android:usesCleartextTraffic="false"/);

const activity = await read(
  "android/app/src/main/java/io/github/junlee122/writerclock/MainActivity.java",
);
assert.match(activity, /FLAG_KEEP_SCREEN_ON/);
assert.match(activity, /BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE/);

console.log("Android check passed: package id, offline assets, screen-on and immersive-mode contracts are configured.");
