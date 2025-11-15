import {BaseOverlay} from "./baseOverlay";
import {pushAssetsToServer} from "../lib/asset";
import {wrapMessage, wrapProgress} from "./modal-logic";

export function assetPushLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    pushAssetsToServer(wrapProgress(overlay, container)).then((message) => {
        wrapMessage(overlay, container, message)
    })

    return undefined;
}