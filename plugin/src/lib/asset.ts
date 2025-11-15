import {getAssetServer, getAssetServerConnectionCount} from "./configure";
import {retryFetch} from "./utils";

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

export async function pushAsset(path: string, type: string = ""): Promise<boolean> {
    const name = path.replace(/^.*[\\/]/, '')

    const cacheKey = `head_cache_${name}`;
    const cachedData = localStorage.getItem(cacheKey);
    if(cachedData) {
        return false;
    }

    const check = await retryFetch(`${getAssetServer()}/${name}`, {
        method: 'HEAD'
    })
    if (check.ok) {
        localStorage.setItem(cacheKey, "1");
        return false;
    }

    const data = await forageStorage.getItem(path);
    const blobData = new Blob([data], {
        type: type ?? getMimeType(name)
    });

    const formData = new FormData();

    formData.append('file', blobData, name);

    const response = await retryFetch(`${getAssetServer()}/${name}`, {
        method: 'PUT',
        body: formData,
        headers: {
            'x-risu-git-flag': '1'
        }
    })

    if (response.ok) {
        return true;
    }

    throw new Error("Failed 4 retries...?")
}

export function getAssetURL(path: string) {
    const name = path.replace(/^.*[\\/]/, '')
    return `${getAssetServer()}/${name}`
}

export async function pullAssetData(path: string) {
    const url = getAssetURL(path)
    const response = await retryFetch(url, {
        method: 'GET',
        headers: {
            'x-risu-git-flag': '1'
        }
    });
    if (response.ok) {
        return await response.bytes();
    }
    throw new Error("Failed to pull asset (almost not reached)")
}

/**
 * 에셋을 복원합니다. 에셋이 실제로 복원된경우 true, 이미 있어서 작업이 취소된경우 false 가 반환됩니다
 * @param path
 */
export async function pullAsset(path: string): Promise<boolean> {
    // 이미 존재하는지 확인
    try {
        const data = await forageStorage.getItem(path)
        if (data) return false;
    } catch {

    }

    const data = await pullAssetData(path);
    await forageStorage.setItem(path, data)
    return true;
}

export function getAssetList() {
    return getUnpargeables(getDatabase(), 'pure')
}

export async function pushAssetsToServer(progressCallback: (message: string) => Promise<void>): Promise<string> {
    const assetList = getAssetList();
    let completedAssets = 0;

    if (assetList.length === 0) {
        return "보낼 에셋정보가 없습니다"
    }

    await progressCallback(`${assetList.length}개의 에셋을 올립니다.`);

    const progressInterval = setInterval(() => {
        progressCallback(`에셋 업로드중: ${completedAssets} / ${assetList.length}`);
    }, 1000);

    let alreadyExistCount = 0;
    let okCount = 0;
    let failedCount = 0;

    try {
        const queue = [...assetList];

        const worker = async () => {
            while (true) {
                const assetPath = queue.shift();
                if (!assetPath) {
                    break; // No more items in the queue
                }

                try {
                    const uploaded = await pushAsset(assetPath);
                    if (uploaded) {
                        okCount++;
                    } else {
                        alreadyExistCount++;
                    }
                } catch (error) {
                    console.error(`Failed to upload asset ${assetPath}:`, error);
                    failedCount++;
                } finally {
                    completedAssets++;
                }
            }
        };

        const workers = Array.from({length: getAssetServerConnectionCount()}, () => worker());
        await Promise.all(workers);
    } finally {
        clearInterval(progressInterval);
        // Final progress report to ensure it shows 100%
        console.log(`Push server process completed. Total: ${completedAssets}/${assetList}`);
    }
    return `에셋이 백업되었습니다: ${okCount}개 보냄, ${alreadyExistCount}개 이미 있음, ${failedCount}개 실패`
}

export async function pullAssetFromServer(progressCallback: (message: string) => Promise<void>): Promise<string> {
    if (forageStorage.isAccount) {
        throw new Error("에셋 복원 방식상(다중 요청) 리스 서버에 부하를 줄 수 있기 때문에 리스 계정이 연결된 상태에서는 에셋을 복원할 수 없습니다.")
    }

    const assetList = getAssetList();
    let completedAssets = 0;

    if (assetList.length === 0) {
        return "가져올 에셋정보가 없습니다"
    }

    await progressCallback(`${assetList.length} 개의 에셋을 다운로드 받기 시작합니다.`);

    const progressInterval = setInterval(() => {
        progressCallback(`에셋을 받고 있습니다: ${completedAssets} / ${assetList.length}`);
    }, 1000);

    let alreadyExistCount = 0;
    let failedCount = 0;
    let okCount = 0;

    const keys: string[] = await forageStorage.keys("")
    let map = new Map<string, boolean>();
    keys.forEach((value) => {
        map.set(value, true);
    })

    try {
        const queue = [...assetList];

        const worker = async () => {
            while (true) {
                const assetPath = queue.shift();
                if (!assetPath) {
                    break; // No more items in the queue
                }

                if (map.has(assetPath)) {
                    console.log("Already Exist:" + assetPath)
                    alreadyExistCount++;
                    completedAssets++;
                    continue;
                }

                try {
                    const recover = await pullAsset(assetPath);
                    if (recover) {
                        okCount++;
                    } else {
                        alreadyExistCount++;
                    }
                } catch (error) {
                    console.error(`Failed to upload asset ${assetPath}:`, error);
                } finally {
                    completedAssets++;
                }
            }
        };

        const workers = Array.from({length: getAssetServerConnectionCount()}, () => worker());
        await Promise.all(workers);
    } finally {
        clearInterval(progressInterval);
        // Final progress report to ensure it shows 100%
        console.log(`Pull server process completed. Total: ${completedAssets}/${assetList}`);
    }
    return `에셋이 복구되었습니다: ${okCount}개 받아옴, ${alreadyExistCount}개 이미 있음, ${failedCount}개 실패`
}