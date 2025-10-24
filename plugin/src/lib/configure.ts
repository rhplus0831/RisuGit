// These declarations are for TypeScript. `esbuild` will replace `process.env.*` calls with actual values during build.
declare const process: {
    env: {
        NODE_ENV: 'development' | 'production';
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

export function getGitURL() {
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_URL;
    }
    return getMyArgument("git_url");
}

export function getGitId() {
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_ID;
    }
    return getMyArgument("git_id");
}

export function getGitPassword() {
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_PASSWORD;
    }
    return getMyArgument("git_password");
}

export function getGitProxy() {
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_PROXY;
    }
    return getMyArgument("git_proxy");
}

export function getBranch() {
    let branch = getMyArgument("git_branch");
    if(!branch) {
        branch = "main";
    }
    return branch;
}

export function getClientName() {
    let name = getMyArgument("git_client_name");
    if(!name) {
        name = "이름없음"
    }
    return name;
}