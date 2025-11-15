export function showOrUpdateIndicator(message: string = '작업 중...', indicator: HTMLDivElement | null = null): HTMLDivElement {
    // 이미 인디케이터가 있는지 확인
    if (!indicator) {
        indicator = document.getElementById('git-autosync-indicator') as HTMLDivElement;
        if (!indicator) {
            // 없다면 새로 생성
            indicator = document.createElement('div');
            indicator.id = 'git-autosync-indicator';
            document.body.appendChild(indicator);

            // 스타일 적용
            Object.assign(indicator.style, {
                position: 'fixed',
                top: '8px',       // Y: 0% + margin 8px
                right: '8px',     // '오른쪽 상단' 기준 8px 마진
                // 만약 'X: 80%'를 'left: 80%'로 사용하려면:
                // left: '80%',
                // right: 'auto',

                backgroundColor: '#000', // 배경색 (눈에 띄게)
                color: '#fff',           // 글자색
                padding: '5px 10px',
                borderRadius: '4px',
                opacity: '0.5',          // 50% 투명도
                pointerEvents: 'none',   // 클릭 비활성화
                zIndex: '9999'           // 다른 요소들 위에 표시
            });
        }
    }

    // 내용 설정
    indicator.textContent = message;

    return indicator;
}

// 인디케이터를 숨기는 함수
export function hideIndicator(): void {
    const indicator = document.getElementById('git-autosync-indicator');
    if (indicator) {
        indicator.remove();
    }
}