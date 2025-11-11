// These declarations are for TypeScript. `esbuild` will replace `process.env.*` calls with actual values during build.
declare const process: {
    env: {
        NODE_ENV: 'development' | 'production';
        RISU_ENCRYPT_KEY: string;
        RISU_GIT_URL: string;
        RISU_GIT_ID: string;
        RISU_GIT_PASSWORD: string;
        RISU_GIT_PROXY: string;
        RISU_GIT_ASSET_SERVER: string;
    }
};

// @ts-ignore
function getMyArgument(name: string) {
    // @ts-ignore
    return globalThis.__pluginApis__.getArg(`RisuGit::${name}`)
}

export function getBoolean(name: string, defaultValue: boolean) {
    const value = getMyArgument(name);
    // 값이 비어있으면 true
    if (!value) {
        return defaultValue;
    }

    return value == 1 || value == "1" || value.toString().toLowerCase() == "true";
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
    let value: string = getMyArgument("git_url");
    if (value.endsWith("/")) {
        value = value.slice(0, -1)
    }
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

export function remoteIsValid() {
    return getGitURL() && getGitId() && getGitPassword();
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

export function getAutoSave() {
    return getBoolean("git_autosave", process.env.NODE_ENV === 'development');
}

export function getAutoPush() {
    return getBoolean("git_autopush", process.env.NODE_ENV === 'development');
}

export function getBootstrap() {
    return getBoolean("git_bootstrap", process.env.NODE_ENV === 'development')
}

export function getBootstrapFull() {
    return getBoolean("git_bootstrap_full", false)
}

export function getAssetServer() {
    const value = getMyArgument("git_asset_server");
    if (value) return value;
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_ASSET_SERVER;
    }
    return "";
}