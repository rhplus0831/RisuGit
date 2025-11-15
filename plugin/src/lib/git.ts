import git, {ReadCommitResult, remove, statusMatrix} from "isomorphic-git";
import http from 'isomorphic-git/http/web';
import {decryptValuesRecursively, deriveKey, encryptValuesRecursively} from "./encrypt";
import {
    getBranch,
    getClientName,
    getEncryptPassword,
    getGitId,
    getGitPassword,
    getGitProxy,
    getGitURL
} from "./configure";
import {IndexedCharacter, SlicedCharacter, SlicedChat} from "./risu";
import {calculateFSUsage, deleteFile, fileExists, getFs, recursiveRmdir, safeMkdir} from "./fs";

const dir = '/risudata';
const baseDir = dir;

export async function getDiskUsage() {
    let quota: number | undefined = undefined;
    let usage: number | undefined = undefined;
    try {
        const estimate = await navigator.storage.estimate();

        quota = estimate.quota;
        usage = estimate.usage;
    } catch (error) {
        console.error('저장 용량 확인 중 오류 발생:', error);
    }

    return {
        quota: quota,
        usage: usage,
        fs: await calculateFSUsage()
    }
}

// Git 저장소 초기화 또는 확인 (이제 getFs가 비동기이므로 async/await 처리)
async function ensureGitRepo() {
    const fs = await getFs(); // await를 사용하여 fs 인스턴스를 가져옵니다.
    try {
        console.log('Git repository already exists');
        await fs.promises.stat(`${dir}/.git`);

        // 복구중 발생했을 수 있는 DETACHED HEAD 상태 방지
        let branches = await git.listBranches({fs, dir})
        let branch = await git.currentBranch({
            fs,
            dir,
            fullname: false,
            test: true
        })
        if (branch === undefined && branches.includes(getBranch())) {
            await git.checkout({
                fs,
                dir,
                ref: getBranch(),
                force: true
            });
        }
        return true;
    } catch (err) {
        console.log('Initializing new git repository');
        await safeMkdir(dir)
        await git.init({fs: fs, dir, defaultBranch: getBranch()});
        return false;
    }
}

export async function deleteRepo() {
    await recursiveRmdir('/risudata')
}

/**
 * 작업 디렉터리에서 삭제된 모든 파일을 찾아 스테이징(remove)합니다.
 * (git add -u 와 유사하게 동작)
 * @param {string} dir - 저장소 경로
 */
async function stageAllDeletedFiles() {
    const fs = await getFs()
    try {
        // 1. 저장소 상태 매트릭스를 가져옵니다.
        const matrix = await statusMatrix({fs, dir});

        // 2. 삭제된 파일(Stage=1, Workdir=0)만 필터링합니다.
        const deletedFiles = matrix
            .filter(([filepath, head, workdir, stage]) => {
                // head: 1 (committed)
                // workdir: 0 (deleted)
                // stage: 1 (tracked in index)
                return stage === 1 && workdir === 0;
            })
            .map(([filepath]) => filepath); // 파일 경로만 추출

        if (deletedFiles.length === 0) {
            console.log('스테이징할 삭제된 파일이 없습니다.');
            return;
        }

        console.log('삭제 스테이징 대상:', deletedFiles);

        // 3. 삭제된 파일 목록을 순회하며 'remove' 명령 실행
        // (Promise.all을 사용해 병렬로 처리 가능)
        await Promise.all(
            deletedFiles.map(filepath => {
                console.log(`Staging deletion: ${filepath}`);
                return remove({fs, dir, filepath});
            })
        );

        console.log('모든 삭제된 파일이 스테이징되었습니다.');

    } catch (error) {
        console.error('삭제 파일 스테이징 중 오류 발생:', error);
    }
}

/**
 * 현재 레포를 지우고 원격에서 깊이를 1로 해서 데이터를 다시 받습니다
 */
