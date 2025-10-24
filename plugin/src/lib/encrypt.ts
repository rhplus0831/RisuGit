// 전역 인코더/디코더 재사용
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let derivedKeyPromise: Promise<CryptoKey> | null = null;

// 키를 암호화 키로 변환하는 함수
async function deriveKey(password: string) {
    if (!derivedKeyPromise) {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            textEncoder.encode(password),
            {name: 'PBKDF2'},
            false,
            ['deriveBits', 'deriveKey']
        );

        // 고정된 salt 사용 (결정론적 결과를 위해)
        const salt = textEncoder.encode('fixed-salt-for-deterministic');

        derivedKeyPromise = crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 10000,
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

async function uuidToIV(uuid: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const data = encoder.encode(uuid);
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
async function encryptString(text: string, key: CryptoKey, iv: BufferSource): Promise<string> {
    const data = textEncoder.encode(text);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const b64 = uint8ToBase64(new Uint8Array(encrypted));
    return `enc:${b64}`;
}

// 문자열을 복호화하는 함수
async function decryptString(encryptedText: string, key: CryptoKey, iv: BufferSource): Promise<string> {
    if (!encryptedText.startsWith('enc:')) return encryptedText;
    const b64 = encryptedText.slice(4);
    try {
        const encryptedData = base64ToUint8(b64);
        if (encryptedData.length < 17) return encryptedText;
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedData as BufferSource);
        return textDecoder.decode(decrypted);
    } catch {
        return encryptedText;
    }
}

// 재귀적으로 객체를 순회하며 32자 이상의 문자열 암호화
async function encryptLongStrings(obj: any, key: any, iv: BufferSource): Promise<any> {
    if (typeof obj === 'string') {
        if (obj.length >= 32) {
            // 암호화 결과를 반환해야 함
            return await encryptString(obj, key, iv);
        }
        return obj;
    } else if (Array.isArray(obj)) {
        const result = [];
        for (const item of obj) {
            result.push(await encryptLongStrings(item, key, iv));
        }
        return result;
    } else if (obj !== null && typeof obj === 'object') {
        const result: any = {};
        for (const [key_name, value] of Object.entries(obj)) {
            if (key_name === "chaId") {
                result[key_name] = value;
            } else if (typeof value === 'string' && value.length >= 32) {
                result[key_name] = await encryptString(value, key, iv);
            } else {
                result[key_name] = await encryptLongStrings(value, key, iv);
            }
        }
        return result;
    }
    return obj;
}

// 재귀적으로 객체를 순회하며 암호화된 문자열 복호화
async function decryptStrings(obj: any, key: any, iv: BufferSource): Promise<any> {
    if (typeof obj === 'string') {
        // 문자열일 때만, 접두사가 있을 때만 복호화
        return await decryptString(obj, key, iv);
    } else if (Array.isArray(obj)) {
        const result = [];
        for (const item of obj) {
            result.push(await decryptStrings(item, key, iv));
        }
        return result;
    } else if (obj !== null && typeof obj === 'object') {
        const result: any = {};
        for (const [key_name, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                result[key_name] = await decryptString(value, key, iv);
            } else {
                result[key_name] = await decryptStrings(value, key, iv);
            }
        }
        return result;
    }
    return obj;
}

// 메인 실행 코드 (암호화)
export async function processCharacters(characters: any = null) {
    if(characters == null) {
        const dbData = getDatabase();
        characters = dbData.characters;
    }
    // 'test' 문자열로 암호화 키 생성
    const encryptionKey = await deriveKey('test');

    const encryptedCharacters = [];

    for (const character of characters) {
        // character는 dict type data
        const iv = await uuidToIV(character["chaId"])

        const encryptedCharacter = await encryptLongStrings(character, encryptionKey, iv as BufferSource);
        encryptedCharacters.push(encryptedCharacter);
    }

    return encryptedCharacters;
}

// 복호화 예시
export async function decryptCharacters(encryptedCharacters: any[]) {
    const encryptionKey = await deriveKey('test');

    const decryptedCharacters = [];

    for (const character of encryptedCharacters) {
        const iv = await uuidToIV(character["chaId"]);
        const decryptedCharacter = await decryptStrings(character, encryptionKey, iv as BufferSource);
        decryptedCharacters.push(decryptedCharacter);
    }

    return decryptedCharacters;
}

// 사용 예시
async function example() {
    // 암호화
    const t0 = (globalThis.performance ?? { now: () => Date.now() }).now();
    const encrypted = await processCharacters();
    const t1 = (globalThis.performance ?? { now: () => Date.now() }).now();
    console.log(`암호화 시간: ${(t1 - t0).toFixed(2)} ms`);
    console.log('암호화 완료:', encrypted);

    // 복호화
    const t2 = (globalThis.performance ?? { now: () => Date.now() }).now();
    const decrypted = await decryptCharacters(encrypted);
    const t3 = (globalThis.performance ?? { now: () => Date.now() }).now();
    console.log(`복호화 시간: ${(t3 - t2).toFixed(2)} ms`);
    console.log('복호화 완료:', decrypted);
}

// example().catch((reason) => {
//     console.log('Error:', reason);
// });

export {};