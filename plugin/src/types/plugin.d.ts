declare function getDatabase(): SlicedDatabase;
declare function setDatabase(data: any): void;
declare function getChar(): SlicedCharacter;
declare function addRisuReplacer(name: string, func: ReplacerFunction)
declare function removeRisuReplacer(name: string, func: ReplacerFunction)
declare function onUnload(callback: () => void);
declare async function getFileSrc(loc: string): Promise<string>;
declare const forageStorage: SlicedStorage;
declare function getUnpargeables(db: SlicedDatabase, uptype: 'basename' | 'pure' = 'basename')