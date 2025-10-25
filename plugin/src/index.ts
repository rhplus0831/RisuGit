import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

export * from './lib/encrypt';
export * from './lib/buttonInjection'

// console.log(getDatabase())