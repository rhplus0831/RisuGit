// overlay.ts
export class Overlay {
    private element: HTMLDivElement | null = null;
    private cleanup: (() => void) | null = null;

    async show(html: string) {
        if (this.element) return; // 이미 열려있으면 무시

        const content = html

        this.element = document.createElement('div');
        this.element.className = 'rg-fixed rg-inset-0 rg-bg-black/50 rg-flex rg-items-center rg-justify-center rg-z-50';
        this.element.innerHTML = content

        document.body.appendChild(this.element);

        // TypeScript 로직 초기화
        const {initializeOverlayLogic} = await import('./overlay-logic');
        this.cleanup = initializeOverlayLogic(this, this.element);
    }

    close() {
        if (!this.element) return;

        // TypeScript 로직 정리
        if (this.cleanup) {
            this.cleanup();
            this.cleanup = null;
        }

        this.element.remove();
        this.element = null;
    }
}