export async function recloneRepoWithLowDepth() {
    const fs = await getFs();
    await ensureGitRepo();

    const remote = 'origin'
    const branch = getBranch()

    await git.addRemote({fs: fs, dir, remote, url: getGitURL(), force: true});

    // 로컬 브랜치가 존재하는지 확인합니다.
    let localBranchExists = true;
    try {
        // resolveRef는 ref가 없으면 에러를 던집니다.
        await git.resolveRef({fs: fs, dir, ref: branch});
    } catch (e: any) {
        if (e.code === 'NotFoundError') {
            localBranchExists = false;
        } else {
            throw e; // 다른 종류의 에러는 다시 던집니다.
        }
    }

    if (localBranchExists) {
        // 최신 레포 정보를 받아옵니다
        await git.fetch({
            fs: fs,
            http,
            dir,
            remote,
            ref: branch,
            singleBranch: true,
            corsProxy: getGitProxy(),
            onAuth: () => ({username: getGitId(), password: getGitPassword()}),
        });
        const localSha = await git.resolveRef({fs: fs, dir, ref: branch});
        const remoteSha = await git.resolveRef({fs: fs, dir, ref: `refs/remotes/${remote}/${branch}`});

        if (localSha !== remoteSha) {
            throw new Error("서버의 커밋 상태와 현재 커밋 상태에 차이가 있습니다. 가져오기를 먼저 진행해주세요.")
        }
        await recursiveRmdir('/risudata')
    }

    await pullRepository(1)
}

async function _writeAndAdd(encryptKey: CryptoKey, filepath: string, data: any) {
    // filepath는 'dir'에 대한 상대 경로입니다 (예: 'loreBook.json')
    // ★ 수정 1: 파일 시스템에 기록할 전체 경로를 생성합니다.
    const fs = await getFs();
    const fullFilepath = `${baseDir}/${filepath}`;
    const encrypted = JSON.stringify(await encryptValuesRecursively(data, encryptKey), null, 1);
    // console.log("writeAndAdd", filepath, encrypted)
    // ★ 수정 2: 'filepath' 대신 'fullFilepath'를 사용해 파일을 씁니다.
    await fs.promises.writeFile(fullFilepath, encrypted, 'utf8')

    // git.add는 'dir'와 'filepath'(상대 경로)를 받으므로 이 부분은 올바릅니다.
    await git.add({fs: fs, dir: baseDir, filepath: filepath});
}

