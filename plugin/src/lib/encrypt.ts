// 인코더 캐싱
import {getEncryptPassword} from "./configure";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// 한번 만든 키는 잘 변하지 않으므로 캐싱
let derivedKeyPromise: Promise<CryptoKey> | null = null;
let cachedPassword: string | null = null;

/**
 * 패스워드를 키로 변환
 * @param password 패스워드
 */
export async function deriveKey(password: string) {
    if (!derivedKeyPromise || !cachedPassword || cachedPassword != password) {
        if(!password) {
            throw new Error("암호화 키를 지정해야 합니다")
        }
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
export async function encryptString(text: string, key: CryptoKey, iv: BufferSource | null = null): Promise<string> {
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
export async function decryptString(encryptedText: string, key: CryptoKey): Promise<string> {
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
export async function encryptValuesRecursively(obj: any, key: CryptoKey): Promise<any> {
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
export async function decryptValuesRecursively(obj: any, key: any): Promise<any> {
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

export {};