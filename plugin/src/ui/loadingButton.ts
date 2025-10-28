import {remoteIsValid} from "../lib/configure";

/**
 * 긴 작업을 하고 있음을 표시하고, 관련된 버튼을 비활성화 했다가 되돌림
 * @param loadingButton 로딩이 되고있는 변수
 * @param disableButtons 비활성화할 버튼들
 * @param innerFunction 실제로 실행해야 하는 함수
 */
export function applyClickHandlerWithSpinner(loadingButton: HTMLButtonElement, disableButtons: HTMLButtonElement[], innerFunction: (setMessage: (message: string) => Promise<void>) => Promise<void>) {
    async function wrapped() {
        const originalInnerHTML = loadingButton.innerHTML;
        const spinner = `<svg class="rg-animate-spin rg-h-6 rg-w-6 rg-text-white" xmlns="http://www.w3.org/2000/svg" fill="none"
viewBox="0 0 24 24">
<circle class="rg-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
<path class="rg-opacity-75" fill="currentColor"
d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>`
        loadingButton.innerHTML = `${spinner}작업중...`

        disableButtons.forEach((button) => {
            // 이미 비활성화 된 버튼인경우
            if (button.classList.contains("flag-disabled")) {
                return;
            }
            button.disabled = true;
            // 비활성화 시 시각적 스타일 추가
            button.classList.add('rg-opacity-50', 'rg-cursor-not-allowed');
        })

        try {
            async function setMessageInner(message: string) {
                loadingButton.innerHTML = `${spinner}${message}`
            }

            await innerFunction(setMessageInner)
        } finally {
            loadingButton.innerHTML = originalInnerHTML;
            disableButtons.forEach((button) => {
                // 이미 비활성화 된 버튼인경우
                if (button.classList.contains("flag-disabled")) {
                    return;
                }
                button.disabled = false;
                // 활성화 시 시각적 스타일 제거
                button.classList.remove('rg-opacity-50', 'rg-cursor-not-allowed');
            })
        }
    }

    loadingButton.onclick = wrapped;
}

export function disableButtonIfRemoteIsInvalid(button: HTMLButtonElement) {
    if (!remoteIsValid()) {
        button.classList.add('rg-opacity-50', 'rg-cursor-not-allowed', 'flag-disabled')
        button.disabled = true;
        button.innerHTML += ' (원격 설정 필요)'
    }
}