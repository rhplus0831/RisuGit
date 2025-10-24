import {BaseOverlay} from "./baseOverlay";
import {getCommitHistory, getFileContentAtCommit, pullRepository, pushRepository, saveAndCommit} from "../lib/git";
import mergeTemplate from './merge.html';
import {decryptCharacters} from "../lib/encrypt";

export function initializeOverlayLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    const closeButton = container.querySelector<HTMLButtonElement>('#rg-close-button');

    closeButton?.addEventListener('click', () => {
        overlay.close()
    })

    const persistButton = container.querySelector<HTMLButtonElement>('#rg-persist-button');
    async function checkPersist() {
        if (persistButton) {
            if ('storage' in navigator && 'persist' in navigator.storage) {
                const isPersisted = await navigator.storage.persisted();
                if (isPersisted) {
                    persistButton.innerText = ' (저장소: 지속성 상태)'
                } else {
                    persistButton.onclick = async () => {
                        const result = await navigator.storage.persist();
                        if(!result) {
                            alert('브라우저가 지속성 상태를 허락하지 않았습니다. 북마크를 하거나, 사이트를 좀 더 방문하세요. 모바일인 경우 PWA를 설치하는것이 도움이 될 수 있습니다.')
                        }
                        checkPersist()
                    }
                    persistButton.innerText = ' (저장소: 임시 상태)'
                }
            } else {
                persistButton.innerText = ' (저장소: 사용 불가?)'
            }
        }
    }
    checkPersist()

    async function refreshCommitHistory() {
        const historyElement = container.querySelector<HTMLDivElement>('#rg-history');
        if (!historyElement) {
            console.log("히스토리 스팬... 없다?")
            return;
        }
        const historyContainer = container.querySelector<HTMLDivElement>('#rg-history-container');
        if (!historyContainer) {
            console.log("히스토리 컨테이너... 없다?")
            return;
        }

        historyContainer.innerHTML = '가져오는중...'
        const history = await getCommitHistory()

        // 기존 데이터가 있으면 제거
        historyContainer.innerHTML = ''

        if (history.length == 0) {
            historyContainer.innerHTML = '커밋이 아직 없습니다.'
        }

        history.forEach((commit) => {
            const cloned = historyElement.cloneNode(true) as HTMLDivElement;
            const messageSpan = cloned.querySelector<HTMLSpanElement>('#rg-history-message');
            if (messageSpan) {
                messageSpan.innerText = `${commit.commit.message.trim()} (${commit.commit.author.name.trim()})`
            }
            const dateSpan = cloned.querySelector<HTMLSpanElement>('#rg-history-date');
            if (dateSpan) {
                const commitDate = new Date(commit.commit.committer.timestamp * 1000);
                dateSpan.innerText = commitDate.toLocaleString();
            }
            const idSpan = cloned.querySelector<HTMLSpanElement>('#rg-history-commit-id')
            if (idSpan) {
                idSpan.innerText = `(${commit.oid.slice(0, 8)})`
            }

            const revertButton = cloned.querySelector<HTMLButtonElement>("#rg-history-revert-button")
            if (revertButton) {
                revertButton.addEventListener('click', async () => {
                    const commitId = commit.oid;
                    const shortCommitId = commitId.slice(0, 7);
                    if (confirm(`정말로 이 커밋(${shortCommitId})의 내용을 리스에 적용하시겠습니까?\n만약의 사태를 위해, 일반 백업을 해두는것을 권장합니다.`)) {
                        const fileContent = await getFileContentAtCommit(commitId, 'data.json');
                        const db = getDatabase()
                        db.characters = await decryptCharacters(fileContent);
                        setDatabase(db);
                        alert("완료되었습니다, 새로고침을 권장합니다.")
                    }
                })
            }
            historyContainer.appendChild(cloned)
        })
    }

    const commitButton = container.querySelector<HTMLButtonElement>("#rg-commit-button")
    commitButton?.addEventListener('click', () => {
        saveAndCommit().then((result) => {
            if (!result) {
                alert('변경 사항이 없습니다!')
            } else {
                alert(`저장되었습니다: ${result}`)
                refreshCommitHistory().then()
            }
        })
    })

    const pushButton = container.querySelector<HTMLButtonElement>("#rg-push-button")
    pushButton?.addEventListener('click', () => {
        pushRepository().then(() => {
            alert('서버에 올라갔습니다')
        }).catch((reason) => {
            if (reason.hasOwnProperty('code') && reason.code === 'PushRejectedError') {
                if (confirm('서버와 데이터가 충돌합니다. 충돌 머지 창을 열까요?')) {
                    const mergeOverlay = new BaseOverlay()
                    mergeOverlay.extraCleanup = () => {
                        refreshCommitHistory()
                    }
                    mergeOverlay.show(mergeTemplate, 'merge').then()
                }
            } else {
                alert(`서버에 올리는데 실패했습니다: ${reason}`)
            }
        })
    })

    const pullButton = container.querySelector<HTMLButtonElement>("#rg-pull-button")
    pullButton?.addEventListener('click', () => {
        pullRepository().then(() => {
            alert('서버에서 받았습니다')
            refreshCommitHistory().then()
        }).catch((reason) => {
            alert(`서버에서 받는데 실패했습니다: ${reason}`)
        })
    })

    refreshCommitHistory().then()

    // 정리 함수 반환
    return () => {
        // 필요한 경우 이벤트 리스너 정리
        console.log('Cleanup overlay logic');
    };
}

