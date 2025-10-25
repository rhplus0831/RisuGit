import git, {ReadCommitResult} from "isomorphic-git";
import http from 'isomorphic-git/http/web';
import {ensureScriptLoaded} from "./script-loader";
import {decryptDatabase, EncryptDatabase, encryptDatabase} from "./encrypt";
import {getBranch, getClientName, getGitId, getGitPassword, getGitProxy, getGitURL} from "./configure";

// LightningFS 스크립트 URL
const LIGHTNING_FS_URL = "https://unpkg.com/@isomorphic-git/lightning-fs";
let fs: any = null;

// fs 인스턴스를 비동기로 가져오는 함수로 변경
async function getFs() {
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
        await currentFs.promises.stat(`${dir}/.git`);
        console.log('Git repository already exists');
        return true;
    } catch (err) {
        console.log('Initializing new git repository');
        await currentFs.promises.mkdir(dir, {recursive: true});
        await git.init({fs: currentFs, dir, defaultBranch: getBranch()});
        return false;
    }
}

export async function saveAndCommit(filename: string = 'data.json', message: string = 'Save data'): Promise<string | null> {
    const dir = '/risudata';
    const data = await encryptDatabase()

    try {
        const currentFs = await getFs(); // await를 사용하여 fs 인스턴스를 가져옵니다.

        await ensureGitRepo(dir);

        const filepath = `${dir}/${filename}`;
        await currentFs.promises.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');

        // --- 변경점 확인 로직 추가 ---
        // 1. 파일의 상태를 확인합니다.
        const status = await git.status({fs: currentFs, dir, filepath: filename, cache: {}});

        // 2. 파일 상태가 'unmodified'가 아니면 (즉, *modified, *added 등 변경이 있으면) 커밋을 진행합니다.
        console.log(status)
        if (status !== 'unmodified') {
            console.log(`Changes detected in '${filename}'. Staging and committing.`);
            // 3. 변경이 있으므로 파일을 스테이징합니다.
            await git.add({fs: currentFs, dir, filepath: filename});

            // 4. 커밋을 실행합니다.
            const sha = await git.commit({
                fs: currentFs,
                dir,
                message,
                author: {
                    name: getClientName(),
                    email: 'user@risu.app'
                }
            });

            console.log(`Committed '${filename}' with new changes:`, sha);
            return sha;
        } else {
            // 5. 변경 사항이 없을 경우
            console.log(`No changes to commit for '${filename}'. Skipping commit.`);
            return null; // 커밋이 없었으므로 null을 반환합니다.
        }

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
    const dir = '/risudata';
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

export async function saveMergeCommit(message: string = `Merge remote changes`, data: EncryptDatabase): Promise<string | null> {
    const dir = '/risudata';
    const filename = 'data.json';
    const branch = getBranch();
    const remote = 'origin';

    try {
        const currentFs = await getFs();
        await ensureGitRepo(dir);

        const filepath = `${dir}/${filename}`;
        await currentFs.promises.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
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