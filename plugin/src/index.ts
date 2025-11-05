import {Buffer} from 'buffer';
import {unloadButton} from "./lib/buttonInjection";
import {unloadReplacer} from "./lib/chat-hooker";

globalThis.Buffer = Buffer;

export * from './lib/encrypt';
export * from './lib/buttonInjection'
export * from './lib/chat-hooker'

if (process.env.NODE_ENV === 'development') {
    console.log(JSON.parse(JSON.stringify(getDatabase())))
}

onUnload(() => {
    unloadButton();
    unloadReplacer()
})