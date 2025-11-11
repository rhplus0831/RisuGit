import * as esbuild from 'esbuild';
import {spawn} from 'child_process';
import {config} from 'dotenv';

// Function to start and restart tailwindcss watcher if it fails
function startTailwindWatch() {
    const tailwind = spawn('npm', ['run', 'build:css', '--', '--watch'], {
        stdio: 'inherit',
        shell: true,
    });

    tailwind.on('error', (error) => {
        console.error('Failed to start tailwindcss watcher:', error);
    });

    // Add an exit handler to restart the process if it crashes
    tailwind.on('exit', (code, signal) => {
        // Don't restart if the process was killed intentionally (e.g., by Ctrl+C)
        if (signal === 'SIGINT' || signal === 'SIGTERM') {
            console.log('Tailwind CSS watcher stopped.');
            return;
        }

        console.error(`Tailwind CSS watcher exited unexpectedly. Restarting in 2 seconds...`);
        setTimeout(startTailwindWatch, 2000);
    });
}

// Start tailwindcss in watch mode
startTailwindWatch();

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
        'process.env.RISU_ENCRYPT_KEY': JSON.stringify(process.env.RISU_ENCRYPT_KEY),
        'process.env.RISU_GIT_ASSET_SERVER': JSON.stringify(process.env.RISU_GIT_ASSET_SERVER),
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