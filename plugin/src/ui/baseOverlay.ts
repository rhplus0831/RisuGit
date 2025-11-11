import baseElementTemplate from './baseOverlay.html';

// overlay.ts
export class BaseOverlay {
    private element: HTMLDivElement | null = null;
    private cleanup: (() => void) | null | undefined = null;
    public extraCleanup: (() => void) | null = null;

    async show(html: string, logic: "panel" | "merge" | "quick") {
        if (this.element) return; // 이미 열려있으면 무시

        const content = html
        let tempContainer = document.createElement('div');
        tempContainer.innerHTML = baseElementTemplate;

        // To get the first child of the parsed HTML
        this.element = tempContainer.firstChild as HTMLDivElement;

        const holder = this.element.querySelector("#rg-content-holder") as HTMLDivElement
        holder.innerHTML = content

        document.body.appendChild(this.element);

        // TypeScript 로직 초기화
        if (logic == "panel") {
            const {initializeOverlayLogic} = await import('./panel-logic');
            this.cleanup = initializeOverlayLogic(this, this.element);
        } else if (logic == "merge") {
            const {initializeOverlayLogic} = await import('./merge-logic');
            this.cleanup = initializeOverlayLogic(this, this.element);
        } else if (logic == "quick") {
            const {initializeOverlayLogic} = await import('./quick-logic');
            this.cleanup = initializeOverlayLogic(this, this.element);
        }
    }

    close() {
        if (!this.element) return;

        // TypeScript 로직 정리
        if (this.cleanup) {
            this.cleanup();
            this.cleanup = null;
        }

        if (this.extraCleanup) {
            this.extraCleanup();
            this.extraCleanup = null;
        }

        this.element.remove();
        this.element = null;
    }
}