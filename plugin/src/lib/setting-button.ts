import { BaseOverlay } from "../ui/baseOverlay";
import settingTemplate from '../ui/setting.html';
import { settingLogic } from "../ui/setting-logic";

let injectedButton: HTMLButtonElement | null = null;
const overlay = new BaseOverlay();

export async function injectSettingButton() {
    if (injectedButton && injectedButton.isConnected) {
        return;
    }

    const settingButtons = document.body.querySelector('.rs-setting-cont-3') as HTMLDivElement | null;
    if (!settingButtons) {
        return;
    }

    let button = settingButtons.querySelector<HTMLButtonElement>('#rg-git-setting-button');
    if (button) {
        return;
    }
    
    button = document.createElement('button');
    button.id = "rg-git-setting-button";
    button.className = "flex gap-2 items-center hover:text-textcolor text-textcolor2";
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.82l-.15.1a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0-2.82l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>리스깃 설정`;

    const risugitPanelButton = settingButtons.querySelector<HTMLButtonElement>('#rg-setting-button');
    if (risugitPanelButton && risugitPanelButton.nextSibling) {
        settingButtons.insertBefore(button, risugitPanelButton.nextSibling);
    } else if (risugitPanelButton) {
        settingButtons.appendChild(button);
    } else {
        const lastChild = settingButtons.lastChild;
        if (lastChild) {
            settingButtons.insertBefore(button, lastChild);
        } else {
            settingButtons.appendChild(button);
        }
    }
    
    button.onclick = () => {
        overlay.show(settingTemplate, settingLogic);
    };

    injectedButton = button;
}
