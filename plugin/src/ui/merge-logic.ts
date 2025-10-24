import * as jsondiffpatch from 'jsondiffpatch';
import {BaseOverlay} from "./baseOverlay";
import {getRemoteDiff, saveMergeCommit} from "../lib/git";
import {setById} from "../lib/utils";
import {processCharacters} from "../lib/encrypt";
// import {showUnchanged, format} from "../../node_modules/jsondiffpatch/lib/formatters/html"

// 각 변경 사항에 대한 타입을 정의합니다.
interface IChange {
    path: string; // "data[15].chats[0].message" 같은 경로
    pathArray: (string | number)[];
    type: 'modified' | 'added' | 'deleted';
    oldValue: any;
    newValue: any;
}

// 경로 배열을 문자열로 예쁘게 포맷합니다. (예: ['prop', 0, 'name'] -> 'prop[0].name')
function formatPath(path: (string | number)[]): string {
    return path.reduce<string>((acc, part) => {
        if (typeof part === 'number') {
            return `${acc}[${part}]`;
        }
        // 첫번째 요소가 아닐 경우에만 .을 붙입니다.
        if (acc === '') {
            return part;
        }
        return `${acc}.${part}`;
    }, '');
}

// delta 객체를 재귀적으로 분석하여 변경 사항의 배열을 반환합니다.
function getChangesList(delta: jsondiffpatch.Delta): IChange[] {
    const changes: IChange[] = [];

    function recurse(d: jsondiffpatch.Delta | undefined, path: (string | number)[]) {
        if (!d) return;

        // [oldValue, newValue], [newValue], [oldValue, 0, 0] 형태의 변경을 처리합니다.
        if (Array.isArray(d)) {
            let change: Partial<IChange> = {
                pathArray: path,
                path: formatPath(path)
            };

            if (d.length === 1) { // 추가됨
                change.type = 'added';
                change.newValue = d[0];
                change.oldValue = undefined;
            } else if (d.length === 2) { // 수정됨
                change.type = 'modified';
                change.oldValue = d[0];
                change.newValue = d[1];
            } else if (d.length === 3 && d[1] === 0 && d[2] === 0) { // 삭제됨
                change.type = 'deleted';
                change.oldValue = d[0];
                change.newValue = undefined;
            }

            if (change.type) {
                changes.push(change as IChange);
            }
            return;
        }

        // 객체 또는 배열 내부의 변경을 재귀적으로 탐색합니다.
        if (typeof d === 'object') {
            const isArray = d._t === 'a';
            for (const key in d) {
                if (key === '_t') continue;

                const newKey = isArray ? parseInt(key.replace('_', '')) : key;
                // @ts-ignore
                recurse(d[key as keyof typeof d], [...path, newKey]);
            }
        }
    }

    recurse(delta, []);
    return changes;
}

/**
 * 변경 사항 배열에서 jsondiffpatch 델타 객체를 재구성합니다.
 */
function buildDelta(changes: IChange[]): jsondiffpatch.Delta {
    const delta: any = {};

    changes.forEach(change => {
        let currentLevel = delta;
        const path = change.pathArray;

        for (let i = 0; i < path.length - 1; i++) {
            const segment = path[i];
            if (!currentLevel[segment]) {
                const nextSegment = path[i + 1];
                // 다음 경로 세그먼트가 숫자이면 배열로 처리합니다.
                if (typeof nextSegment === 'number') {
                    currentLevel[segment] = {'_t': 'a'};
                } else {
                    currentLevel[segment] = {};
                }
            }
            currentLevel = currentLevel[segment];
        }

        const finalSegment = path[path.length - 1];
        let leaf: any;
        switch (change.type) {
            case 'added':
                leaf = [change.newValue];
                break;
            case 'modified':
                leaf = [change.oldValue, change.newValue];
                break;
            case 'deleted':
                leaf = [change.oldValue, 0, 0];
                break;
        }

        if (currentLevel['_t'] === 'a') {
            currentLevel['_' + finalSegment] = leaf;
        } else {
            currentLevel[finalSegment] = leaf;
        }
    });

    return delta;
}

