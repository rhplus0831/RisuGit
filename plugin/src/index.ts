import {Buffer} from 'buffer';
import {unloadButton} from "./lib/buttonInjection";
import {unloadReplacer} from "./lib/automatic";
import {getAssetList} from "./lib/asset";

globalThis.Buffer = Buffer;

export * from './lib/encrypt';
export * from './lib/buttonInjection'
export * from './lib/automatic'

if (process.env.NODE_ENV === 'development') {
    console.log(JSON.parse(JSON.stringify(getDatabase())))
}

onUnload(() => {
    unloadButton();
    unloadReplacer()
})

console.log(getAssetList())