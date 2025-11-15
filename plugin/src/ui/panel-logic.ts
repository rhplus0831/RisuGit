import {BaseOverlay} from "./baseOverlay";
import {
    deleteRepo,
    getCommitHistory,
    getDiskUsage,
    pullRepository,
    pushRepository,
    recloneRepoWithLowDepth,
    revertDatabaseToCommit,
    saveDatabaseAndCommit
} from "../lib/git";
import mergeTemplate from './merge.html';
import modalTemplate from './modal.html';
import {mergeLogic} from "./merge-logic";
import {assetPushLogic} from "./asset-push-logic";
import {assetPullLogic} from "./asset-pull-logic";
import {popConfirm, popMessage, popProgress, wrapConfirm, wrapProgress} from "./modal-logic";

import {disableButtonIfAssetServerIsInvalid, disableButtonIfRemoteIsInvalid} from "../lib/utils";

export function panelLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    const closeButton = container.querySelector<HTMLButtonElement>('#rg-close-button');
    const persistButton = container.querySelector<HTMLButtonElement>('#rg-persist-button');
    const commitButton = container.querySelector<HTMLButtonElement>("#rg-commit-button")
    const pushButton = container.querySelector<HTMLButtonElement>("#rg-push-button")
    const pullButton = container.querySelector<HTMLButtonElement>("#rg-pull-button")
    const trimButton = container.querySelector<HTMLButtonElement>("#rg-trim-button")
    const revertButton = container.querySelector<HTMLButtonElement>("#rg-revert-button")
    const deleteButton = container.querySelector<HTMLButtonElement>("#rg-delete-button")
    const assetPushButton = container.querySelector<HTMLButtonElement>("#rg-push-asset")
    const assetPullButton = container.querySelector<HTMLButtonElement>("#rg-pull-asset")
    const clearCache = container.querySelector<HTMLButtonElement>("#rg-clear-cache")

    // 타입 체크... 귀찮다...
    if (!closeButton || !persistButton || !commitButton || !pushButton || !pullButton || !trimButton || !deleteButton || !revertButton || !assetPushButton || !assetPullButton || !clearCache) {
        console.log("버튼... 없다?")
        return;
    }

    closeButton.addEventListener('click', () => {
        overlay.close()
    })

    disableButtonIfRemoteIsInvalid(pushButton);
    disableButtonIfRemoteIsInvalid(pullButton);
    disableButtonIfRemoteIsInvalid(trimButton);

    disableButtonIfAssetServerIsInvalid(assetPushButton)
    disableButtonIfAssetServerIsInvalid(assetPullButton)

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
                revertButton.onclick = () => {
                    const commitId = commit.oid;
                    const shortCommitId = commitId.slice(0, 7);
                    popConfirm(`정말로 이 커밋(${shortCommitId})의 내용을 리스에 적용하시겠습니까?\n만약의 사태를 위해, 일반 백업을 해두는것을 권장합니다.`, async () => {
                        try {
                            const progress = await popProgress()
                            await revertDatabaseToCommit(commitId, progress.callback);
                            progress.overlay.close()
                            await popMessage("완료되었습니다, 새로고침을 권장합니다.")
                        } catch (reason: any) {
                            await popMessage(reason.toString())
                        }
                    }, undefined)
                }
            }
            historyContainer.appendChild(cloned)
        })
    }

    commitButton.onclick = async () => {
        const message = prompt('커밋 메시지를 정하세요', '세이브 데이터');
        if (!message) return;
        const progress = await popProgress()
        try {
            const isChanged = await saveDatabaseAndCommit(message, progress.callback);
            progress.overlay.close()
            if (!isChanged) {
                await popMessage('변경 사항이 없습니다!')
            } else {
                await refreshCommitHistory()
                await popMessage(`저장되었습니다: ${isChanged}`)
            }
        } catch (reason) {
            progress.overlay.close()
            await popMessage(`저장에 실패했습니다: ${reason}`)
        }
    }

    pushButton.onclick = async () => {
        const progress = await popProgress();
        await progress.callback("서버에 올리고 있습니다...")
        try {
            await pushRepository();
            progress.overlay.close()
            await popMessage('서버에 올라갔습니다')
        } catch (reason: any) {
            progress.overlay.close()
            if (reason.hasOwnProperty('code') && reason.code === 'PushRejectedError') {
                const mergeOverlay = new BaseOverlay()
                mergeOverlay.extraCleanup = () => {
                    refreshCommitHistory().then()
                }
                mergeOverlay.show(mergeTemplate, mergeLogic).then()
            } else {
                await popMessage(`서버에 올리는데 실패했습니다: ${reason}`)
            }
        }
    }

    pullButton.onclick = async () => {
        const progress = await popProgress();
        await progress.callback("서버에서 받아고오 있습니다...")
        try {
            await pullRepository();
            progress.overlay.close()
            await refreshCommitHistory();
        } catch (reason: any) {
            progress.overlay.close()
            if (reason.hasOwnProperty('code') && reason.code === 'MergeConflictError') {
                await popMessage('서버와 데이터 충돌이 있어서 데이터를 받아올 수 없었습니다. 서버로 보내기를 통해 데이터 충돌을 해결하세요')
            } else {
                await popMessage(`서버에서 받는데 실패했습니다: ${reason}`)
            }
        }
    }

    revertButton.onclick = async () => {
        await popConfirm('특정 커밋을 로컬에서, 없는경우 서버에서 받아와 복원을 시도합니다, 계속할까요?', async () => {
            const sha = prompt("커밋 ID(sha)를 입력해주세요")
            if (!sha) {
                return;
            }
            await overlay.show(modalTemplate, async (overlay, element) => {
                const setMessage = await popProgress()
                try {
                    await revertDatabaseToCommit(sha, setMessage.callback)
                    await refreshCommitHistory();
                    setMessage.overlay.close()
                    await popMessage("완료되었습니다, 새로고침을 권장합니다.")
                } catch (reason: any) {
                    overlay.close()
                    setMessage.overlay.close()
                    await popMessage(reason)
                }
            })
        }, undefined)
    }

    trimButton.onclick = async () => {
        await popConfirm('현재 기기에 있는 깃 저장소를 있는경우 제거한 뒤, 서버에서 최근 커밋 한개만을 받아오는것으로 이전 기록을 지웁니다.\n서버에 푸시되지 않은 내용이 제거되고, 저장소의 용량만큼 데이터가 전송됩니다. 계속하시겠습니까?', async () => {
            const progress = await popProgress();
            try {
                await progress.callback('저장소를 다시 가져오는중...')
                await recloneRepoWithLowDepth();
                await refreshCommitHistory()
                progress.overlay.close()
            } catch (reason: any) {
                progress.overlay.close()
                await popMessage(reason)
            }
        }, undefined)
    }

    deleteButton.onclick = async () => {
        await popConfirm('현재 기기에 있는 깃 저장소를 삭제합니다, 서버에 올리지 않은 모든 변경사항은 유실됩니다.', async () => {
            const progress = await popProgress();
            try {
                await progress.callback('저장소 삭제중...')
                await deleteRepo()
                progress.overlay.close()
                await refreshCommitHistory()
            } catch (reason: any) {
                progress.overlay.close()
                await popMessage(reason)
            }
        }, undefined)
    }

    assetPushButton.onclick = async () => {
        await popConfirm('모든 에셋을 서버에 올립니다. 서버에 존재하지 않는 에셋이 올라갑니다.\n이전 호출 기록이 남아있는 경우, 그 정보가 캐싱됩니다.', async () => {
            const overlay = new BaseOverlay();
            await overlay.show(modalTemplate, assetPushLogic)
        }, undefined)
    }

    assetPullButton.onclick = async () => {
        await popConfirm('서버에서 에셋을 받아옵니다. 로컬에 데이터가 없는 에셋만 다운로드 됩니다.', async () => {
            const overlay = new BaseOverlay();
            await overlay.show(modalTemplate, assetPullLogic)
        }, undefined)
    }

    clearCache.onclick = async () => {
        await popConfirm('리스의 자체 캐시를 클리어 합니다, 복원후 일부 리소스(특히 봇 아이콘)가 제대로 표시 되지 않는경우에 사용 할 수 있습니다.', async () => {
            const wasDeleted = await caches.delete('risuCache');
            if(wasDeleted) {
                await popMessage('캐시가 삭제되었습니다.')
            } else {
                await popMessage('삭제에 실패했습니다?')
            }
        }, undefined)
    }

    refreshCommitHistory().then()

    // 정리 함수 반환
    return () => {
        // 필요한 경우 이벤트 리스너 정리
        console.log('Cleanup overlay logic');
    };
}

