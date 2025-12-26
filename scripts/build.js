#!/usr/bin/env node

/**
 * Build script for the browser extension
 * Uses esbuild for fast TypeScript compilation
 */

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

// Parse arguments
const args = process.argv.slice(2);
const isFirefox = args.includes('--firefox');
const isWatch = args.includes('--watch');
const outDir = isFirefox ? path.join(rootDir, 'dist-firefox') : path.join(rootDir, 'dist');

console.log(`Building for ${isFirefox ? 'Firefox' : 'Chrome/Edge'}...`);

// Clean output directory
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true });
}
fs.mkdirSync(outDir, { recursive: true });

// Copy static files
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;

  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy manifest
const manifestSrc = isFirefox
  ? path.join(srcDir, 'manifest.firefox.json')
  : path.join(srcDir, 'manifest.json');
const manifestContent = JSON.parse(fs.readFileSync(manifestSrc, 'utf-8'));

// Update paths in manifest for built output
manifestContent.action.default_popup = 'popup/popup.html';
manifestContent.background = isFirefox
  ? { scripts: ['background/index.js'], type: 'module' }
  : { service_worker: 'background/index.js', type: 'module' };
manifestContent.content_scripts[0].js = ['content/index.js'];
manifestContent.content_scripts[0].css = ['content/styles.css'];
manifestContent.options_ui.page = 'options/options.html';

fs.writeFileSync(
  path.join(outDir, 'manifest.json'),
  JSON.stringify(manifestContent, null, 2)
);

// Copy assets
copyDir(path.join(srcDir, 'assets'), path.join(outDir, 'assets'));

// Copy and update HTML files
function processHtml(htmlPath, outPath) {
  let content = fs.readFileSync(htmlPath, 'utf-8');

  // Update script/css paths
  content = content.replace(/\.ts"/g, '.js"');
  content = content.replace(/src="\.\.\/assets/g, 'src="../assets');

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
}

processHtml(
  path.join(srcDir, 'popup/popup.html'),
  path.join(outDir, 'popup/popup.html')
);
processHtml(
  path.join(srcDir, 'options/options.html'),
  path.join(outDir, 'options/options.html')
);

// Copy CSS files
function copyCss(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

copyCss(
  path.join(srcDir, 'popup/popup.css'),
  path.join(outDir, 'popup/popup.css')
);
copyCss(
  path.join(srcDir, 'options/options.css'),
  path.join(outDir, 'options/options.css')
);
copyCss(
  path.join(srcDir, 'content/styles.css'),
  path.join(outDir, 'content/styles.css')
);

// Shared esbuild options
const commonOptions = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  target: ['chrome100', 'firefox109'],
  format: 'esm',
  alias: {
    '@': srcDir,
  },
};

// Build entries
const entries = [
  { in: path.join(srcDir, 'background/index.ts'), out: path.join(outDir, 'background/index.js') },
  { in: path.join(srcDir, 'content/index.ts'), out: path.join(outDir, 'content/index.js') },
  { in: path.join(srcDir, 'popup/popup.ts'), out: path.join(outDir, 'popup/popup.js') },
  { in: path.join(srcDir, 'options/options.ts'), out: path.join(outDir, 'options/options.js') },
];

async function build() {
  const contexts = [];

  for (const entry of entries) {
    const options = {
      ...commonOptions,
      entryPoints: [entry.in],
      outfile: entry.out,
    };

    if (isWatch) {
      const ctx = await esbuild.context(options);
      contexts.push(ctx);
      await ctx.watch();
    } else {
      await esbuild.build(options);
    }
  }

  console.log(`✅ Build complete! Output: ${outDir}`);

  if (isWatch) {
    console.log('👀 Watching for changes...');
  }
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
