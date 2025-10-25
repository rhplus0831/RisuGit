// 인코더 캐싱
import {getEncryptKey} from "./configure";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const testValue = "risu-git-is-awesome-i-dont-know-but-it-is-long-string-for-test-toooooooooooooooooooooooooooooooo-long";

/**
 * 암호화 해제된 데이터베이스
 */
export interface DecryptedDatabase {
    characters: any[];
    characterOrder: any[];
    loreBook: any[];
    personas: any[];
    modules: any[];
    statics: any;
    statistics: any;
    botPresets: any[];
    // banCharacterset: any[]; 캐릭터 데이터가 아니였어
}

/**
 * 원본 데이터베이스에서 필요한 부분을 자른 사본을 반환
 */
export function getDecryptDatabase(): DecryptedDatabase {
    const database = getDatabase();
    return JSON.parse(JSON.stringify({
        characters: database.characters,
        characterOrder: database.characterOrder
    }))
}

/**
 * 암호화된 데이터 베이스
 */
export interface EncryptDatabase extends DecryptedDatabase {
    decryptTest: string
}

// 한번 만든 키는 잘 변하지 않으므로 캐싱
let derivedKeyPromise: Promise<CryptoKey> | null = null;
let cachedPassword: string | null = null;

/**
 * 패스워드를 키로 변환
 * @param password 패스워드
 */
async function deriveKey(password: string) {
    if (!derivedKeyPromise || !cachedPassword || cachedPassword != password) {
        cachedPassword = password
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            textEncoder.encode(password),
            {name: 'PBKDF2'},
            false,
            ['deriveBits', 'deriveKey']
        );

        const salt = textEncoder.encode("risu-git-" + password);

        derivedKeyPromise = crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 600000,
                hash: 'SHA-256',
            },
            keyMaterial,
            {name: 'AES-GCM', length: 256},
            false,
            ['encrypt', 'decrypt']
        );
    }
    return derivedKeyPromise;
}

/**
 * Uint8Array를 생성하고 crypto.getRandomValues()로 안전한 랜덤 데이터를 채워 IV 값을 만듭니다.
 */
function generateRandomIV(length: number = 12): Uint8Array {
    const iv = new Uint8Array(length);
    crypto.getRandomValues(iv);
    return iv;
}

