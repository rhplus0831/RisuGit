import git, {ReadCommitResult} from "isomorphic-git";
import http from 'isomorphic-git/http/web';
import {ensureScriptLoaded} from "./script-loader";
import {processCharacters} from "./encrypt";
import {getGitId, getGitPassword, getGitURL} from "./configure";

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

// @ts-ignore - LightningFS는 브라우저 환경에서 전역으로 로드됨
const LightningFS = window.FS;
// TODO: Change it.
const cors = 'https://cors.isomorphic-git.org'

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
        await git.init({fs: currentFs, dir, defaultBranch: 'main'});
        return false;
    }
}

export async function saveAndCommit(filename: string = 'data.json', message: string = 'Save data'): Promise<string | null> {
    const dir = '/risudata';
    const data = await processCharacters()

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
                    name: 'Risu User',
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

export async function pushRepository() {
    try {
        const dir = '/risudata'
        const remote = 'origin'
        const branch = 'main'
        const url = getGitURL()

        const currentFs = await getFs();
        await ensureGitRepo(dir);

        // Check if remote exists. If not, add it.
        const remotes = await git.listRemotes({ fs: currentFs, dir });
        if (!remotes.find(r => r.remote === remote)) {
            await git.addRemote({ fs: currentFs, dir, remote, url });
            console.log(`Added remote '${remote}' with url '${url}'`);
        }

        const result = await git.push({
            fs: currentFs,
            http,
            dir,
            corsProxy: cors,
            remote,
            ref: branch,
            onAuth: () => ({ username: getGitId(), password: getGitPassword() }),
        });

        if (result.ok) {
            console.log(`Successfully pushed to ${remote} ${branch}.`);
            return result;
        } else {
            console.error('Push failed:', result.error);
            // It's better to throw an error with the message
            throw new Error(`Push failed: ${result.error}`);
        }
    } catch (error) {
        console.error('Error pushing repository:', error);
        throw error;
    }
}