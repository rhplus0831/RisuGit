import {Buffer} from 'buffer';
import {unloadButton} from "./lib/elementInjection";
import {unloadReplacer} from "./lib/automatic";
import {getAssetList} from "./lib/asset";

globalThis.Buffer = Buffer;

export * from './lib/encrypt';
export * from './lib/elementInjection'
export * from './lib/automatic'

if (process.env.NODE_ENV === 'development') {
    console.log(JSON.parse(JSON.stringify(getDatabase())))
}

onUnload(() => {
    unloadButton();
    unloadReplacer()
})
export {showOrUpdateIndicator} from "./lib/indicator";
export {hideIndicator} from "./lib/indicator";