import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// Ensure dist directory exists
const distDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy HTML file
fs.copyFileSync(
    path.join(process.cwd(), 'src', 'index.html'),
    path.join(distDir, 'index.html')
);

// Copy CSS file
fs.copyFileSync(
    path.join(process.cwd(), 'src', 'styles.css'),
    path.join(distDir, 'styles.css')
);

const buildOptions = {
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'dist/main.js',
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    sourcemap: !production,
    minify: production,
    logLevel: 'info'
};

async function build() {
    if (watch) {
        const ctx = await esbuild.context(buildOptions);
        await ctx.watch();
        console.log('Watching webview for changes...');
    } else {
        await esbuild.build(buildOptions);
        console.log('Webview build complete');
    }
}

build().catch(() => process.exit(1));
