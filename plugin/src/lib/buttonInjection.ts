import {BaseOverlay} from "../ui/baseOverlay";
import overlayTemplate from '../ui/overlay.html';
// @ts-ignore
import tailwindStyles from '../../dist/main.css';
// @ts-ignore
import diffStyles from '../../node_modules/jsondiffpatch/lib/formatters/styles/html.css';

// 주입된 스타일이 중복되지 않도록 한 번만 실행
(function () {
    let style: HTMLStyleElement | null = document.getElementById('risu-git-styles') as HTMLStyleElement;
    if(!style) {
        style = document.createElement('style');
        style.id = 'risu-git-styles';
        document.head.appendChild(style);
    }
    style.innerHTML = tailwindStyles;

    let diffStyle: HTMLStyleElement | null = document.getElementById('risu-git-diff-styles') as HTMLStyleElement;
    if(!diffStyle) {
        diffStyle = document.createElement('style');
        diffStyle.id = 'risu-git-diff-styles';
        document.head.appendChild(diffStyle);
    }
    diffStyle.innerHTML = diffStyles;
})();

function makeMutationObserver(callback: () => void, targetNode: HTMLElement | undefined = undefined, config: MutationObserverInit | undefined = undefined) {
    if (!targetNode) {
        targetNode = document.body
    }
    if (!config) {
        config = {attributes: true, childList: true, subtree: true};
    }
    const innerCallback = (_: any, observer: MutationObserver) => {
        observer.disconnect()
        callback()
        observer.observe(targetNode, config);
    };
    const observer = new MutationObserver(innerCallback);
    observer.observe(targetNode, config);
    return observer;
}

let injectedButton: HTMLButtonElement | null = null;
const overlay = new BaseOverlay();

async function getToolbar() {
    if (injectedButton) {
        if (injectedButton.isConnected) return;
        injectedButton.remove();
        injectedButton = null;
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
        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-ccw-icon lucide-refresh-ccw"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>`

        const lastChild = toolbar.lastChild;
        if (lastChild) {
            toolbar.insertBefore(button, lastChild);
        } else {
            // 자식이 없으면 그냥 추가
            toolbar.appendChild(button);
        }
    }
    button.onclick = () => {
        overlay.show(overlayTemplate, 'overlay');
    }
}

makeMutationObserver(getToolbar);

export {};