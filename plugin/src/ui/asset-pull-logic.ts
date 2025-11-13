import {BaseOverlay} from "./baseOverlay";
import {pullAssetFromServer, pushAssetsToServer} from "../lib/asset";
import {wrapConfirm, wrapProgress} from "./progress-logic";

export function assetPullLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    pullAssetFromServer(wrapProgress(overlay, container)).then((message) => {
        wrapConfirm(overlay, container, message)
    })

    return undefined;
}