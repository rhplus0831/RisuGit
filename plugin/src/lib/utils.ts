import {getAssetServer, remoteIsValid} from "./configure";

const retryDelays = [1000, 2000, 4000, 8000];
const maxRetries = retryDelays.length;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function setById(div: HTMLDivElement, id: string, value: string) {
    const item = div.querySelector(`#${id}`);
    if (item) {
        item.innerHTML = value;
    } else {
        console.log(`Cannot find ${id}`)
    }
}

export async function retryFetch(url: string | URL | Request, request: RequestInit) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, request);
            if (response.ok) {
                return response;
            }

            console.log("Failed? ", response.status)

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
    throw new Error("Reached retry limit")
}

export function disableButtonIfRemoteIsInvalid(button: HTMLButtonElement) {
    if (!remoteIsValid()) {
        button.classList.add('rg-opacity-50', 'rg-cursor-not-allowed', 'flag-disabled')
        button.disabled = true;
        button.innerHTML += ' (원격 설정 필요)'
    }
}

export function disableButtonIfAssetServerIsInvalid(button: HTMLButtonElement) {
    if (!getAssetServer().trim()) {
        button.classList.add('rg-opacity-50', 'rg-cursor-not-allowed', 'flag-disabled')
        button.disabled = true;
        button.innerHTML += ' (에셋 서버 필요)'
    }
}