import {BaseOverlay} from "./baseOverlay";
import {pullAssetFromServer, pushAssetsToServer} from "../lib/asset";
import {wrapMessage, wrapProgress} from "./modal-logic";

export function assetPullLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    pullAssetFromServer(wrapProgress(overlay, container)).then((message) => {
        wrapMessage(overlay, container, message)
    })

    return undefined;
}