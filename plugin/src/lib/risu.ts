// LICENSED: https://github.com/kwaroran/RisuAI/blob/main/LICENSE

export interface SlicedMessage {
    chatId: string,
    data: string
}

export interface SlicedChat {
    id: string
    name: string
    message: SlicedMessage[]
}

export type AssetData = [localName: string, filePath: string, fileType: string];
export type EmotionData = [emotionName: string, filePath: string]

export interface SlicedCharacter {
    chaId: string
    chats: SlicedChat[],
    name: string,
    chatPage: number,
    additionalAssets: AssetData[] | undefined,
    image: string,
    emotionImages: EmotionData[] | undefined,
    ccAssets: AssetData[] | undefined,
    lastInteraction: number
}

export interface IndexedCharacter extends SlicedCharacter {
    index: number
}

export interface SlicedModule {
    assets: AssetData[] | undefined
}

/**
 * 프로젝트용으로 저장해야할 부분만 정의한 데이터
 */
export interface SlicedDatabase {
    characters: SlicedCharacter[];
    characterOrder: any[];
    loreBook: any[];
    personas: any[];
    modules: SlicedModule[];
    statics: any;
    statistics: any;
    botPresets: any[];
    customBackground: string
    userIcon: string
}

export interface OpenAIChat {
    role: 'system' | 'user' | 'assistant' | 'function'
    content: string
    memo?: string
    name?: string
    removable?: boolean
    attr?: string[]
    multimodals?: MultiModal[]
    thoughts?: string[]
    cachePoint?: boolean
}

export interface MultiModal {
    type: 'image' | 'video' | 'audio'
    base64: string,
    height?: number,
    width?: number
}

export interface SlicedStorage {
    getItem(key: string): Promise<Buffer>;

    setItem(key: string, value: any): Promise<Buffer>;

    keys(prefix: string): Promise<string[]>

    isAccount: boolean;
}

type ReplacerFunction = (content: OpenAIChat[], type: string) => OpenAIChat[] | Promise<OpenAIChat[]>