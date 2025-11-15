import {
    getAutomaticPush,
    getBootstrapPull, getBootstrapPushAsset,
    getBootstrapSavePushCharacter, getBootstrapSavePushOther,
    getOnRequestSaveChat,
    remoteIsValid, setBootstrapPull
} from "./configure";
import {pullRepository, pushRepository, saveCharacterAndCommit, saveDatabaseAndCommit, saveOtherAndCommit} from "./git";
import {SlicedChat} from "./risu";
import {popMessage} from "../ui/modal-logic";
import {hideIndicator, showOrUpdateIndicator} from "./indicator";
import {pushAssetsToServer} from "./asset";

let activeRequests = 0;
let debounceTimer: number | undefined = undefined;

(async function () {
    try {
        const indicator = showOrUpdateIndicator("초기화...")
        if (remoteIsValid() && getBootstrapPull()) {
            showOrUpdateIndicator("데이터 가져오는중...", indicator)
            await pullRepository()
        }

        if (getBootstrapSavePushOther()) {
            showOrUpdateIndicator('기타 데이터 저장...')
            await saveOtherAndCommit()
        }

        if (getBootstrapSavePushCharacter()) {
            await saveDatabaseAndCommit("자동 저장", async (message) => {
                showOrUpdateIndicator(message, indicator)
            })
        }

        if (getBootstrapSavePushCharacter() || getBootstrapSavePushOther()) {
            if (remoteIsValid()) {
                showOrUpdateIndicator("데이터 보내는중...", indicator)
                await pushRepository()
            }
        }

        if(getBootstrapPushAsset()) {
            showOrUpdateIndicator('에셋 보내기 준비...')
            await pushAssetsToServer(async (message) => {
                showOrUpdateIndicator('에셋 보내기: ' + message)
            })
        }
    } catch (e: any) {
        console.log(e)
        await popMessage("초기 작업중 문제가 발생했습니다: " + e.toString())
    } finally {
        hideIndicator()
    }
})();

async function handleAutoPush() {
    if (!getAutomaticPush()) return;

    showOrUpdateIndicator('자동 푸시중...')

    try {
        await pushRepository()
    } catch (e: any) {
        console.log(e)
        await popMessage("깃 자동푸시중 문제가 발생했습니다: " + e.toString())
        return
    } finally {
        hideIndicator()
    }
}

async function onAllRequestsFinished() {
    if (!getOnRequestSaveChat()) return;

    showOrUpdateIndicator('캐릭터 저장 준비...')
    const char = getChar()
    const currentChat: SlicedChat = char.chats[char.chatPage]
    try {
        const isChanged = await saveCharacterAndCommit(`${char.name}[${currentChat.name}] / ${currentChat.message.length}번째 채팅`, char.chaId, currentChat.id, async (value) => {

        });
    } catch (e: any) {
        console.log(e)
        await popMessage("깃 자동커밋중 문제가 발생했습니다: " + e.toString())
        return
    } finally {
        hideIndicator()
    }

    await handleAutoPush();
}

const beforeFunc = (content: any, mode: any) => {
    if (debounceTimer) {
        window.clearTimeout(debounceTimer);
        debounceTimer = undefined;
    }
    activeRequests++;
    return content;
}

addRisuReplacer('beforeRequest', beforeFunc)

const afterFunc = (content: any, mode: any) => {
    activeRequests--;

    if (activeRequests <= 0) {
        activeRequests = 0;
        if (debounceTimer) {
            window.clearTimeout(debounceTimer);
        }
        debounceTimer = window.setTimeout(() => {
            if (activeRequests <= 0) {
                onAllRequestsFinished();
            }
            debounceTimer = undefined;
        }, 5000)
    }

    return content;
}

addRisuReplacer('afterRequest', afterFunc)

export function unloadReplacer() {
    removeRisuReplacer('beforeRequest', beforeFunc)
    removeRisuReplacer('afterRequest', afterFunc)
}

//elementInjection에서 감지했을때 실행
export async function automaticSaveOther() {
    showOrUpdateIndicator('기타 데이터 저장 준비...')
    try {
        await saveOtherAndCommit()
    } catch (e: any) {
        console.log(e)
        await popMessage("기타 데이터 저장중 문제가 발생했습니다: " + e.toString())
        return
    } finally {
        hideIndicator()
    }

    await handleAutoPush();
}

export {};