import {BaseOverlay} from "./baseOverlay";

export function wrapProgress(overlay: BaseOverlay, container: HTMLDivElement): (message: string) => Promise<void> {
    const progress = container.querySelector<HTMLSpanElement>('#rg-progress');
    if (!progress) throw new Error("Element not exist?")

    return async (message) => {
        progress.innerText = message
    }
}

export function wrapConfirm(overlay: BaseOverlay, container: HTMLDivElement, message: string) {
    const progress = container.querySelector<HTMLSpanElement>('#rg-progress');
    const spinner = container.querySelector<SVGSVGElement>('#rg-progress-spinner');
    const confirm = container.querySelector<HTMLButtonElement>('#rg-confirm-button');
    if (!progress || !spinner || !confirm) throw new Error("Element not exist?")

    spinner.style.display = 'none'
    confirm.style.display = 'flex'
    progress.innerText = message;
    confirm.onclick = () => {
        overlay.close()
    }
}