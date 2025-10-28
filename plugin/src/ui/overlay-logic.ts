import {BaseOverlay} from "./baseOverlay";
import {
    deleteRepo,
    getCommitHistory, getDiskUsage, getFileContentAtCommit, pullRepository, pushRepository, recloneRepoWithLowDepth,
    revertDatabaseToCommit, saveDatabaseAndCommit
} from "../lib/git";
import mergeTemplate from './merge.html';
import {applyClickHandlerWithSpinner} from "./loadingButton";

export function initializeOverlayLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    const closeButton = container.querySelector<HTMLButtonElement>('#rg-close-button');
    const persistButton = container.querySelector<HTMLButtonElement>('#rg-persist-button');
    const commitButton = container.querySelector<HTMLButtonElement>("#rg-commit-button")
    const pushButton = container.querySelector<HTMLButtonElement>("#rg-push-button")
    const pullButton = container.querySelector<HTMLButtonElement>("#rg-pull-button")
    const trimButton = container.querySelector<HTMLButtonElement>("#rg-trim-button")
    const deleteButton = container.querySelector<HTMLButtonElement>("#rg-delete-button")

    if (!closeButton || !persistButton || !commitButton || !pushButton || !pullButton || !trimButton || !deleteButton) {
        console.log("버튼... 없다?")
        return;
    }

    let buttons = [closeButton, persistButton, commitButton, pushButton, pullButton, trimButton]

    closeButton.addEventListener('click', () => {
        overlay.close()
    })

    async function checkPersist() {
        if (persistButton) {
            if ('storage' in navigator && 'persist' in navigator.storage) {
                const MB_IN_BYTES = 1048576;
                const usage = await getDiskUsage();

                const fsInMB = (usage.fs / MB_IN_BYTES).toFixed(1);

                let usageStr = ""
                if (usage.quota && usage.usage) {
                    const usageInMB = (usage.usage / MB_IN_BYTES).toFixed(1);
                    const quotaInMB = (usage.quota / MB_IN_BYTES).toFixed(1);
                    usageStr = `${usageInMB}MB(${fsInMB}MB)/${quotaInMB}MB`
                } else {
                    usageStr = `${fsInMB}(디스크 상황 알 수 없음)`
                }

                const isPersisted = await navigator.storage.persisted();
                if (isPersisted) {
                    persistButton.innerText = ` (저장소: 지속성 상태, ${usageStr})`
                } else {
                    persistButton.onclick = async () => {
                        const result = await navigator.storage.persist();
                        if (!result) {
                            alert('브라우저가 지속성 상태를 허락하지 않았습니다. 즐겨찾기에 넣거나, 사이트를 좀 더 방문하세요. 모바일인 경우 PWA를 설치하는것이 도움이 될 수 있습니다.')
                        }
                        checkPersist()
                    }
                    persistButton.innerText = ` (저장소: 임시 상태, ${usageStr})`
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

        if (!closeButton || !persistButton || !commitButton || !pushButton || !pullButton || !trimButton || !deleteButton) {
            console.log("버튼... 없다?")
            return;
        }

        buttons = [closeButton, persistButton, commitButton, pushButton, pullButton, trimButton]

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
                applyClickHandlerWithSpinner(revertButton, buttons, async (setMessage) => {
                    const commitId = commit.oid;
                    const shortCommitId = commitId.slice(0, 7);
                    if (confirm(`정말로 이 커밋(${shortCommitId})의 내용을 리스에 적용하시겠습니까?\n만약의 사태를 위해, 일반 백업을 해두는것을 권장합니다.`)) {
                        try {
                            await revertDatabaseToCommit(commitId, setMessage);
                            alert("완료되었습니다, 새로고침을 권장합니다.")
                        } catch (reason) {
                            alert(reason)
                        }
                    }
                })
                buttons.push(revertButton)
            }
            historyContainer.appendChild(cloned)
        })
    }

    applyClickHandlerWithSpinner(commitButton, buttons, async (setMessage) => {
        try {
            const message = prompt('커밋 메시지를 정하세요', '세이브 데이터') ?? '세이브 데이터';
            const isChanged = await saveDatabaseAndCommit(message, setMessage);
            if (!isChanged) {
                alert('변경 사항이 없습니다!')
            } else {
                await refreshCommitHistory()
                alert(`저장되었습니다: ${isChanged}`)
            }
        } catch (reason) {
            alert(`저장에 실패했습니다: ${reason}`)
        }
    })

    applyClickHandlerWithSpinner(pushButton, buttons, async () => {
        try {
            await pushRepository();
            alert('서버에 올라갔습니다')
        } catch (reason: any) {
            if (reason.hasOwnProperty('code') && reason.code === 'PushRejectedError') {
                const mergeOverlay = new BaseOverlay()
                mergeOverlay.extraCleanup = () => {
                    refreshCommitHistory().then()
                }
                mergeOverlay.show(mergeTemplate, "merge").then()
            } else {
                alert(`서버에 올리는데 실패했습니다: ${reason}`)
            }
        }
    })

    applyClickHandlerWithSpinner(pullButton, buttons, async () => {
        try {
            await pullRepository();
            await refreshCommitHistory();
            alert('서버에서 데이터를 받아왔습니다')
        } catch (reason: any) {
            if (reason.hasOwnProperty('code') && reason.code === 'MergeConflictError') {
                alert('서버와 데이터 충돌이 있어서 데이터를 받아올 수 없었습니다. 서버로 보내기를 통해 데이터 충돌을 해결하세요')
            } else {
                alert(`서버에서 받는데 실패했습니다: ${reason}`)
            }
        }
    })

    applyClickHandlerWithSpinner(trimButton, buttons, async () => {
        try {
            if (confirm('현재 기기에 있는 깃 저장소를 있는경우 제거한 뒤, 서버에서 최근 커밋 한개만을 받아오는것으로 이전 기록을 지웁니다.\n데이터의 소모가 있을 수 있습니다, 계속 진행할까요?')) {
                await recloneRepoWithLowDepth();
                await refreshCommitHistory()
            }
        } catch (reason: any) {
            alert(reason)
        }
    })

    applyClickHandlerWithSpinner(deleteButton, buttons, async () => {
        try {
            if (confirm('현재 기기에 있는 깃 저장소를 삭제합니다, 서버에 올리지 않은 모든 변경사항은 유실됩니다.')) {
                await deleteRepo()
                overlay.close()
            }
        } catch (reason: any) {
            alert(reason)
        }
    })

    refreshCommitHistory().then()

    // 정리 함수 반환
    return () => {
        // 필요한 경우 이벤트 리스너 정리
        console.log('Cleanup overlay logic');
    };
}

