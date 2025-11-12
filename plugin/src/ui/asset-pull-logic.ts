import {BaseOverlay} from "./baseOverlay";
import {pullAssetFromServer, pushAssetsToServer} from "../lib/asset";

export function assetPullLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    const progress = container.querySelector<HTMLSpanElement>('#rg-progress');
    if(!progress) return undefined;
    pullAssetFromServer(async (message) => {
        progress.innerText = message
    }).then(() => {
        overlay.close();
    })

    return undefined;
}