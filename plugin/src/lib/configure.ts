// These declarations are for TypeScript. `esbuild` will replace `process.env.*` calls with actual values during build.
declare const process: {
    env: {
        NODE_ENV: 'development' | 'production';
        RISU_ENCRYPT_KEY: string;
        RISU_GIT_URL: string;
        RISU_GIT_ID: string;
        RISU_GIT_PASSWORD: string;
        RISU_GIT_PROXY: string;
    }
};

// @ts-ignore
function getMyArgument(name: string) {
    // @ts-ignore
    return globalThis.__pluginApis__.getArg(`RisuGit::${name}`)
}

export function getEncryptPassword() {
    const value = getMyArgument("encrypt_key");
    if (value) return value;
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_ENCRYPT_KEY;
    }
    return "";
}

export function getGitURL() {
    const value = getMyArgument("git_url");
    if (value) return value;
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_URL;
    }
    return ""
}

export function getGitId() {
    const value = getMyArgument("git_id");
    if (value) return value;
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_ID;
    }
    return "";
}

export function getGitPassword() {
    const value = getMyArgument("git_password");
    if (value) return value;
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_PASSWORD;
    }
    return "";
}

export function getGitProxy() {
    const value = getMyArgument("git_proxy");
    if (value) return value;
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_PROXY;
    }
    return "https://cors.isomorphic-git.org";
}

export function getBranch() {
    let branch = getMyArgument("git_branch");
    if (!branch) {
        branch = "main";
    }
    return branch;
}

export function getClientName() {
    let name = getMyArgument("git_client_name");
    if (!name) {
        name = "이름없음"
    }
    return name;
}