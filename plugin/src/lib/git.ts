import git, {ReadCommitResult} from "isomorphic-git";
import http from 'isomorphic-git/http/web';
import {ensureScriptLoaded} from "./script-loader";
import {decryptValuesRecursively, deriveKey, encryptValuesRecursively} from "./encrypt";
import {getBranch, getClientName, getEncryptKey, getGitId, getGitPassword, getGitProxy, getGitURL} from "./configure";
import {SlicedCharacter, SlicedChat} from "./database";

// LightningFS 스크립트 URL
const LIGHTNING_FS_URL = "https://unpkg.com/@isomorphic-git/lightning-fs";
let fs: any = null;

const dir = '/risudata';
const baseDir = dir;

// fs 인스턴스를 비동기로 가져오는 함수로 변경
async function getFs(): Promise<any> {
    if (fs) {
        return fs;
    }

    // LightningFS 스크립트가 로드되었는지 확인하고, 아니면 로드합니다.
    await ensureScriptLoaded(LIGHTNING_FS_URL);

    // window.LightningFS가 정의될 때까지 폴링합니다.
    // @ts-ignore
    if (typeof window.LightningFS === 'undefined') {
        await new Promise<void>((resolve, reject) => {
            const timeout = 5000; // 5초 타임아웃
            const interval = 100; // 100ms 간격
            let elapsed = 0;

            const timer = setInterval(() => {
                // @ts-ignore
                if (typeof window.LightningFS !== 'undefined') {
                    clearInterval(timer);
                    resolve();
                } else {
                    elapsed += interval;
                    if (elapsed >= timeout) {
                        clearInterval(timer);
                        reject(new Error("LightningFS loaded but not found on window object after timeout."));
                    }
                }
            }, interval);
        });
    }

    // 스크립트가 로드된 후에는 window.LightningFS가 확실히 존재합니다.
    // @ts-ignore
    const LightningFS = window.LightningFS;

    if (!LightningFS) {
        // 이 오류는 거의 발생하지 않겠지만, 만약을 위해 남겨둡니다.
        throw new Error("LightningFS loaded but not found on window object.");
    }

    fs = new LightningFS('risuGitFS');
    return fs;
}

// Git 저장소 초기화 또는 확인 (이제 getFs가 비동기이므로 async/await 처리)
async function ensureGitRepo(dir: string = '/risudata') {
    const currentFs = await getFs(); // await를 사용하여 fs 인스턴스를 가져옵니다.
    try {
        console.log('Git repository already exists');
        await currentFs.promises.stat(`${dir}/.git`);
        return true;
    } catch (err) {
        console.log('Initializing new git repository');
        await currentFs.promises.mkdir(dir, {recursive: true});
        await git.init({fs: currentFs, dir, defaultBranch: getBranch()});
        return false;
    }
}

async function recursiveRmdir(pfs: any, dir: string) {
    let entries;
    try {
        // 1. Read all files and folders in the directory
        entries = await pfs.promises.readdir(dir);
    } catch (err: any) {
        if (err.toString().indexOf("ENOENT") !== -1) {
            return;
        }
        throw err;
    }

    // 2. Loop through all entries and delete them
    for (const entry of entries) {
        const entryPath = `${dir}/${entry}`;
        const stat = await pfs.promises.stat(entryPath);

        if (stat.type === 'file') {
            // 3. If it's a file, delete it
            await pfs.promises.unlink(entryPath);
        } else if (stat.type === 'dir') {
            // 4. If it's a directory, call this function recursively
            await recursiveRmdir(pfs, entryPath);
        }
    }

    // 5. After the directory is empty, delete it
    await pfs.promises.rmdir(dir);
}

/**
 * 데이터베이스를 저장하고, 새 커밋을 만듭니다
 * @param message 커밋 메시지
 */