async function saveCharacter(encryptKey: CryptoKey, character: SlicedCharacter, index: number, chatID: string | undefined = undefined) {
    async function writeAndAdd(filepath: string, data: any) {
        await _writeAndAdd(encryptKey, filepath, data)
    }

    const currentFullBackup = await fileExists('/risudata/characterOrder.json')
    if (!currentFullBackup) {
        throw new Error("전체 백업을 한번은 수행해야 합니다")
    }

    const characterDir = `characters`
    const cid = character.chaId;
    const cidDir = `${characterDir}/${cid}`

    // 마지막 접근일자 확인, 누르기만 해도 업데이트 되기 때문에 이 값이 변하지 않은경우 넘겨도 무관
    const dataFile = `${dir}/${cidDir}/data.json`
    try {
        const data = await readAndDecryptFromPath(dataFile)
        console.log(`${data.lastInteraction} =? ${character.lastInteraction}`)
        if (data.lastInteraction == character.lastInteraction) {
            return;
        }

        // 백업을 해야 하는 경우 일단 파일을 지움, 채팅 백업중 날아간 경우 이후 백업이 되지 못할 수도 있음
        await deleteFile(dataFile)
    } catch (e: any) {
        console.log(e)
    }

    const {chats, ...remainingCharacter} = character;

    // 채팅 아이디를 따로 지정하지 않은경우 전부 날리기
    if (chatID === undefined) {
        await recursiveRmdir(`${baseDir}/${cidDir}`)
    }

    await safeMkdir(`${baseDir}/${characterDir}`)
    await safeMkdir(`${baseDir}/${cidDir}`)

    const encoder = new TextEncoder();

    async function saveChat(chat: SlicedChat, chatIndex: number) {
        // 경로 정의
        const chatDir = `${cidDir}/${chat.id}`;
        const baseChatDir = `${baseDir}/${chatDir}`;
        const messageDir = `${chatDir}/messages`; // writeAndAdd용 상대 경로
        const baseMessageDir = `${baseDir}/${messageDir}`; // mkdir용 전체 경로

        // 2. 가독성을 위해 chat.message를 messages로 이름을 변경합니다.
        const {message: messages, ...remainingChat} = chat;

        // 확실하게 비워두기
        await recursiveRmdir(baseChatDir)

        // 3. 채팅 기본 디렉터리 생성. (이 작업은 선행되어야 함)
        await safeMkdir(baseChatDir);

        // 4. 이제 병렬로 처리할 수 있는 두 가지 작업이 있습니다.
        //    A: data.json 파일 쓰기
        //    B: message 디렉터리 생성 후 모든 메시지 파일 병렬로 쓰기

        // 작업 A 프로미스
        const dataWritePromise = writeAndAdd(`${chatDir}/data.json`, {...remainingChat, index: chatIndex});

        // 저장 대상이 아닌 경우 기초 데이터만 저장 (인덱스 유지용)
        if (chatID !== undefined && chat.id != chatID) {
            await dataWritePromise;
            return;
        }

        // 작업 B 프로미스 (즉시 실행 함수(IIFE) 형태로 만듦)
        const messageProcessingPromise = (async () => {
            // 메시지가 없는경우, 넘기기
            if (!messages) {
                return;
            }
            // 이전 내역 지우기
            await recursiveRmdir(baseMessageDir);
            console.log("remove?")
            // B-1: 메시지 디렉터리 생성 (선행 작업)
            await safeMkdir(baseMessageDir);

            const messageWritePromises = messages.map(async (message, index) => {
                // (중요) 원본 message 객체를 수정하는 대신,
                // index가 포함된 '새로운' 객체를 만듭니다. (권장되는 방식)
                const messageWithIndex = {
                    ...message,   // 기존 message 객체의 모든 속성을 복사
                    index: index  // 'index'라는 키로 순서 추가 (원하는 키 이름 사용 가능)
                };
                let uid = message.chatId;
                // send, sendas 등으로 보내진 메시지
                if (uid === undefined) {
                    // 고유 UID 임시 생성, 그리 안전해보이지는 않는데, 애초에 send, sendas 를 쓰는 상황이 거의 없어서...
                    const data = encoder.encode(`${character.chaId}-${chat.id}-${index}`);
                    const hash = await crypto.subtle.digest('SHA-256', data);
                    // 1. ArrayBuffer를 바이트 배열(Uint8Array)로 변환합니다.
                    const hashArray = Array.from(new Uint8Array(hash));

                    // 2. 각 바이트(숫자)를 16진수 문자열로 변환하고,
                    //    '0'으로 패딩하여 항상 2자리를 만들고 (예: 5 -> "05"),
                    //    모두 합쳐서 최종 문자열을 만듭니다.
                    uid = hashArray
                        .map((b) => b.toString(16).padStart(2, '0'))
                        .join('');
                }
                return writeAndAdd(`${messageDir}/${uid}.json`, messageWithIndex);
            });

            // B-3: 이 채팅의 모든 메시지 쓰기 작업을 병렬로 실행하고 기다립니다.
            await Promise.all(messageWritePromises);
        })(); // <-- ()를 붙여 즉시 실행

        // 5. 작업 A와 작업 B를 병렬로 실행하고 둘 다 완료될 때까지 기다립니다.
        await Promise.all([
            dataWritePromise,
            messageProcessingPromise
        ]);
    }

    let chatPromises: Promise<void>[] = []
    chatPromises = character.chats.map(async (chat: SlicedChat, index: number) => {
        return saveChat(chat, index)
    });
    await Promise.all(chatPromises);

    // 마지막으로 데이터 파일 작성
    await writeAndAdd(`${cidDir}/data.json`, {...remainingCharacter, index: index})
}

/**
 * 특정 캐릭터의 데이터를 저장합니다
 * @param message
 * @param characterID
 * @param chatID 채팅 아이디, 지정되지 않으면 모든 채팅을 저장합니다
 * @param progressCallback
 */
