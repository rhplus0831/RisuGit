import {Overlay} from "./overlay";
import {getCommitHistory, getLastCommitDate, pushRepository, saveAndCommit} from "../lib/git";
import {processCharacters} from "../lib/encrypt";
import * as url from "node:url";
import {getGitURL} from "../lib/configure";

export function initializeOverlayLogic(overlay: Overlay, container: HTMLDivElement) {
    const closeButton = container.querySelector<HTMLButtonElement>('#rg-close-button');

    closeButton?.addEventListener('click', () => {
        overlay.close()
    })

    const commitButton = container.querySelector<HTMLButtonElement>("#rg-commit-button")
    commitButton?.addEventListener('click', () => {
        saveAndCommit().then((result) => {
            if(!result) {
                alert('변경 사항이 없습니다!')
            } else {
                alert(`저장되었습니다: ${result}`)
            }
        })
    })

    const pushButton = container.querySelector<HTMLButtonElement>("#rg-push-button")
    pushButton?.addEventListener('click', () => {
        pushRepository().then(() => {
            alert('푸시되었습니다')
        }).catch((reason) => {
            alert(`푸시에 실패했습니다: ${reason}`)
        })
    })

    getLastCommitDate().then((value) => {
        const lastCommitSpan = container.querySelector<HTMLSpanElement>('#rg-last-commit-date');
        if(!lastCommitSpan) {
            // TODO: Retry?
            console.error("스팬... 없다?")
            return
        }
        const prefix = '마지막 커밋 날자: '
        if(value) {
            lastCommitSpan.innerText = prefix + value.toLocaleString()
        } else {
            lastCommitSpan.innerText = "커밋 없음?"
        }
    })

    getCommitHistory().then((value) => {
        const historyElement = container.querySelector<HTMLDivElement>('#rg-history');
        if(!historyElement) {
            console.log("히스토리 스팬... 없다?")
            return;
        }
        const historyContainer = container.querySelector<HTMLDivElement>('#rg-history-container');
        if(!historyContainer) {
            console.log("히스토리 컨테이너... 없다?")
            return;
        }

        // 기존 데이터가 있으면 제거
        historyContainer.innerHTML = ''

        value.forEach((commit) => {
            const cloned = historyElement.cloneNode(true) as HTMLDivElement;
            const messageSpan = cloned.querySelector<HTMLSpanElement>('#rg-history-message');
            if(messageSpan) {
                messageSpan.innerText = commit.commit.message
            }
            const dateSpan = cloned.querySelector<HTMLSpanElement>('#rg-history-date');
            if(dateSpan) {
                const commitDate = new Date(commit.commit.committer.timestamp * 1000);
                dateSpan.innerText = commitDate.toLocaleString();
            }
            const idSpan = cloned.querySelector<HTMLSpanElement>('#rg-history-commit-id')
            if(idSpan) {
                idSpan.innerText = `(${commit.oid.slice(0, 8)})`
            }
            historyContainer.appendChild(cloned)
        })
    })

    // 정리 함수 반환
    return () => {
        // 필요한 경우 이벤트 리스너 정리
        console.log('Cleanup overlay logic');
    };
}