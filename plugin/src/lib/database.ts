export interface SlicedMessage {
    chatId: string,
    data: string
}

export interface SlicedChat {
    id: string
    message: SlicedMessage[]
}

export interface SlicedCharacter {
    chaId: string
    chats: SlicedChat[]
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