export async function saveCharacterAndCommit(message: string = 'Save data', characterID: string, chatID: string | undefined, progressCallback: (message: string) => Promise<void>) {
    let saveStart = 0;
    saveStart = (globalThis.performance ?? {now: () => Date.now()}).now();
    // 깃 저장소 활성화
    const fs = await getFs();
    await ensureGitRepo();
    const encryptKey = await deriveKey(getEncryptPassword());

    const alreadyExist = await fileExists(`${dir}/keytest.json`);
    if (alreadyExist) {
        try {
            await readAndDecryptFromPath(`${dir}/keytest.json`)
        } catch (e: any) {
            if (e.toString().indexOf("OperationError") !== -1) {
                throw new Error(`현재 저장되어 있는 데이터의 복호화에 실패했습니다, 키가 다를 수 있습니다.\n다른 키를 써야 한다면 고유한 다른 저장소를 쓰는것을 권장합니다.`)
            } else {
                throw e;
            }
        }
    }

    const database = getDatabase()
    for (let characterIndex = 0; characterIndex < database.characters.length; characterIndex++) {
        const character = database.characters[characterIndex];
        if (character.chaId == characterID) {
            await saveCharacter(encryptKey, character, characterIndex, chatID)
        }
    }

    await stageAllDeletedFiles();

    // 4. 커밋 실행
    const sha = await git.commit({
        fs: fs,
        dir: baseDir,
        message,
        author: {
            name: getClientName(),
            email: 'user@risu.app'
        }
    });

    const saveEnd = (globalThis.performance ?? {now: () => Date.now()}).now();
    console.log(`커밋 저장 시간: ${(saveEnd - saveStart).toFixed(2)} ms`);
    return sha;
}

export async function saveOtherAndCommit(message: string = '기타 데이터') {
    let saveStart = 0;
    saveStart = (globalThis.performance ?? {now: () => Date.now()}).now();

    const fs = await getFs();
    await ensureGitRepo();
    const encryptKey = await deriveKey(getEncryptPassword());

    const alreadyExist = await fileExists(`${dir}/keytest.json`);
    if (alreadyExist) {
        try {
            await readAndDecryptFromPath(`${dir}/keytest.json`)
        } catch (e: any) {
            if (e.toString().indexOf("OperationError") !== -1) {
                throw new Error(`현재 저장되어 있는 데이터의 복호화에 실패했습니다, 키가 다를 수 있습니다.\n다른 키를 써야 한다면 고유한 다른 저장소를 쓰는것을 권장합니다.`)
            } else {
                throw e;
            }
        }
    } else {
        throw new Error("전체 백업을 한번은 수행해야 합니다")
    }

    async function writeAndAdd(filepath: string, data: any) {
        await _writeAndAdd(encryptKey, filepath, data)
    }

    const database = getDatabase();
    await writeAndAdd(`characterOrder.json`, database.characterOrder)
    await writeAndAdd(`loreBook.json`, database.loreBook)
    await writeAndAdd(`personas.json`, database.personas)
    await writeAndAdd(`modules.json`, database.modules)
    await writeAndAdd(`statics.json`, database.statics)
    await writeAndAdd(`statistics.json`, database.statistics)
    await writeAndAdd(`botPresets.json`, database.botPresets)

    // 4. 커밋 실행
    const sha = await git.commit({
        fs: fs,
        dir: baseDir,
        message,
        author: {
            name: getClientName(),
            email: 'user@risu.app'
        }
    });

    const saveEnd = (globalThis.performance ?? {now: () => Date.now()}).now();
    console.log(`커밋 저장 시간: ${(saveEnd - saveStart).toFixed(2)} ms`);
    return sha;
}

/**
 * 데이터베이스를 저장하고, 새 커밋을 만듭니다
 * @param message 커밋 메시지
 * @param progressCallback
 */
