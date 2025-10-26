import {Buffer} from 'buffer';

globalThis.Buffer = Buffer;

export * from './lib/encrypt';
export * from './lib/buttonInjection'

if (process.env.NODE_ENV === 'development') {
    console.log(JSON.parse(JSON.stringify(getDatabase())))
}