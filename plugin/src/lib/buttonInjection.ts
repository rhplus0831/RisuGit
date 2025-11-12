import {BaseOverlay} from "../ui/baseOverlay";
import overlayTemplate from '../ui/panel.html';
import chatTemplate from '../ui/quick.html';
// @ts-ignore
import tailwindStyles from '../../dist/main.css';
import {panelLogic} from "../ui/panel-logic";
import {quickLogic} from "../ui/quick-logic";
// 주입된 스타일이 중복되지 않도록 한 번만 실행
(function () {
    let style: HTMLStyleElement | null = document.getElementById('risu-git-styles') as HTMLStyleElement;
    if (!style) {
        style = document.createElement('style');
        style.id = 'risu-git-styles';
        document.head.appendChild(style);
    }
    style.innerHTML = tailwindStyles;
})();

function makeMutationObserver(callbacks: (() => void)[], targetNode: HTMLElement | undefined = undefined, config: MutationObserverInit | undefined = undefined) {
    if (!targetNode) {
        targetNode = document.body
    }
    if (!config) {
        config = {attributes: true, childList: true, subtree: true};
    }
    const innerCallback = (_: any, observer: MutationObserver) => {
        observer.disconnect()
        for (const callback of callbacks) {
            callback()
        }
        observer.observe(targetNode, config);
    };
    const observer = new MutationObserver(innerCallback);
    observer.observe(targetNode, config);
    return observer;
}

let injectedChatButton: HTMLButtonElement | null = null;
const chatOverlay = new BaseOverlay();

let injectedSettingButton: HTMLButtonElement | null = null;
const settingOverlay = new BaseOverlay();

async function getSetting() {
    if (injectedSettingButton) {
        if (injectedSettingButton.isConnected) return;
        injectedSettingButton.remove();
        injectedSettingButton = null;
    }

    // closest returns Element | null; narrow or handle null:
    const settingButtons = document.body.querySelector('.rs-setting-cont-3') as HTMLDivElement | null;
    if (!settingButtons) {
        //TODO: Notify this?
        return
    }
    let button = settingButtons.querySelector<HTMLButtonElement>('#rg-setting-button') as HTMLButtonElement;
    if (!button) {
        button = document.createElement('button')
        button.id = "rg-setting-button"
        button.className = "flex gap-2 items-center hover:text-textcolor text-textcolor2"
        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-git-commit-horizontal-icon lucide-git-commit-horizontal"><circle cx="12" cy="12" r="3"/><line x1="3" x2="9" y1="12" y2="12"/><line x1="15" x2="21" y1="12" y2="12"/></svg>리스깃 패널`

        const lastChild = settingButtons.lastChild;
        if (lastChild) {
            settingButtons.insertBefore(button, lastChild);
        } else {
            // 자식이 없으면 그냥 추가
            settingButtons.appendChild(button);
        }
    }
    button.onclick = () => {
        settingOverlay.show(overlayTemplate, panelLogic);
    }
}

async function getToolbar() {
    if (injectedChatButton) {
        if (injectedChatButton.isConnected) return;
        injectedChatButton.remove();
        injectedChatButton = null;
    }

    const svg = document.body.querySelector('.setting-area svg.lucide-folder-plus') as SVGElement | null;
    if (!svg) return;

    // closest returns Element | null; narrow or handle null:
    const toolbar = svg.closest('div.flex.items-center') as HTMLDivElement | null;
    if (!toolbar) {
        //TODO: Notify this?
        return
    }

    // 이전 버튼 제거
    let button = toolbar.querySelector<HTMLButtonElement>('#rg-open-button') as HTMLButtonElement;

    if (!button) {
        button = document.createElement('button')
        button.id = "rg-open-button"
        button.className = "text-textcolor2 hover:text-green-500 ml-2 cursor-pointer"
        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-git2-icon lucide-folder-git-2"><path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5"/><circle cx="13" cy="12" r="2"/><path d="M18 19c-2.8 0-5-2.2-5-5v8"/><circle cx="20" cy="19" r="2"/></svg>`

        const lastChild = toolbar.lastChild;
        if (lastChild) {
            toolbar.insertBefore(button, lastChild);
        } else {
            // 자식이 없으면 그냥 추가
            toolbar.appendChild(button);
        }
    }
    button.onclick = () => {
        chatOverlay.show(chatTemplate, quickLogic);
    }
}

const observer = makeMutationObserver([getToolbar, getSetting]);

export function unloadButton() {
    observer.disconnect()
}

export {};