export async function saveDatabaseAndCommit(message: string = 'Save data', progressCallback: (message: string) => Promise<void>): Promise<string | null> {
    try {
        let saveStart = 0;
        saveStart = (globalThis.performance ?? {now: () => Date.now()}).now();
        // 깃 저장소 활성화
        const fs = await getFs();
        await ensureGitRepo();

        //암호화용 키 생성
        const encryptKey = await deriveKey(getEncryptPassword());
        const database = getDatabase();

        async function writeAndAdd(filepath: string, data: any) {
            await _writeAndAdd(encryptKey, filepath, data)
        }

        if (progressCallback) {
            await progressCallback(`백업중: 기초 데이터...`)
        }

        const alreadyExist = await fileExists(`${dir}/keytest.json`);
        if (alreadyExist) {
            try {
                await readAndDecryptFromPath(`${dir}/keytest.json`)
            } catch (e: any) {
                if (e.toString().indexOf("OperationError") !== -1) {
                    throw new Error(`현재 저장되어 있는 데이터의 복호화에 실패했습니다, 키가 다를 수 있습니다.\n다른 키를 써야 한다면 고유한 다른 저장소를 쓰는것을 권장합니다.`)
                } else {
                    throw e;
                }
            }
        }

        // 상대적으로 작을 가능성이 높은 데이터는 그대로 저장
        await writeAndAdd("keytest.json", {"test": crypto.randomUUID()})
        await writeAndAdd(`characterOrder.json`, database.characterOrder)
        await writeAndAdd(`loreBook.json`, database.loreBook)
        await writeAndAdd(`personas.json`, database.personas)
        await writeAndAdd(`modules.json`, database.modules)
        await writeAndAdd(`statics.json`, database.statics)
        await writeAndAdd(`statistics.json`, database.statistics)
        await writeAndAdd(`botPresets.json`, database.botPresets)

        for (let characterIndex = 0; characterIndex < database.characters.length; characterIndex++) {
            const character = database.characters[characterIndex];
            console.log(`인덱스 ${characterIndex}: ${character}`);
            if (progressCallback) {
                await progressCallback(`백업중: ${character.name}`)
            }
            await saveCharacter(encryptKey, character, characterIndex, undefined)
        }

        await stageAllDeletedFiles();

        // 4. 커밋 실행
        const sha = await git.commit({
            fs: fs,
            dir: baseDir,
            message,
            author: {
                name: getClientName(),
                email: 'user@risu.app'
            }
        });

        const saveEnd = (globalThis.performance ?? {now: () => Date.now()}).now();
        console.log(`커밋 저장 시간: ${(saveEnd - saveStart).toFixed(2)} ms`);
        return sha;
    } catch (error) {
        console.error('Error saving and committing:', error);
        throw error;
    }
}

// 나중에 가능하면 페이징 넣기
export async function getCommitHistory(): Promise<ReadCommitResult[]> {
    try {
        const fs = await getFs();
        await ensureGitRepo();

        return await git.log({
            fs: fs,
            dir,
        });
    } catch (error: any) {
        if (error.code === 'NotFoundError') {
            console.log("No commits found.");
            return [];
        }
        console.error('Error getting commit history:', error);
        throw error;
    }
}

export async function getFileContentAtCommit(sha: string, filename: string): Promise<any | null> {
    const fs = await getFs();
    try {
        const {blob} = await git.readBlob({
            fs: fs,
            dir,
            oid: sha,
            filepath: filename
        });
        const content = new TextDecoder('utf-8').decode(blob);
        return JSON.parse(content);
    } catch (e: any) {
        if (e.code === 'NotFoundError') {
            console.log(`File '${filename}' not found at commit '${sha}'.`);
            return null;
        }
        console.error(`Error reading file '${filename}' at commit '${sha}':`, e);
        throw e;
    }
}

async function readAndDecryptFromPath(path: string) {
    const fs = await getFs();
    const text = await fs.promises.readFile(path, 'utf8')
    const key = await deriveKey(getEncryptPassword())
    return decryptValuesRecursively(JSON.parse(text), key);
}

