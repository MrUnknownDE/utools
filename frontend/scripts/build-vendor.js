// frontend/scripts/build-vendor.js
// Copies self-hosted vendor assets (Leaflet, D3, IBM Plex fonts) out of
// node_modules into app/vendor + app/dist/fonts, replacing the CDN <script>/
// <link> tags that index.html used to load at runtime.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NODE_MODULES = path.join(ROOT, 'node_modules');
const APP = path.join(ROOT, 'app');
const VENDOR_DIR = path.join(APP, 'vendor');
const FONTS_DIR = path.join(APP, 'dist', 'fonts');

function copyFile(src, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, path.basename(src)));
}

// ── Leaflet ──────────────────────────────────────────────────────────────
function buildLeaflet() {
    const src = path.join(NODE_MODULES, 'leaflet', 'dist');
    const dest = path.join(VENDOR_DIR, 'leaflet');
    copyFile(path.join(src, 'leaflet.js'), dest);
    copyFile(path.join(src, 'leaflet.css'), dest);
    const imagesSrc = path.join(src, 'images');
    const imagesDest = path.join(dest, 'images');
    fs.mkdirSync(imagesDest, { recursive: true });
    for (const file of fs.readdirSync(imagesSrc)) {
        fs.copyFileSync(path.join(imagesSrc, file), path.join(imagesDest, file));
    }
    console.log('vendor: leaflet copied');
}

// ── D3 ───────────────────────────────────────────────────────────────────
function buildD3() {
    copyFile(path.join(NODE_MODULES, 'd3', 'dist', 'd3.min.js'), VENDOR_DIR);
    console.log('vendor: d3 copied');
}

// ── IBM Plex fonts (latin + latin-ext only — app is German/English UI) ───
const FONT_SPECS = [
    { pkg: 'ibm-plex-sans', family: 'IBM Plex Sans', weights: [400, 500, 600, 700] },
    { pkg: 'ibm-plex-sans-condensed', family: 'IBM Plex Sans Condensed', weights: [500, 600] },
    { pkg: 'ibm-plex-mono', family: 'IBM Plex Mono', weights: [400, 500] },
];
const SUBSETS = ['latin', 'latin-ext'];

function buildFonts() {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
    const rules = [];

    for (const { pkg, family, weights } of FONT_SPECS) {
        const filesDir = path.join(NODE_MODULES, '@fontsource', pkg, 'files');
        for (const weight of weights) {
            for (const subset of SUBSETS) {
                const base = `${pkg}-${subset}-${weight}-normal`;
                const woff2 = `${base}.woff2`;
                const srcPath = path.join(filesDir, woff2);
                if (!fs.existsSync(srcPath)) continue; // not every subset exists for every weight
                fs.copyFileSync(srcPath, path.join(FONTS_DIR, woff2));
                rules.push(`@font-face {
  font-family: '${family}';
  font-style: normal;
  font-display: swap;
  font-weight: ${weight};
  src: url('./fonts/${woff2}') format('woff2');
}`);
            }
        }
    }

    fs.writeFileSync(path.join(APP, 'dist', 'fonts.css'), rules.join('\n\n') + '\n');
    console.log(`vendor: ${rules.length} @font-face rules written to dist/fonts.css`);
}

buildLeaflet();
buildD3();
buildFonts();
