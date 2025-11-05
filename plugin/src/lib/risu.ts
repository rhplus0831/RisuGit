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

export interface SlicedCharacter {
    chaId: string
    chats: SlicedChat[],
    name: string,
    chatPage: number
}

export interface IndexedCharacter extends SlicedCharacter {
    index: number
}

/**
 * 프로젝트용으로 저장해야할 부분만 정의한 데이터
 */
export interface SlicedDatabase {
    characters: SlicedCharacter[];
    characterOrder: any[];
    loreBook: any[];
    personas: any[];
    modules: any[];
    statics: any;
    statistics: any;
    botPresets: any[];
}

export interface OpenAIChat{
    role: 'system'|'user'|'assistant'|'function'
    content: string
    memo?:string
    name?:string
    removable?:boolean
    attr?:string[]
    multimodals?: MultiModal[]
    thoughts?: string[]
    cachePoint?: boolean
}

export interface MultiModal{
    type:'image'|'video'|'audio'
    base64:string,
    height?:number,
    width?:number
}

type ReplacerFunction = (content: OpenAIChat[], type: string) => OpenAIChat[] | Promise<OpenAIChat[]>