import {BaseOverlay} from "./baseOverlay";
import modalTemplate from './modal.html';

export function wrapProgress(overlay: BaseOverlay, container: HTMLDivElement): (message: string) => Promise<void> {
    const progress = container.querySelector<HTMLSpanElement>('#rg-progress');
    if (!progress) throw new Error("Element not exist?")

    return async (message) => {
        progress.innerText = message
    }
}

export interface PoppedProgress {
    overlay: BaseOverlay,
    callback: (message: string) => Promise<void>
}

export async function popProgress(): Promise<PoppedProgress> {
    const overlay = new BaseOverlay();
    let callback: (message: string) => Promise<void>
    await overlay.show(modalTemplate, (overlay, element) => {
        callback = wrapProgress(overlay, element);
    });

    return {
        overlay,
        // overlay.show must setup callback within wrapProgress
        // @ts-ignore
        callback
    };
}

export function wrapMessage(overlay: BaseOverlay, container: HTMLDivElement, message: string) {
    const progress = container.querySelector<HTMLSpanElement>('#rg-progress');
    const spinner = container.querySelector<SVGSVGElement>('#rg-progress-spinner');
    const yes = container.querySelector<HTMLButtonElement>('#rg-yes-button');
    if (!progress || !spinner || !yes) throw new Error("Element not exist?")

    spinner.style.display = 'none'
    yes.style.display = 'flex'
    progress.innerText = message;
    yes.onclick = () => {
        overlay.close()
    }
}

export async function popMessage(message: string) {
    const overlay = new BaseOverlay();
    await overlay.show(modalTemplate, (overlay, element) => {
        wrapMessage(overlay, element, message)
    })
}

export function wrapConfirm(overlay: BaseOverlay, container: HTMLDivElement, message: string, yesCallback: (() => Promise<void>) | undefined, noCallback: (() => Promise<void>) | undefined) {
    const progress = container.querySelector<HTMLSpanElement>('#rg-progress');
    const spinner = container.querySelector<SVGSVGElement>('#rg-progress-spinner');
    const yes = container.querySelector<HTMLButtonElement>('#rg-yes-button');
    const no = container.querySelector<HTMLButtonElement>('#rg-no-button');
    if (!progress || !spinner || !yes || !no) throw new Error("Element not exist?")

    spinner.style.display = 'none'
    yes.style.display = 'flex'
    progress.innerText = message;
    no.style.display = 'flex'

    yes.onclick = () => {
        overlay.close()
        if (!yesCallback) return;
        yesCallback().then()
    }

    no.onclick = () => {
        overlay.close()
        if (!noCallback) return;
        noCallback().then()
    }
}

export async function popConfirm(message: string, yesCallback: (() => Promise<void>) | undefined, noCallback: (() => Promise<void>) | undefined) {
    const overlay = new BaseOverlay();
    await overlay.show(modalTemplate, (overlay, element) => {
        wrapConfirm(overlay, element, message, yesCallback, noCallback)
    })
}