import {BaseOverlay} from "./baseOverlay";
import {pushAssetsToServer} from "../lib/asset";

export function assetPushLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    const progress = container.querySelector<HTMLSpanElement>('#rg-progress');
    if(!progress) return undefined;
    pushAssetsToServer(async (message) => {
        progress.innerText = message
    }).then(() => {
        overlay.close();
    })

    return undefined;
}