async function decryptCharactersChat(cid: string, chatId: string) {
    const chatDir = `${dir}/characters/${cid}/${chatId}`
    const baseChatData = await readAndDecryptFromPath(`${chatDir}/data.json`)

    const messageDir = `${chatDir}/messages`

    const fs = await getFs();

    let messageFilenames: string[] = []
    try {
        messageFilenames = await fs.promises.readdir(messageDir);
    } catch (err: any) {
        // 폴더가 없는경우 채팅이 없는 채팅이므로, 비어있게 냅두면 됨
        if (err.toString().indexOf("ENOENT") === -1) {
            throw err;
        }
    }

    // 1. 모든 메시지 읽기 작업을 프로미스 배열로 만듭니다.
    const readPromises = messageFilenames
        .filter(filename => filename.endsWith('.json')) // .json 파일만 대상
        .map(filename => {
            return readAndDecryptFromPath(`${messageDir}/${filename}`);
        });

    // 2. 모든 메시지를 병렬로 읽어옵니다.
    const messages = await Promise.all(readPromises);

    // 3. (Sort by Index) 'index' 키를 기준으로 오름차순 정렬합니다.
    messages.sort((a, b) => a.index - b.index);
    // 정렬 후: [ {..., index: 0}, {..., index: 1}, {..., index: 2} ]

    // 4. (Remove Index) 'index' 속성을 제거한 새 배열을 만듭니다.
    const finalMessages = messages.map(message => {
        const {index, ...rest} = message;

        return rest;
    });
    return {
        ...baseChatData,
        message: finalMessages // 복원 과정이기 때문에 원본의 이름을 따름
    };
}

async function decryptCharacter(cid: string, progressCallback: (message: string) => Promise<void>): Promise<IndexedCharacter> {
    const cidDir = `${dir}/characters/${cid}`
    let baseData = await readAndDecryptFromPath(`${cidDir}/data.json`);

    if (progressCallback) {
        await progressCallback(`복원중: ${baseData.name}`)
    }

    const fs = await getFs();

    const characterFilenames: string[] = await fs.promises.readdir(cidDir);

    // 모든 채팅을 병렬로 읽고
    const readPromises = characterFilenames
        .filter(filename => !filename.endsWith('.json')) // data.json 을 뺀 파일 (메시지) 들이 대상
        .map(filename => {
            return decryptCharactersChat(cid, filename);
        });

    // 2. 모든 채팅을 병렬로 읽어온 뒤
    const chats = await Promise.all(readPromises);

    // 3. 채팅 순서 정렬
    chats.sort((a, b) => a.index - b.index);

    // 4. (Remove Index) 'index' 속성을 제거한 새 배열을 만듭니다.
    const finalChats = chats.map(chat => {
        const {index, ...rest} = chat;
        return rest;
    });

    return {
        ...baseData,
        chats: finalChats
    };
}

async function checkCommitExists(oid: string) {
    try {
        // 커밋 읽기 시도
        await git.readCommit({
            fs: await getFs(),
            dir,
            oid: oid
        });

        // 성공: 커밋이 존재함
        console.log(`✅ 커밋 ${oid}가 로컬에 존재합니다.`);
        return true;

    } catch (e: any) {
        // 실패: 에러 확인
        if (e.toString().indexOf('NotFoundError') !== -1) {
            // NotFoundError: 커밋이 존재하지 않음
            console.log(`❌ 커밋 ${oid}를 로컬에서 찾을 수 없습니다.`);
            return false;
        } else {
            // 그 외 다른 에러 (예: 저장소 손상, 권한 문제 등)
            console.error(`확인 중 다른 에러 발생: ${e.message}`);
            throw e; // 예기치 않은 에러는 다시 던져서 처리
        }
    }
}

/**
 * 대상 시점의 모든 데이터를 복원합니다
 * @param sha 대상 지점
 * @param progressCallback
 */
