import {BaseOverlay} from "./baseOverlay";
import {pushRepository, saveCharacterAndCommit, saveDatabaseAndCommit} from "../lib/git";
import overlayTemplate from './panel.html';
import {popMessage, popProgress} from "./modal-logic";

import {disableButtonIfRemoteIsInvalid} from "../lib/utils";

export function quickLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    const closeButton = container.querySelector<HTMLButtonElement>('#rg-quick-close-button');
    const allButton = container.querySelector<HTMLButtonElement>('#rg-quick-all-button');
    const characterButton = container.querySelector<HTMLButtonElement>('#rg-quick-character-button');
    const chatButton = container.querySelector<HTMLButtonElement>('#rg-quick-chat-button');
    const pushButton = container.querySelector<HTMLButtonElement>('#rg-quick-push-button');
    const overlayButton = container.querySelector<HTMLButtonElement>('#rg-quick-overlay-button');

    const characterNameSpan = container.querySelector<HTMLSpanElement>('#rg-quick-character')
    const chatNameSpan = container.querySelector<HTMLSpanElement>('#rg-quick-chat')

    if (!closeButton || !allButton || !characterButton || !chatButton || !pushButton || !overlayButton) {
        console.log("버튼... 없다?", closeButton, allButton, characterButton, chatButton, pushButton, overlayButton)
        return;
    }

    if (!characterNameSpan || !chatNameSpan) {
        console.log("이름 스팬... 없다?")
        return;
    }

    closeButton.addEventListener('click', () => {
        overlay.close()
    })

    disableButtonIfRemoteIsInvalid(pushButton)

    const char = getChar()
    characterNameSpan.innerText = char.name
    chatNameSpan.innerText = char.chats[char.chatPage].name

    allButton.onclick = async () => {
        const message = prompt('(전체 저장) 커밋 메시지를 정하세요', '세이브 데이터');
        if (!message) return;
        const progress = await popProgress()
        try {
            const isChanged = await saveDatabaseAndCommit(message, progress.callback);
            progress.overlay.close()
            if (!isChanged) {
                await popMessage('변경 사항이 없습니다!')
            } else {
                await popMessage(`저장되었습니다: ${isChanged}`)
            }
        } catch (reason) {
            progress.overlay.close()
            await popMessage(`저장에 실패했습니다: ${reason}`)
        }
    }

    characterButton.onclick = async () => {
        const message = prompt('(캐릭터 저장) 커밋 메시지를 정하세요', '세이브 데이터');
        if (!message) return;
        const progress = await popProgress()
        try {
            const isChanged = await saveCharacterAndCommit(message, char.chaId, undefined, progress.callback);
            progress.overlay.close()
            if (!isChanged) {
                await popMessage('변경 사항이 없습니다!')
            } else {
                await popMessage(`저장되었습니다: ${isChanged}`)
            }
        } catch (reason) {
            progress.overlay.close()
            await popMessage(`저장에 실패했습니다: ${reason}`)
        }
    }

    chatButton.onclick = async () => {
        const message = prompt('(채팅 저장) 커밋 메시지를 정하세요', '세이브 데이터');
        if (!message) return;
        const progress = await popProgress()
        try {
            const isChanged = await saveCharacterAndCommit(message, char.chaId, char.chats[char.chatPage].id, progress.callback);
            progress.overlay.close()
            if (!isChanged) {
                await popMessage('변경 사항이 없습니다!')
            } else {
                await popMessage(`저장되었습니다: ${isChanged}`)
            }
        } catch (reason) {
            progress.overlay.close()
            await popMessage(`저장에 실패했습니다: ${reason}`)
        }
    }

    pushButton.onclick = async () => {
        const progress = await popProgress()
        await progress.callback('저장소에 올리는 중입니다...')
        try {
            await pushRepository()
            progress.overlay.close()
            await popMessage('푸시되었습니다.')
        } catch (reason) {
            progress.overlay.close()
            await popMessage(`업로드에 실패했습니다, 설정창에서 다시 시도해주세요: ${reason}`)
        }
    }

    overlayButton.addEventListener('click', async () => {
        const overlay = new BaseOverlay()
        await overlay.show(overlayTemplate, quickLogic)
    })

    return undefined;
}