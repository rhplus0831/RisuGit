// fs 인스턴스를 비동기로 가져오는 함수로 변경
import {ensureScriptLoaded} from "./script-loader";

// LightningFS 스크립트 URL
const LIGHTNING_FS_URL = "https://unpkg.com/@isomorphic-git/lightning-fs";

export interface WrappedFS {
    promises: any;
}

let _cachedFS: WrappedFS | null = null;
let _cachedPromise: Promise<WrappedFS> | null = null;

async function _getFs(): Promise<WrappedFS> {
    await ensureScriptLoaded(LIGHTNING_FS_URL);

    // @ts-ignore
    if (typeof window.LightningFS === 'undefined') {
        await new Promise<void>((resolve, reject) => {
            const timeout = 5000;
            const interval = 100;
            let elapsed = 0;

            const timer = setInterval(() => {
                // @ts-ignore
                if (typeof window.LightningFS !== 'undefined') {
                    clearInterval(timer);
                    resolve();
                } else {
                    elapsed += interval;
                    if (elapsed >= timeout) {
                        clearInterval(timer);
                        reject(new Error("LightningFS timeout"));
                    }
                }
            }, interval);
        });
    }

    // @ts-ignore
    const LightningFS = window.LightningFS;
    if (!LightningFS) {
        throw new Error("LightningFS not found on window object.");
    }

    _cachedFS = new LightningFS('risuGitFS');
    if (!_cachedFS) {
        throw new Error("LightningFS failed");
    }
    return _cachedFS;
}

export async function getFs(): Promise<WrappedFS> {
    if (_cachedFS) {
        return _cachedFS;
    }

    if (!_cachedPromise) {
        _cachedPromise = _getFs().then(fs => {
            _cachedFS = fs;
            _cachedPromise = null; // Clear promise after resolution
            return fs;
        });
    }

    return _cachedPromise;
}

export async function fileExists(filepath: string) {
    try {
        const fs = await getFs();
        // 파일의 상태 정보를 가져오려고 시도합니다.
        await fs.promises.stat(filepath);

        // 성공하면 (오류가 없으면) 파일이 존재하는 것입니다.
        return true;
    } catch (e: any) {
        // 오류가 발생했을 때, 오류 코드를 확인합니다.
        if (e.toString().indexOf('ENOENT') !== -1) {
            // 'ENOENT' 코드는 'No such file or directory' (파일/디렉터리 없음)을 의미합니다.
            return false;
        } else {
            // 'ENOENT' 외의 다른 오류 (예: 권한 문제)일 수 있습니다.
            // 이 경우, 오류를 그대로 다시 발생시켜 호출한 쪽에서 처리하도록 합니다.
            console.error("파일 확인 중 다른 오류 발생:", e);
            throw e;
        }
    }
}

export async function calculateFSUsage(dirPath = '/') {
    let totalSize = 0;
    const fs = await getFs();

    try {
        const entries = await fs.promises.readdir(dirPath);

        for (const entry of entries) {
            const entryPath = dirPath === '/' ? `/${entry}` : `${dirPath}/${entry}`;
            const stats = await fs.promises.stat(entryPath);

            if (stats.type === 'file') {
                totalSize += stats.size;
            } else if (stats.type === 'dir') {
                totalSize += await calculateFSUsage(entryPath);
            }
        }
    } catch (error) {
        console.error(`디렉토리(${dirPath}) 읽기 오류:`, error);
    }

    return totalSize;
}

export async function safeMkdir(path: string) {
    try {
        const fs = await getFs();
        await fs.promises.mkdir(path)
    } catch (e: any) {
        console.log(e)
        if (e.toString().indexOf('EEXIST') !== -1) {
            return;
        } else {
            throw e;
        }
    }
}

export async function recursiveRmdir(dir: string) {
    let entries;
    const fs = await getFs();
    try {
        // 1. Read all files and folders in the directory
        entries = await fs.promises.readdir(dir);
    } catch (err: any) {
        console.log(err)
        if (err.toString().indexOf("ENOENT") !== -1) {
            return;
        }
        throw err;
    }

    // 2. Loop through all entries and delete them
    for (const entry of entries) {
        const entryPath = `${dir}/${entry}`;
        const stat = await fs.promises.stat(entryPath);

        if (stat.type === 'file') {
            // 3. If it's a file, delete it
            await fs.promises.unlink(entryPath);
        } else if (stat.type === 'dir') {
            // 4. If it's a directory, call this function recursively
            await recursiveRmdir(entryPath);
        }
    }

    // 5. After the directory is empty, delete it
    await fs.promises.rmdir(dir);
}