export async function revertDatabaseToCommit(sha: string, progressCallback: (message: string) => Promise<void>) {
    const fs = await getFs(); // fs 변수 사용

    try {
        console.log(`Attempting to revert to commit: ${sha}`);

        // 폴더를 정리
        await recursiveRmdir(`${dir}/characters`)

        // 1. 작업 디렉토리를 특정 SHA의 상태로 되돌립니다.
        // force: true 는 커밋되지 않은 로컬 변경 사항을 무시하고 덮어씁니다.
        // 이 작업 후 'detached HEAD' 상태가 됩니다.

        const remote = 'origin'
        const commitExist = await checkCommitExists(sha);
        if (!commitExist) {
            await git.fetch({
                fs,
                http,
                dir,
                remote,
                ref: sha,           // 1. 브랜치 대신 원하는 SHA를 지정
                depth: 1,           // 2. 해당 커밋 하나만 가져오도록 설정
                corsProxy: getGitProxy(),
                onAuth: () => ({username: getGitId(), password: getGitPassword()}),
            });
        }

        console.log("Fetch Complete")

        await git.checkout({
            fs,
            dir,
            ref: sha,
            force: true
        });
        console.log(`Checked out commit ${sha} (detached HEAD).`);

        if (progressCallback) {
            await progressCallback("복원중: 기초 데이터")
        }
        const characterOrder = await readAndDecryptFromPath(`${dir}/characterOrder.json`)
        const loreBook = await readAndDecryptFromPath(`${dir}/loreBook.json`)
        const personas = await readAndDecryptFromPath(`${dir}/personas.json`)
        const modules = await readAndDecryptFromPath(`${dir}/modules.json`)
        const statics = await readAndDecryptFromPath(`${dir}/statics.json`)
        const statistics = await readAndDecryptFromPath(`${dir}/statistics.json`)
        const botPresets = await readAndDecryptFromPath(`${dir}/botPresets.json`)

        const characters: IndexedCharacter[] = [];
        const charactersCIDs = await fs.promises.readdir(dir + "/characters");
        for (const cid of charactersCIDs) {
            characters.push(await decryptCharacter(cid, progressCallback))
        }

        // 3. 채팅 순서 정렬
        characters.sort((a, b) => a.index - b.index);

        // 4. (Remove Index) 'index' 속성을 제거한 새 배열을 만듭니다.
        const finalCharacters = characters.map(chat => {
            const {index, ...rest} = chat;
            return rest;
        });

        const db = getDatabase();
        db.characters = finalCharacters;
        db.characterOrder = characterOrder;
        db.loreBook = loreBook;
        db.personas = personas;
        db.modules = modules;
        db.statics = statics;
        db.statistics = statistics;
        db.botPresets = botPresets;
        setDatabase(db)
        console.log(`Revert to branch ${getBranch()}`);
    } catch
        (e: any) {
        console.log(e)
        if (e.toString().indexOf("CommitNotFetchedError") !== -1) {
            throw new Error("특정 커밋으로 돌아갈 수 없었습니다. 서버가 특정 커밋만 받는 작업을 지원하지 않을 수 있습니다.")
        } else if (e.toString().indexOf("OperationError") !== -1) {
            throw new Error(`복호화에 실패했습니다, 키가 다를 수 있습니다.`)
        }
        console.error(`Failed to revert to commit ${sha}:`, e);
        throw e
    } finally {
        await git.checkout({
            fs,
            dir,
            ref: getBranch(),
            force: true
        });
    }
}

export async function pushRepository() {
    const dir = '/risudata'
    const remote = 'origin'
    const branch = getBranch()
    const url = getGitURL()
    const fs = await getFs();

    try {
        await ensureGitRepo();

        console.log(`Push to: ${url}`)

        // push를 할 때마다 URL을 강제로 설정하여 최신 상태를 유지합니다.
        await git.addRemote({fs: fs, dir, remote, url, force: true});

        const result = await git.push({
            fs: fs,
            http,
            dir,
            corsProxy: getGitProxy(),
            remote,
            ref: branch,
            onAuth: () => ({username: getGitId(), password: getGitPassword()}),
        });

        if (result.ok) {
            console.log(`Successfully pushed to ${remote} ${branch}.`);
            return result;
        } else {
            console.error('Push failed:', result.error);
            // It's better to throw an error with the message
            throw new Error(`Push failed: ${result.error}`);
        }
    } catch (error: any) {
        console.error('Error pushing repository:', error);
        throw error;
    }
}

