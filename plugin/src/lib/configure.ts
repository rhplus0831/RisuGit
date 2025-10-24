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

export function getGitURL() {
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_URL;
    }
    return getArg("risu_git_url");
}

export function getGitId() {
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_ID;
    }
    return getArg("risu_git_id");
}

export function getGitPassword() {
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_PASSWORD;
    }
    return getArg("risu_git_password");
}

export function getGitProxy() {
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_PROXY;
    }
    return getArg("risu_git_proxy");
}