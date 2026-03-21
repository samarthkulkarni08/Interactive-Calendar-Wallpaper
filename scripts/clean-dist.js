/**
 * Remove dist/ (compiled app + electron-builder output). Run `npm run build` after.
 */
const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
fs.rmSync(dist, { recursive: true, force: true });
console.log("Removed dist/");