export async function pullRepository(depth: number | undefined = undefined) {
    try {
        const dir = '/risudata';
        const remote = 'origin';
        const branch = getBranch();
        const url = getGitURL();

        const fs = await getFs();
        await ensureGitRepo();

        console.log(`Pulling from: ${url}`);

        await git.addRemote({fs: fs, dir, remote, url, force: true});

        // 로컬 브랜치가 존재하는지 확인합니다.
        let localBranchExists = true;
        try {
            // resolveRef는 ref가 없으면 에러를 던집니다.
            await git.resolveRef({fs: fs, dir, ref: branch});
        } catch (e: any) {
            if (e.code === 'NotFoundError') {
                localBranchExists = false;
            } else {
                throw e; // 다른 종류의 에러는 다시 던집니다.
            }
        }

        if (localBranchExists) {
            // 브랜치가 존재하면, 변경사항을 pull 합니다.
            console.log(`Local branch '${branch}' exists. Pulling changes.`);
            await git.pull({
                fs: fs,
                http,
                dir,
                ref: branch,
                singleBranch: true,
                corsProxy: getGitProxy(),
                onAuth: () => ({username: getGitId(), password: getGitPassword()}),
                author: {
                    name: getClientName(),
                    email: 'user@risu.app'
                }
            });
        } else {
            // 브랜치가 없으면, 원격 저장소에서 fetch 하고 checkout 합니다 (클론과 유사).
            console.log(`Local branch '${branch}' not found. Fetching and checking out.`);
            await git.fetch({
                fs: fs,
                http,
                dir,
                remote,
                ref: branch,
                singleBranch: true,
                corsProxy: getGitProxy(),
                depth,
                onAuth: () => ({username: getGitId(), password: getGitPassword()}),
            });
            // 원격 브랜치를 추적하는 로컬 브랜치를 생성하고 checkout 합니다.
            await git.checkout({
                fs: fs,
                dir,
                ref: branch,
                remote,
                force: true
            });
        }

        console.log(`Successfully updated from ${remote}/${branch}.`);

    } catch (error) {
        console.error('Error pulling repository:', error);
        throw error;
    }
}

export async function mergeCommit(
    message: string = `Merge remote changes`,
    useLocal: boolean // true이면 local, false이면 remote의 내용을 따름
): Promise<string | null> {
    const dir = '/risudata';
    const branch = getBranch();
    const remote = 'origin';

    try {
        const fs = await getFs();
        await ensureGitRepo();

        await git.fetch({
            fs: fs,
            http,
            dir,
            corsProxy: getGitProxy(),
            remote,
            ref: branch,
            onAuth: () => ({username: getGitId(), password: getGitPassword()}),
        });

        // 1. 병합할 두 부모 커밋의 SHA를 가져옵니다.
        const localSha = await git.resolveRef({fs: fs, dir, ref: branch});
        const remoteSha = await git.resolveRef({fs: fs, dir, ref: `refs/remotes/${remote}/${branch}`});

        // 2. useLocal 플래그에 따라 사용할 부모 SHA를 선택합니다.
        const chosenSha = useLocal ? localSha : remoteSha;
        console.log(`Creating merge commit, using content from: ${useLocal ? 'local' : 'remote'} (${chosenSha})`);

        // 3. 선택한 커밋의 'tree' SHA를 가져옵니다.
        // tree는 해당 커밋 시점의 모든 파일 상태(스냅샷)를 가리킵니다.
        const commitDetails = await git.readCommit({
            fs: fs,
            dir,
            oid: chosenSha
        });
        const chosenTreeSha = commitDetails.commit.tree;

        // 4. 병합 커밋을 생성합니다.
        const sha = await git.commit({
            fs: fs,
            dir,
            message,
            parent: [localSha, remoteSha], // 부모를 2개 지정하여 '병합 커밋'으로 만듭니다.
            tree: chosenTreeSha,           // 파일 내용은 'chosenTreeSha'의 것을 그대로 사용합니다.
            author: {
                name: getClientName(),
                email: 'user@risu.app'
            }
        });

        // 5. (중요) 현재 브랜치가 이 새 병합 커밋을 가리키도록 업데이트합니다.
        // git.commit은 커밋 객체만 생성할 뿐, 브랜치 포인터를 옮기지 않습니다.
        await git.writeRef({
            fs: fs,
            dir,
            ref: `refs/heads/${branch}`, // 예: 'refs/heads/main'
            value: sha,
            force: true // 기존 localSha에서 이 newSha로 강제 업데이트
        });

        // 6. (권장) 파일 시스템(working directory)을 새 커밋 상태와 동기화합니다.
        await git.checkout({
            fs: fs,
            dir,
            ref: branch,
            force: true
        });

        console.log(`Committed merge ${sha} using ${useLocal ? 'local' : 'remote'} content.`);
        return sha;
    } catch (error) {
        console.error('Error saving "ours" or "theirs" merge commit:', error);
        throw error;
    }
}