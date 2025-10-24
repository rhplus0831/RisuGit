import * as esbuild from 'esbuild';
import {spawn} from 'child_process';
import {config} from 'dotenv';

// Start tailwindcss in watch mode
spawn('npm', ['run', 'build:css', '--', '--watch'], {
    stdio: 'inherit',
    shell: true,
}).on('error', (error) => {
    console.error('Failed to start tailwindcss watcher:', error);
});

config();

esbuild.context({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'browser',
    target: 'es2022',
    format: 'iife',
    legalComments: 'none',
    loader: {'.html': 'text', '.css': 'text'},
    define: {
        'process.env.NODE_ENV': JSON.stringify('development'),
        'process.env.RISU_GIT_URL': JSON.stringify(process.env.RISU_GIT_URL),
        'process.env.RISU_GIT_ID': JSON.stringify(process.env.RISU_GIT_ID),
        'process.env.RISU_GIT_PASSWORD': JSON.stringify(process.env.RISU_GIT_PASSWORD),
        'process.env.RISU_GIT_PROXY': JSON.stringify(process.env.RISU_GIT_PROXY),
    },
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
        console.log("Watching for changes...");
    })
});