async function stringToIV(stringData: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    // add header
    const data = encoder.encode("risu-git-" + stringData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    // Ensure iv has an ArrayBuffer (not ArrayBufferLike)
    const iv = new Uint8Array(12);
    iv.set(new Uint8Array(hashBuffer, 0, 12));
    return iv;
}

// Uint8Array <-> base64 (Node 우선, 브라우저 폴백)
function uint8ToBase64(u8: Uint8Array): string {
    // @ts-ignore
    if (typeof Buffer !== 'undefined') {
        // @ts-ignore
        return Buffer.from(u8).toString('base64');
    }
    let binary = '';
    const len = u8.length;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(u8[i]);
    // @ts-ignore
    return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
    // @ts-ignore
    if (typeof Buffer !== 'undefined') {
        // @ts-ignore
        return new Uint8Array(Buffer.from(b64, 'base64'));
    }
    // @ts-ignore
    const raw = atob(b64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

// 문자열을 암호화하는 함수
async function encryptString(text: string, key: CryptoKey, iv: BufferSource | null = null): Promise<string> {
    const data = textEncoder.encode(text);
    if (!iv) {
        iv = (await stringToIV(text)) as BufferSource
    }
    const encrypted = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, data);
    const b64 = uint8ToBase64(new Uint8Array(encrypted));
    const ivB64 = uint8ToBase64(new Uint8Array(iv as Uint8Array));
    return `enc::${ivB64}::${b64}`;
}

// 문자열을 복호화하는 함수
async function decryptString(encryptedText: string, key: CryptoKey): Promise<string> {
    if (!encryptedText.startsWith('enc::')) return encryptedText;
    const split = encryptedText.split("::")
    const ivB64 = split[1]
    const iv = base64ToUint8(ivB64) as BufferSource;
    const b64 = split[2]
    const encryptedData = base64ToUint8(b64);
    const decrypted = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, key, encryptedData as BufferSource);
    return textDecoder.decode(decrypted);
}

// 재귀적으로 객체를 순회하며 32자 이상의 문자열 암호화
async function encryptValuesRecursively(obj: any, key: any): Promise<any> {
    if (typeof obj === 'string') {
        return await encryptString(obj, key);
    } else if (Array.isArray(obj)) {
        const result = [];
        for (const item of obj) {
            result.push(await encryptValuesRecursively(item, key));
        }
        return result;
    } else if (obj !== null && typeof obj === 'object') {
        const result: any = {};
        for (const [key_name, value] of Object.entries(obj)) {
            if (typeof value === 'string' && value.length >= 32) {
                result[key_name] = await encryptString(value, key);
            } else {
                result[key_name] = await encryptValuesRecursively(value, key);
            }
        }
        return result;
    }
    return obj;
}

// 재귀적으로 객체를 순회하며 암호화된 문자열 복호화
async function decryptValuesRecursively(obj: any, key: any): Promise<any> {
    if (typeof obj === 'string') {
        // 문자열일 때만, 접두사가 있을 때만 복호화
        return await decryptString(obj, key);
    } else if (Array.isArray(obj)) {
        const result = [];
        for (const item of obj) {
            result.push(await decryptValuesRecursively(item, key));
        }
        return result;
    } else if (obj !== null && typeof obj === 'object') {
        const result: any = {};
        for (const [key_name, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                result[key_name] = await decryptString(value, key);
            } else {
                result[key_name] = await decryptValuesRecursively(value, key);
            }
        }
        return result;
    }
    return obj;
}

// 메인 실행 코드 (암호화)
export async function encryptDatabase(database: any | null = null, salt: string | null = null) {
    if (database == null) {
        database = getDatabase(); //여기서 수정을 하지 않으니 데이터베이스를 그대로 얻어옴
    }
    const encryptionKey = await deriveKey(getEncryptKey());

    // 문자열을 넣으면 반드시 문자열이 나옴
    const testData = await encryptString(testValue, encryptionKey)

    const encryptedDatabase: EncryptDatabase = {
        characters: await encryptValuesRecursively(database.characters, encryptionKey),
        characterOrder: await encryptValuesRecursively(database.characterOrder, encryptionKey),
        botPresets: await encryptValuesRecursively(database.botPresets, encryptionKey),
        personas: await encryptValuesRecursively(database.personas, encryptionKey),
        loreBook: await encryptValuesRecursively(database.loreBook, encryptionKey),
        modules: await encryptValuesRecursively(database.modules, encryptionKey),
        statics: await encryptValuesRecursively(database.statics, encryptionKey),
        statistics: await encryptValuesRecursively(database.statistics, encryptionKey),
        decryptTest: testData,
    }

    return encryptedDatabase;
}

// 복호화 예시
export async function decryptDatabase(encryptedDatabase: EncryptDatabase): Promise<DecryptedDatabase> {
    const encryptionKey = await deriveKey(getEncryptKey());

    let testData = "";
    try {
        testData = await decryptString(encryptedDatabase.decryptTest, encryptionKey);
    } catch {
        throw new Error("암호화 키가 다르거나 데이터가 손상되었습니다.")
    }

    if (testData != testValue) {
        throw new Error("암호화 키가 다르거나 데이터가 손상되었습니다.")
    }

    return {
        characters: await decryptValuesRecursively(encryptedDatabase.characters, encryptionKey),
        characterOrder: await decryptValuesRecursively(encryptedDatabase.characterOrder, encryptionKey),
        statistics: await decryptValuesRecursively(encryptedDatabase.statistics, encryptionKey),
        statics: await decryptValuesRecursively(encryptedDatabase.statics, encryptionKey),
        modules: await decryptValuesRecursively(encryptedDatabase.modules, encryptionKey),
        loreBook: await decryptValuesRecursively(encryptedDatabase.loreBook, encryptionKey),
        personas: await decryptValuesRecursively(encryptedDatabase.personas, encryptionKey),
        botPresets: await decryptValuesRecursively(encryptedDatabase.botPresets, encryptionKey)
    };
}

// 사용 예시
async function example() {
    // 암호화
    const t0 = (globalThis.performance ?? {now: () => Date.now()}).now();
    const encrypted = await encryptDatabase();
    const t1 = (globalThis.performance ?? {now: () => Date.now()}).now();
    console.log(`암호화 시간: ${(t1 - t0).toFixed(2)} ms`);
    console.log('암호화 완료:', encrypted);

    // 복호화
    const t2 = (globalThis.performance ?? {now: () => Date.now()}).now();
    const decrypted = await decryptDatabase(encrypted);
    const t3 = (globalThis.performance ?? {now: () => Date.now()}).now();
    console.log(`복호화 시간: ${(t3 - t2).toFixed(2)} ms`);
    console.log('복호화 완료:', decrypted);
}

// example().catch((reason) => {
//     console.log('Error:', reason);
// });

export {};