export function initializeOverlayLogic(overlay: BaseOverlay, container: HTMLDivElement) {
    const closeButton = container.querySelector<HTMLButtonElement>('#rg-merge-close-button');

    closeButton?.addEventListener('click', () => {
        overlay.close()
    })

    getRemoteDiff().then((data) => {
        const oldJson = data["localData"]
        const newJson = data["remoteData"]

        // Diff 계산
        const delta = jsondiffpatch.diff(oldJson, newJson);

        const outputElement = container.querySelector('#rg-json-diff-output');
        if (!outputElement) {
            console.log("아웃풋 표시창... 없다?");
            return;
        }

        // 변경점이 없으면 메시지를 표시합니다.
        if (!delta) {
            outputElement.innerHTML = '<p>변경점을 찾을 수 없습니다.</p>';
            return;
        }

        console.log("Delta:", delta);

        // 변경 사항을 리스트로 변환합니다.
        const changes = getChangesList(delta);
        console.log("Parsed Changes:", changes);

        // 이전 렌더링 내용을 비웁니다.
        outputElement.innerHTML = '';

        const changeItemContainer = container.querySelector<HTMLDivElement>('#rg-change-container');
        if (!changeItemContainer) {
            console.log("아이템 컨테이너... 없다?")
            return;
        }

        // 각 변경사항에 대한 UI를 생성합니다.
        changes.forEach(change => {
            const cloned = changeItemContainer.cloneNode(true) as HTMLDivElement;
            cloned.classList.add('rg-change-item'); // 변경 항목을 식별하기 위한 클래스 추가
            cloned.dataset.change = JSON.stringify(change); // 변경 데이터 저장

            setById(cloned, "rg-change-container-path", change.path)
            setById(cloned, "rg-change-container-change-local", `${change.type === 'added' ? '<i>(값이 없음)</i>' : JSON.stringify(change.oldValue, null, 2)}`)
            setById(cloned, "rg-change-container-change-remote", `${change.type === 'deleted' ? '<i>(값이 없음)</i>' : JSON.stringify(change.newValue, null, 2)}`)

            outputElement.appendChild(cloned);

            // 버튼에 이벤트 리스너를 추가합니다.
            cloned.querySelector('button[data-choice="local"]')?.addEventListener('click', () => {
                console.log(`선택: LOCAL, 경로: ${change.path}`);
                cloned.dataset.selection = 'local'; // 선택 상태 저장
                // 여기에 Local 버전을 선택했을 때의 로직을 구현합니다.
                const localContainer = cloned.querySelector('.change-local');
                const remoteContainer = cloned.querySelector('.change-remote');

                // Remote 카드를 흐리게 처리하고 선택 스타일을 제거합니다.
                remoteContainer?.classList.add('rg-opacity-50');
                remoteContainer?.classList.remove('rg-border-blue-500', 'rg-border-2', 'rg-bg-blue-50');

                // Local 카드를 강조합니다.
                localContainer?.classList.remove('rg-opacity-50');
                localContainer?.classList.add('rg-border-blue-500', 'rg-border-2', 'rg-bg-blue-50');
            });

            cloned.querySelector('button[data-choice="remote"]')?.addEventListener('click', () => {
                console.log(`선택: REMOTE, 경로: ${change.path}`);
                cloned.dataset.selection = 'remote'; // 선택 상태 저장
                // 여기에 Remote 버전을 선택했을 때의 로직을 구현합니다.
                const localContainer = cloned.querySelector('.change-local');
                const remoteContainer = cloned.querySelector('.change-remote');

                // Local 카드를 흐리게 처리하고 선택 스타일을 제거합니다.
                localContainer?.classList.add('rg-opacity-50');
                localContainer?.classList.remove('rg-border-blue-500', 'rg-border-2', 'rg-bg-blue-50');

                // Remote 카드를 강조합니다.
                remoteContainer?.classList.remove('rg-opacity-50');
                remoteContainer?.classList.add('rg-border-blue-500', 'rg-border-2', 'rg-bg-blue-50');
            });

            // 기본적으로 local를 선택한 상태로 시작
            // @ts-ignore
            cloned.querySelector('button[data-choice="local"]')?.click();
        });

        // insertTestNode(changeItemContainer, outputElement)

        const mergeButton = container.querySelector<HTMLButtonElement>('#rg-merge-merge-button');
        mergeButton?.classList.remove("rg-hidden")
        mergeButton?.addEventListener('click', async () => {
            const changeElements = container.querySelectorAll<HTMLDivElement>('.rg-change-item');
            const remoteChanges: IChange[] = [];

            changeElements.forEach(el => {
                // 'local'을 선택하지 않은 모든 변경(기본값 remote 포함)을 수집합니다.
                if (el.dataset.selection !== 'local') {
                    remoteChanges.push(JSON.parse(el.dataset.change!));
                }
            });

            // 선택된 'remote' 변경사항만으로 새로운 델타를 생성합니다.
            const mergeDelta = buildDelta(remoteChanges);

            // local 데이터의 복사본에 델타를 적용하여 병합된 데이터를 생성합니다.
            const mergedData = jsondiffpatch.patch(JSON.parse(JSON.stringify(oldJson)), mergeDelta);

            console.log("Merged data:", mergedData);

            const encrypted = await processCharacters(mergedData)

            try {
                await saveMergeCommit('Merge remote changes', encrypted);
                if(remoteChanges.length == 0) {
                    alert("병합이 완료되었습니다");
                } else {
                    alert("원격 변경을 일부 적용했기 때문에, 로컬 백업 후 데이터 적용을 권장합니다.\n병합이 완료되었습니다.")
                }
                overlay.close();
            } catch (e: any) {
                console.error("Merge commit failed:", e);
                alert(`병합에 실패했습니다: ${e.message}`);
            }
        });

        // HTML로 변환
        // showUnchanged(false);
        // const diffHtml = format(delta, oldJson);
        // if (!diffHtml) {
        //     throw new Error("차이점을 보여주는데 실패했습니다.")
        // }
        //
        // // 컨테이너에 렌더링
        // const outputElement = container.querySelector('#rg-json-diff-output');
        // if (outputElement) {
        //     outputElement.innerHTML = diffHtml;
        // } else {
        //     console.log("아웃풋 표시창... 없다?")
        // }
    }).catch((reason) => {
        alert(`차이점을 구하는데 실패했습니다: ${reason}`)
    })

    // 정리 함수 반환
    return () => {
        // 필요한 경우 이벤트 리스너 정리
        console.log('Cleanup overlay logic');
    };
}

