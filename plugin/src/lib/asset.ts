import {getAssetServer} from "./configure";

const retryDelays = [1000, 2000, 4000, 8000];
const maxRetries = retryDelays.length;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const concurrencyLimit = 8;

function getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'png':
            return 'image/png';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'gif':
            return 'image/gif';
        case 'webp':
            return 'image/webp';
        case 'svg':
            return 'image/svg+xml';
        default:
            return 'application/octet-stream';
    }
}

export async function pushAsset(path: string, type: string = "") {
    const name = path.replace(/^.*[\\/]/, '')
    const check = await fetch(`${getAssetServer()}/${name}`, {
        method: 'HEAD',
        headers: {
            'x-risu-git-flag': '1'
        }
    })
    if (check.ok) return;

    const data = await forageStorage.getItem(path);
    const blobData = new Blob([data], {
        type: type ?? getMimeType(name)
    });

    const formData = new FormData();

    formData.append('file', blobData, name);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(`${getAssetServer()}/${name}`, {
                method: 'PUT',
                body: formData,
                headers: {
                    'x-risu-git-flag': '1'
                }
            });
            if (response.ok) {
                return;
            }

            if (attempt === maxRetries) {
                break;
            }

            // 재시도 전 대기
            const waitTime = retryDelays[attempt];
            await delay(waitTime);
        } catch (error) {
            console.log(error)
            const waitTime = retryDelays[attempt];
            await delay(waitTime);
        }
    }
}

export function getAssetURL(path: string) {
    const name = path.replace(/^.*[\\/]/, '')
    return `${getAssetServer()}/${name}`
}

export async function pullAssetData(path: string) {
    const url = getAssetURL(path)
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'x-risu-git-flag': '1'
                }
            });
            if (response.ok) {
                return await response.bytes();
            }

            if (attempt === maxRetries) {
                break;
            }

            // 재시도 전 대기
            const waitTime = retryDelays[attempt];
            await delay(waitTime);
        } catch (error) {
            console.log(error)
            const waitTime = retryDelays[attempt];
            await delay(waitTime);
        }
    }
}

export async function pullAsset(path: string) {
    // 이미 존재하는지 확인
    try {
        const data = await forageStorage.getItem(path)
        if (data) return;
    } catch {

    }

    const data = await pullAssetData(path);
    await forageStorage.setItem(path, data)
}

export function getAssetList() {
    return getUnpargeables(getDatabase(), 'pure')
}

export async function pushAssetsToServer(progressCallback: (message: string) => Promise<void>) {
    const assetList = getAssetList();
    let completedAssets = 0;

    if (assetList.length === 0) {
        await progressCallback("No assets to push.");
        return;
    }

    await progressCallback(`Starting upload of ${assetList.length} assets.`);

    const progressInterval = setInterval(() => {
        progressCallback(`Uploading assets: ${completedAssets} / ${assetList.length} completed.`);
    }, 5000);

    try {
        const queue = [...assetList];

        const worker = async () => {
            while (true) {
                const assetPath = queue.shift();
                if (!assetPath) {
                    break; // No more items in the queue
                }

                try {
                    await pushAsset(assetPath);
                } catch (error) {
                    console.error(`Failed to upload asset ${assetPath}:`, error);
                } finally {
                    completedAssets++;
                }
            }
        };

        const workers = Array.from({length: concurrencyLimit}, () => worker());
        await Promise.all(workers);
    } finally {
        clearInterval(progressInterval);
        // Final progress report to ensure it shows 100%
        await progressCallback(`Asset upload finished. ${completedAssets} / ${assetList} completed.`);
        console.log(`Push server process completed. Total: ${completedAssets}/${assetList}`);
    }
}

export async function pullAssetFromServer(progressCallback: (message: string) => Promise<void>) {
    if (forageStorage.isAccount) {
        throw new Error("에셋 복원 방식상(다중 요청) 리스 서버에 부하를 줄 수 있기 때문에 리스 계정이 연결된 상태에서는 에셋을 복원할 수 없습니다.")
    }

    const assetList = getAssetList();
    let completedAssets = 0;

    if (assetList.length === 0) {
        await progressCallback("No assets to pull.");
        return;
    }

    await progressCallback(`Starting download of ${assetList.length} assets.`);

    const progressInterval = setInterval(() => {
        progressCallback(`Downloading assets: ${completedAssets} / ${assetList.length} completed.`);
    }, 5000);

    try {
        const queue = [...assetList];

        const worker = async () => {
            while (true) {
                const assetPath = queue.shift();
                if (!assetPath) {
                    break; // No more items in the queue
                }

                try {
                    await pullAsset(assetPath);
                } catch (error) {
                    console.error(`Failed to upload asset ${assetPath}:`, error);
                } finally {
                    completedAssets++;
                }
            }
        };

        const workers = Array.from({length: concurrencyLimit}, () => worker());
        await Promise.all(workers);
    } finally {
        clearInterval(progressInterval);
        // Final progress report to ensure it shows 100%
        await progressCallback(`Asset download finished. ${completedAssets} / ${assetList} completed.`);
        console.log(`Pull server process completed. Total: ${completedAssets}/${assetList}`);
    }
}