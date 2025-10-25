import {BaseOverlay} from "./baseOverlay";
import {getRemoteDiff, pushRepository, saveMergeCommit} from "../lib/git";
import {applyClickHandlerWithSpinner} from "./loadingButton";

export function initializeOverlayLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    const closeButton = container.querySelector<HTMLButtonElement>('#rg-merge-close-button');

    closeButton?.addEventListener('click', () => {
        overlay.close()
    })

    getRemoteDiff().then((data) => {
        const localMergeButton = container.querySelector<HTMLButtonElement>('#rg-merge-local-button');
        const remoteMergeButton = container.querySelector<HTMLButtonElement>('#rg-merge-remote-button');

        if (!localMergeButton || !remoteMergeButton) {
            console.log("버튼... 없다?")
            return;
        }

        applyClickHandlerWithSpinner(localMergeButton, [localMergeButton, remoteMergeButton], async () => {
            try {
                await saveMergeCommit('Merge changes from local', data.localData);
                await pushRepository()
                overlay.close();
            } catch (e: any) {
                console.error("Merge commit failed:", e);
                alert(`병합에 실패했습니다: ${e.message}`);
            }
        });

        applyClickHandlerWithSpinner(remoteMergeButton, [localMergeButton, remoteMergeButton], async () => {
            try {
                await saveMergeCommit('Merge changes from remote', data.remoteData);
                overlay.close();
            } catch (e: any) {
                console.error("Merge commit failed:", e);
                alert(`병합에 실패했습니다: ${e.message}`);
            }
        });
    }).catch((reason) => {
        alert(`차이점을 구하는데 실패했습니다: ${reason}`)
    })

    // 정리 함수 반환
    return () => {
        // 필요한 경우 이벤트 리스너 정리
        console.log('Cleanup overlay logic');
    };
}