export async function saveDatabaseAndCommit(message: string = 'Save data'): Promise<string | null> {
    try {
        let saveStart = 0;
        saveStart = (globalThis.performance ?? {now: () => Date.now()}).now();
        // 깃 저장소 활성화
        const currentFs = await getFs();
        await ensureGitRepo(baseDir);

        //암호화용 키 생성
        const encryptKey = await deriveKey(getEncryptKey());
        const database = getDatabase();

        async function writeAndAdd(filepath: string, data: any) {
            // filepath는 'dir'에 대한 상대 경로입니다 (예: 'loreBook.json')
            // ★ 수정 1: 파일 시스템에 기록할 전체 경로를 생성합니다.
            const fullFilepath = `${baseDir}/${filepath}`;
            const encrypted = JSON.stringify(await encryptValuesRecursively(data, encryptKey), null, 1);
            // console.log("writeAndAdd", filepath, encrypted)
            // ★ 수정 2: 'filepath' 대신 'fullFilepath'를 사용해 파일을 씁니다.
            await currentFs.promises.writeFile(fullFilepath, encrypted, 'utf8')

            // git.add는 'dir'와 'filepath'(상대 경로)를 받으므로 이 부분은 올바릅니다.
            await git.add({fs: currentFs, dir: baseDir, filepath: filepath});
        }

        console.log("Start saving...")
        // 상대적으로 작을 가능성이 높은 데이터는 그대로 저장
        await writeAndAdd(`characterOrder.json`, database.characterOrder)
        await writeAndAdd(`loreBook.json`, database.loreBook)
        await writeAndAdd(`personas.json`, database.personas)
        await writeAndAdd(`modules.json`, database.modules)
        await writeAndAdd(`statics.json`, database.statics)
        await writeAndAdd(`statistics.json`, database.statistics)
        await writeAndAdd(`botPresets.json`, database.botPresets)

        // 캐릭터 및 채팅 반복 시작
        const characterDir = `characters`
        // 일단 폴더를 삭제
        await recursiveRmdir(currentFs, `${baseDir}/characters`)
        // 빈 폴더 생성
        await currentFs.promises.mkdir(`${baseDir}/characters`)
        for (const character of database.characters) {
            // 캐릭터의 UID 로 폴더 생성
            const cid = character.chaId;
            const cidDir = `${characterDir}/${cid}`
            await currentFs.promises.mkdir(`${baseDir}/${cidDir}`)

            const {chats, ...remainingCharacter} = character;

            //채팅 데이터를 제외한 나머지 데이터를 저장
            await writeAndAdd(`${cidDir}/data.json`, remainingCharacter)

            const allChatPromises = character.chats.map(async (chat: SlicedChat, index: number) => {
                // 경로 정의
                const chatDir = `${cidDir}/${chat.id}`;
                const baseChatDir = `${baseDir}/${chatDir}`;
                const messageDir = `${chatDir}/messages`; // writeAndAdd용 상대 경로
                const baseMessageDir = `${baseDir}/${messageDir}`; // mkdir용 전체 경로

                // 2. 가독성을 위해 chat.message를 messages로 이름을 변경합니다.
                const {message: messages, ...remainingChat} = chat;

                // 3. 채팅 기본 디렉터리 생성. (이 작업은 선행되어야 함)
                await currentFs.promises.mkdir(baseChatDir);

                // 4. 이제 병렬로 처리할 수 있는 두 가지 작업이 있습니다.
                //    A: data.json 파일 쓰기
                //    B: message 디렉터리 생성 후 모든 메시지 파일 병렬로 쓰기

                // 작업 A 프로미스
                const dataWritePromise = writeAndAdd(`${chatDir}/data.json`, {...remainingChat, index: index});

                const encoder = new TextEncoder();

                // 작업 B 프로미스 (즉시 실행 함수(IIFE) 형태로 만듦)
                const messageProcessingPromise = (async () => {
                    // B-1: 메시지 디렉터리 생성 (선행 작업)
                    await currentFs.promises.mkdir(baseMessageDir);

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
                            // 고유 UID 임시 생성, 안전할지 잘 몰?루 겠음
                            const data = encoder.encode(JSON.stringify(messageWithIndex));
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
            });

            // 6. 모든 채팅의 처리가 병렬로 완료될 때까지 기다립니다.
            try {
                await Promise.all(allChatPromises);
                console.log(`${character.chaId}: 모든 채팅 데이터 저장이 완료되었습니다.`);
            } catch (error) {
                console.error('채팅 데이터 저장 중 오류 발생:', error);
            }
        }

        // 4. 커밋 실행
        const sha = await git.commit({
            fs: currentFs,
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

export async function getLastCommitDate(dir: string = '/risudata'): Promise<Date | null> {
    try {
        const currentFs = await getFs();
        await ensureGitRepo(dir);

        const commits = await git.log({
            fs: currentFs,
            dir,
            depth: 1, // 가장 최신 커밋 1개만 가져옵니다.
        });

        if (commits.length === 0) {
            return null; // 커밋이 없는 경우
        }

        const lastCommit = commits[0];
        const timestamp = lastCommit.commit.author.timestamp;
        // Unix 타임스탬프(초)를 밀리초로 변환하여 Date 객체를 생성합니다.
        return new Date(timestamp * 1000);

    } catch (error: any) {
        // 커밋이 아직 없는 경우 'NotFoundError'가 발생할 수 있습니다.
        if (error.code === 'NotFoundError') {
            console.log("No commits found.");
            return null;
        }
        console.error('Error getting last commit date:', error);
        throw error;
    }
}

// 나중에 가능하면 페이징 넣기
export async function getCommitHistory(dir: string = '/risudata'): Promise<ReadCommitResult[]> {
    try {
        const currentFs = await getFs();
        await ensureGitRepo(dir);

        return await git.log({
            fs: currentFs,
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
    const currentFs = await getFs();
    try {
        const {blob} = await git.readBlob({
            fs: currentFs,
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
    const text = await fs.promises.readFile(path, 'utf8')
    const key = await deriveKey(getEncryptKey())
    return decryptValuesRecursively(JSON.parse(text), key);
}

async function decryptCharactersChat(cid: string, chatId: string) {
    const chatDir = `${dir}/characters/${cid}/${chatId}`
    const baseChatData = await readAndDecryptFromPath(`${chatDir}/data.json`)

    const messageDir = `${chatDir}/messages`

    let messageFilenames: string[] = []
    try {
        messageFilenames = await fs.promises.readdir(messageDir);
    } catch (err: any) {
        // 폴더가 없는경우 채팅이 없는 채팅
        if (err.toString().indexOf("ENOENT") !== -1) {
            return []
        }
        throw err;
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

async function decryptCharacter(cid: string) {
    const cidDir = `${dir}/characters/${cid}`
    let baseData = await readAndDecryptFromPath(`${cidDir}/data.json`);
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

/**
 * 대상 시점의 모든 데이터를 복원합니다
 * @param sha 대상 지점
 */
export async function revertDatabaseToCommit(sha: string) {
    const fs = await getFs(); // fs 변수 사용

    try {
        console.log(`Attempting to revert to commit: ${sha}`);

        // 1. 작업 디렉토리를 특정 SHA의 상태로 되돌립니다.
        // force: true 는 커밋되지 않은 로컬 변경 사항을 무시하고 덮어씁니다.
        // 이 작업 후 'detached HEAD' 상태가 됩니다.
        await git.checkout({
            fs,
            dir,
            ref: sha,
            force: true
        });
        console.log(`Checked out commit ${sha} (detached HEAD).`);

        const characterOrder = await readAndDecryptFromPath(`${dir}/characterOrder.json`)
        const loreBook = await readAndDecryptFromPath(`${dir}/loreBook.json`)
        const personas = await readAndDecryptFromPath(`${dir}/personas.json`)
        const modules = await readAndDecryptFromPath(`${dir}/modules.json`)
        const statics = await readAndDecryptFromPath(`${dir}/statics.json`)
        const statistics = await readAndDecryptFromPath(`${dir}/statistics.json`)
        const botPresets = await readAndDecryptFromPath(`${dir}/botPresets.json`)

        const characters: SlicedCharacter[] = [];
        const charactersCIDs = await fs.promises.readdir(dir + "/characters");
        for (const cid of charactersCIDs) {
            characters.push(await decryptCharacter(cid))
        }

        const db = getDatabase();
        db.characters = characters;
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
        (e) {
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
    const currentFs = await getFs();

    try {
        await ensureGitRepo(dir);

        console.log(`Push to: ${url}`)

        // push를 할 때마다 URL을 강제로 설정하여 최신 상태를 유지합니다.
        await git.addRemote({fs: currentFs, dir, remote, url, force: true});

        const result = await git.push({
            fs: currentFs,
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

export async function getRemoteDiff() {
    const dir = '/risudata'
    const remote = 'origin'
    const branch = getBranch()
    const url = getGitURL()
    const currentFs = await getFs();

    // push를 할 때마다 URL을 강제로 설정하여 최신 상태를 유지합니다.
    await git.addRemote({fs: currentFs, dir, remote, url, force: true});

    await git.fetch({
        fs: currentFs,
        http,
        dir,
        corsProxy: getGitProxy(),
        remote,
        ref: branch,
        onAuth: () => ({username: getGitId(), password: getGitPassword()}),
    });

    const localSha = await git.resolveRef({fs: currentFs, dir, ref: branch});
    const remoteSha = await git.resolveRef({fs: currentFs, dir, ref: `refs/remotes/${remote}/${branch}`});

    console.log(`Local SHA: ${localSha}, Remote SHA: ${remoteSha}`);

    // 충돌하는 'data.json' 파일의 내용 가져오기
    const localData = await getFileContentAtCommit(localSha, 'data.json');
    const remoteData = await getFileContentAtCommit(remoteSha, 'data.json');

    return {
        "localData": localData,
        "remoteData": remoteData
    }
}

export async function pullRepository() {
    try {
        const dir = '/risudata';
        const remote = 'origin';
        const branch = getBranch();
        const url = getGitURL();

        const currentFs = await getFs();
        await ensureGitRepo(dir);

        console.log(`Pulling from: ${url}`);

        await git.addRemote({fs: currentFs, dir, remote, url, force: true});

        // 로컬 브랜치가 존재하는지 확인합니다.
        let localBranchExists = true;
        try {
            // resolveRef는 ref가 없으면 에러를 던집니다.
            await git.resolveRef({fs: currentFs, dir, ref: branch});
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
                fs: currentFs,
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
                fs: currentFs,
                http,
                dir,
                remote,
                ref: branch,
                singleBranch: true,
                corsProxy: getGitProxy(),
                onAuth: () => ({username: getGitId(), password: getGitPassword()}),
            });
            // 원격 브랜치를 추적하는 로컬 브랜치를 생성하고 checkout 합니다.
            await git.checkout({
                fs: currentFs,
                dir,
                ref: branch,
                remote
            });
        }

        console.log(`Successfully updated from ${remote}/${branch}.`);

    } catch (error) {
        console.error('Error pulling repository:', error);
        throw error;
    }
}

export async function saveMergeCommit(message: string = `Merge remote changes`, data: any): Promise<string | null> {
    const dir = '/risudata';
    const filename = 'data.json';
    const branch = getBranch();
    const remote = 'origin';

    try {
        const currentFs = await getFs();
        await ensureGitRepo(dir);

        const filepath = `${dir}/${filename}`;
        await currentFs.promises.writeFile(filepath, JSON.stringify(data, null, 1), 'utf8');
        await git.add({fs: currentFs, dir, filepath: filename});

        // 병합 커밋을 위한 부모 커밋 SHA 가져오기
        const localSha = await git.resolveRef({fs: currentFs, dir, ref: branch});
        const remoteSha = await git.resolveRef({fs: currentFs, dir, ref: `refs/remotes/${remote}/${branch}`});

        const sha = await git.commit({
            fs: currentFs,
            dir,
            message,
            parent: [localSha, remoteSha], // 두 개의 부모를 지정하여 병합 커밋 생성
            author: {
                name: getClientName(),
                email: 'user@risu.app'
            }
        });

        console.log(`Committed merge with new changes:`, sha);
        return sha;

    } catch (error) {
        console.error('Error saving merge commit:', error);
        throw error;
    }
}