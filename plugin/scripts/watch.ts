import * as esbuild from 'esbuild';
import {spawn} from 'child_process';

// Start tailwindcss in watch mode
spawn('npm', ['run', 'build:css', '--', '--watch'], {
    stdio: 'inherit',
    shell: true,
}).on('error', (error) => {
    console.error('Failed to start tailwindcss watcher:', error);
});

esbuild.context({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'browser',
    target: 'es2022',
    format: 'iife',
    legalComments: 'none',
    loader: { '.html': 'text', '.css': 'text' },
    outfile: 'dist/index.js',
    plugins: [{
        name: 'add-headers-plugin',
        setup(build) {
            build.onEnd(() => {
                console.log('Build complete, adding headers...');
                const child = spawn('tsx', ['scripts/add-headers.ts'], {
                    stdio: 'inherit',
                    shell: true
                });
                child.on('exit', (code) => {
                    if (code === 0) {
                        console.log('Headers added successfully');
                    } else {
                        console.error('Failed to add headers');
                    }
                });
            });
        }
    }]
}).then((ctx) => {
    ctx.watch().then(() => {
        console.log("Watch End?");
    })
});

console.log('Watching for changes...');