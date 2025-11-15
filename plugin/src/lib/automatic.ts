import {getBootstrapPull, getAutomaticPush, getOnRequestSaveChat, remoteIsValid, getBootstrapSavePushCharacter} from "./configure";
import {pullRepository, pushRepository, saveCharacterAndCommit, saveDatabaseAndCommit} from "./git";
import {SlicedChat} from "./risu";

let activeRequests = 0;
let debounceTimer: number | undefined = undefined;

function showOrUpdateGitIndicator(message: string = 'Git 작업 중...', indicator: HTMLDivElement | null = null): HTMLDivElement {
    // 이미 인디케이터가 있는지 확인
    if (!indicator) {
        indicator = document.getElementById('git-autosync-indicator') as HTMLDivElement;
        if(!indicator) {
            // 없다면 새로 생성
            indicator = document.createElement('div');
            indicator.id = 'git-autosync-indicator';
            document.body.appendChild(indicator);

            // 스타일 적용
            Object.assign(indicator.style, {
                position: 'fixed',
                top: '8px',       // Y: 0% + margin 8px
                right: '8px',     // '오른쪽 상단' 기준 8px 마진
                // 만약 'X: 80%'를 'left: 80%'로 사용하려면:
                // left: '80%',
                // right: 'auto',

                backgroundColor: '#000', // 배경색 (눈에 띄게)
                color: '#fff',           // 글자색
                padding: '5px 10px',
                borderRadius: '4px',
                opacity: '0.5',          // 50% 투명도
                pointerEvents: 'none',   // 클릭 비활성화
                zIndex: '9999'           // 다른 요소들 위에 표시
            });
        }
    }

    // 내용 설정
    indicator.textContent = message;

    return indicator;
}

// 인디케이터를 숨기는 함수
function hideGitIndicator(): void {
    const indicator = document.getElementById('git-autosync-indicator');
    if (indicator) {
        indicator.remove();
    }
}

(async function () {
    if(!getBootstrapPull()) return;
    try {
        const indicator = showOrUpdateGitIndicator("초기화...")
        if (remoteIsValid()) {
            showOrUpdateGitIndicator("데이터 가져오는중...", indicator)
            await pullRepository()
        }

        if(!getBootstrapSavePushCharacter()) return;

        await saveDatabaseAndCommit("자동 저장", async (message) => {
            showOrUpdateGitIndicator('자동 저장: ' + message, indicator)
        })
        if (remoteIsValid()) {
            showOrUpdateGitIndicator("데이터 보내는중...", indicator)
            await pushRepository()
        }
    } catch (e: any) {
        console.log(e)
        alert("초기 작업중 문제가 발생했습니다: " + e.toString())
    } finally {
        hideGitIndicator()
    }
})();

async function onAllRequestsFinished() {
    if (!getOnRequestSaveChat()) return;
    showOrUpdateGitIndicator()
    const char = getChar()
    const currentChat: SlicedChat = char.chats[char.chatPage]
    try {
        const isChanged = await saveCharacterAndCommit(`${char.name}[${currentChat.name}] / ${currentChat.message.length}번째 채팅`, char.chaId, currentChat.id, async (value) => {

        });
    } catch (e: any) {
        console.log(e)
        alert("깃 자동커밋중 문제가 발생했습니다: " + e.toString())
        return
    } finally {
        hideGitIndicator()
    }

    if (!getAutomaticPush()) return;

    try {
        await pushRepository()
    } catch (e: any) {
        console.log(e)
        alert("깃 자동푸시중 문제가 발생했습니다: " + e.toString())
        return
    } finally {
        hideGitIndicator()
    }
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

export {};