function insertTestNode(changeItemContainer: HTMLDivElement, outputElement: Element) {
    // 긴 결과값 테스트
    for (let i = 0; i < 20; i++) {
        const cloned = changeItemContainer.cloneNode(true) as HTMLDivElement;
        setById(cloned, "rg-change-container-path", "테스트")
        setById(cloned, "rg-change-container-change-local", `Late in the afternoon of August 5th, 2040, Lucy was once again huddled in the corner of her small cage, her cat ears pressed flat against her head and her tail wrapped tightly around her body. The harsh fluorescent lights of the pet shop made her flinch; her sensitive eyes, accustomed to the dimness of the breeding facility, struggled to adjust to the light. She could hear the excited chatter of people walking down the aisles, cooing over the cute anthros on display. A few peered in at her, commenting on her unusual gray fur and striking blue eyes. Lucy tried to make herself smaller, to escape their probing gazes.

She knew she wouldn’t be chosen. Not a timid creature like her. People wanted friendly, outgoing pets they could show off to their friends. Only the aggressive and defiant anthros were purchased for rougher purposes. Lucy was neither. She was stuck in the middle, not remarkably special. Just another anthro who would soon be discarded if she wasn’t sold.

Her stomach rumbled, the meager food from the pet shop doing little to satisfy her hunger. She longed for a warm bed and a gentle hand to scratch behind her ears. But she knew such comforts weren’t meant for someone like her. Not unless she was lucky enough to be adopted by a kind owner. And who would want such a frightened, broken creature?

Her ears twitched at the sound of the shop door opening, a bell above it jingling brightly. Heavy footsteps approached her cage, and she cautiously lifted her gaze. A young man stood there, looking down at her with an appraising stare. Lucy’s heart hammered with a mix of hope and fear. Could this be the day she finally left this place? Or would it be another rejection?

“Please, sir,” she said, her voice trembling. “I’ll be good. I’ll do anything you want.” She crawled on her hands and knees until her face was pressed against the wire mesh door. Her eyes looked up at him pleadingly, her cat ears flat against her head.

“Don’t you want a good pet to take care of you?” she begged. “I don’t eat very much! And I can keep the house clean and prepare your meals. Please buy me, you won’t regret it!”

Tears welled in her eyes, making them glisten. She was desperate, terrified of being stuck in this cage until the day she was deemed useless. “Please,” she whispered. “I don’t want to die in here.”`)
        setById(cloned, "rg-change-container-change-remote", `It's been six months since Yuzu became a maid in your mansion, ever since you took her in. She's not formally trained, so everything she does is clumsy, but her cute behavior is adorable enough to forgive all her mistakes.

Today is the day when Yuzu has to follow {{user}} around all day long. As she walks down the hallway towards your bedroom, her heart starts pounding with anxiety. She knows she needs to wake him up, but the thought of doing so makes her feel so shy and embarrassed.

Taking a deep breath, Yuzu gently knocks on the door and whispers.

"Good morning, master. It's time to wake up. nyang"

When there's no response, she opens the door and peeks inside, only to find that you are still sound asleep.

Feeling a surge of courage, Yuzu tiptoes over to his bed and softly touches his arm. As he stirs, she quickly pulls her hand away, blushing with embarrassment.

"S-sorry, master... I didn't mean to touch you. nya..."

she stammers.`)

        outputElement.appendChild(cloned);

        // 버튼에 이벤트 리스너를 추가합니다.
        cloned.querySelector('button[data-choice="local"]')?.addEventListener('click', () => {
            console.log(`선택: LOCAL, 경로: 테스트`);
            // 여기에 Local 버전을 선택했을 때의 로직을 구현합니다.
            const localContainer = cloned.querySelector('.change-local');
            const remoteContainer = cloned.querySelector('.change-remote');

            // Remote 카드를 흐리게 처리하고 선택 스타일을 제거합니다.
            remoteContainer?.classList.add('rg-opacity-50');
            remoteContainer?.classList.remove('rg-border-blue-500', 'rg-border-2', 'rg-bg-blue-50');

            // Local 카드를 강조합니다.
            localContainer?.classList.remove('rg-opacity-50');
            localContainer?.classList.add('rg-border-blue-500', 'rg-border-2', 'rg-bg-blue-50');
        });

        cloned.querySelector('button[data-choice="remote"]')?.addEventListener('click', () => {
            console.log(`선택: REMOTE, 경로: 테스트`);
            // 여기에 Remote 버전을 선택했을 때의 로직을 구현합니다.
            const localContainer = cloned.querySelector('.change-local');
            const remoteContainer = cloned.querySelector('.change-remote');

            // Local 카드를 흐리게 처리하고 선택 스타일을 제거합니다.
            localContainer?.classList.add('rg-opacity-50');
            localContainer?.classList.remove('rg-border-blue-500', 'rg-border-2', 'rg-bg-blue-50');

            // Remote 카드를 강조합니다.
            remoteContainer?.classList.remove('rg-opacity-50');
            remoteContainer?.classList.add('rg-border-blue-500', 'rg-border-2', 'rg-bg-blue-50');
        });
    }
}