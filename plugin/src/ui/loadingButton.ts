/**
 * 긴 작업을 하고 있음을 표시하고, 관련된 버튼을 비활성화 했다가 되돌림
 * @param loadingButton 로딩이 되고있는 변수
 * @param disableButtons 비활성화할 버튼들
 * @param innerFunction 실제로 실행해야 하는 함수
 */
export function applyClickHandlerWithSpinner(loadingButton: HTMLButtonElement, disableButtons: HTMLButtonElement[], innerFunction: () => Promise<void>) {
    async function wrapped() {
        const originalInnerHTML = loadingButton.innerHTML;
        loadingButton.innerHTML = '<div class="rg-animate-spin rg-rounded-full rg-h-3 rg-w-3 rg-border-4 rg-border-solid rg-border-white rg-border-t-transparent"></div>'

        disableButtons.forEach((button) => {
            button.disabled = true;
        })

        try {
            await innerFunction()
        } finally {
            loadingButton.innerHTML = originalInnerHTML;
            disableButtons.forEach((button) => {
                button.disabled = false;
            })
        }
    }
    loadingButton.onclick = wrapped;
}