import {BaseOverlay} from "./baseOverlay";
import {pushAssetsToServer} from "../lib/asset";
import {wrapConfirm, wrapProgress} from "./progress-logic";

export function assetPushLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    pushAssetsToServer(wrapProgress(overlay, container)).then((message) => {
        wrapConfirm(overlay, container, message)
    })

    return undefined;
}