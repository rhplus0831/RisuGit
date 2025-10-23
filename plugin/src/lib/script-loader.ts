// 현재 로딩 중인 스크립트의 Promise를 저장하는 맵
const loadingPromises: { [src: string]: Promise<void> } = {};

/**
 * 스크립트를 동적으로 로드하고, 로드가 완료되면 resolve되는 Promise를 반환합니다.
 * 이미 로드되었거나 로딩 중인 경우 중복 실행을 방지합니다.
 * @param src 스크립트의 URL
 * @returns 로드가 완료되면 resolve되는 Promise
 */
export function ensureScriptLoaded(src: string): Promise<void> {
    // 1. 이미 스크립트 태그가 DOM에 있는지 확인
    if (document.querySelector(`script[src="${src}"]`)) {
        return Promise.resolve(); // 이미 로드됨
    }

    // 2. 현재 다른 곳에서 로딩 중인지 확인
    // @ts-ignore
    if (loadingPromises[src]) {
        return loadingPromises[src]; // 로딩 중인 Promise를 그대로 반환
    }

    // 3. 새로 로딩 시작
    const promise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;

        script.onload = () => {
            // 로딩 성공 시, 맵에서 해당 Promise 제거
            delete loadingPromises[src];
            resolve();
        };

        script.onerror = (err) => {
            // 로딩 실패 시, 맵에서 제거하고 reject
            delete loadingPromises[src];
            document.head.removeChild(script); // 실패한 스크립트 태그 제거
            reject(new Error(`Failed to load script: ${src}\n${err}`));
        };

        document.head.appendChild(script);
    });

    // 맵에 현재 로딩 중인 Promise를 저장
    loadingPromises[src] = promise;
    return promise;
}