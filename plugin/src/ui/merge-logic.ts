import {BaseOverlay} from "./baseOverlay";
import {pushRepository, mergeCommit} from "../lib/git";
import {popMessage, popProgress} from "./modal-logic";

export function mergeLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    const closeButton = container.querySelector<HTMLButtonElement>('#rg-merge-close-button');

    closeButton?.addEventListener('click', () => {
        overlay.close()
    })

    const localMergeButton = container.querySelector<HTMLButtonElement>('#rg-merge-local-button');
    const remoteMergeButton = container.querySelector<HTMLButtonElement>('#rg-merge-remote-button');

    if (!localMergeButton || !remoteMergeButton) {
        console.log("버튼... 없다?")
        return undefined;
    }

    localMergeButton.onclick = async () => {
        const progress = await popProgress()
        try {
            await progress.callback('로컬기준으로 병합하는중...')
            await mergeCommit('Merge changes from local', true);
            await pushRepository()
            progress.overlay.close()
            overlay.close();
        } catch (e: any) {
            console.error("Merge commit failed:", e);
            progress.overlay.close()
            await popMessage(`병합에 실패했습니다: ${e.message}`);
        }
    }

    remoteMergeButton.onclick = async () => {
        const progress = await popProgress()
        try {
            await progress.callback('서버기준으로 병합하는중...')
            await mergeCommit('Merge changes from local', false);
            await pushRepository()
            overlay.close();
        } catch (e: any) {
            console.error("Merge commit failed:", e);
            progress.overlay.close()
            await popMessage(`병합에 실패했습니다: ${e.message}`);
        }
    }

    // 정리 함수 반환
    return () => {
        // 필요한 경우 이벤트 리스너 정리
        console.log('Cleanup overlay logic');
    };
}