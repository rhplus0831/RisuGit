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

// @ts-ignore
function setMyArgument(name: string, value: string) {
    // @ts-ignore
    return globalThis.__pluginApis__.setArg(`RisuGit::${name}`, value)
}

export function getBoolean(name: string, defaultValue: boolean) {
    const value = getMyArgument(name);
    // 값이 비어있으면 true
    if (!value) {
        return defaultValue;
    }

    return value == 1 || value == "1" || value.toString().toLowerCase() == "true";
}

export function setBoolean(name: string, value: boolean) {
    setMyArgument(name, value ? 'true' : 'false')
}

export function getEncryptPassword() {
    const value = getMyArgument("encrypt_key");
    if (value) return value;
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_ENCRYPT_KEY;
    }
    return "";
}

export function setEncryptPassword(value: string) {
    setMyArgument("encrypt_key", value)
}

function wrapURL(url: string): string {
    if (url.endsWith("/")) {
        return url.slice(0, -1)
    }
    return url
}

export function getGitURL() {
    let value: string = getMyArgument("git_url");
    if (value) return wrapURL(value);
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_URL;
    }
    return ""
}

export function setGitURL(value: string) {
    setMyArgument("git_url", value);
}

export function getGitId() {
    const value = getMyArgument("git_id");
    if (value) return value;
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_ID;
    }
    return "";
}

export function setGitId(value: string) {
    setMyArgument("git_id", value)
}

export function getGitPassword() {
    const value = getMyArgument("git_password");
    if (value) return value;
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_PASSWORD;
    }
    return "";
}

export function setGitPassword(value: string) {
    return setMyArgument("git_password", value)
}

export function remoteIsValid() {
    return getGitURL() && getGitId() && getGitPassword();
}

export function getGitProxy() {
    const value = getMyArgument("git_proxy");
    if (value) return wrapURL(value);
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_PROXY;
    }
    return "https://cors.isomorphic-git.org";
}

export function setGitProxy(value: string) {
    setMyArgument("git_proxy", value)
}

export function getBranch() {
    let branch = getMyArgument("git_branch");
    if (!branch) {
        branch = "main";
    }
    return branch;
}

export function setBranch(value: string) {
    setMyArgument("git_branch", value)
}

export function getClientName() {
    let name = getMyArgument("git_client_name");
    if (!name) {
        name = "이름없음"
    }
    return name;
}

export function setClientName(value: string) {
    setMyArgument("git_client_name", value)
}

//
// 오토메틱 푸시
//

export function getOnRequestSaveChat() {
    return getBoolean("git_on_request_save_chat", process.env.NODE_ENV === 'development');
}

export function setOnRequestSaveChat(value: boolean) {
    setBoolean("git_on_request_save_chat", value)
}

export function getSettingCloseSaveOther() {
    return getBoolean("git_setting_close_save_other", process.env.NODE_ENV === 'development');
}

export function setSettingCloseSaveOther(value: boolean) {
    setBoolean("git_setting_close_save_other", value)
}

export function getAutomaticPush() {
    return getBoolean("git_automatic_push", process.env.NODE_ENV === 'development');
}

export function setAutomaticPush(value: boolean) {
    setBoolean("git_automatic_push", value)
}

//
// 부트스트랩
//

export function getBootstrapPull() {
    return getBoolean("git_bootstrap_pull", process.env.NODE_ENV === 'development')
}

export function setBootstrapPull(value: boolean) {
    setBoolean("git_bootstrap_pull", value)
}

export function getBootstrapSavePushCharacter() {
    return getBoolean("git_bootstrap_save_push_character", false)
}

export function setBootstrapSavePushCharacter(value: boolean) {
    setBoolean("git_bootstrap_save_push_character", value)
}

export function getBootstrapSavePushOther() {
    return getBoolean("git_bootstrap_save_push_other", false)
}

export function setBootstrapSavePushOther(value: boolean) {
    setBoolean("git_bootstrap_save_push_other", value)
}

export function getBootstrapPushAsset() {
    return getBoolean("git_bootstrap_push_asset", false)
}

export function setBootstrapPushAsset(value: boolean) {
    setBoolean("git_bootstrap_push_asset", value)
}

//
// 에셋 서버
//

export function getAssetServer() {
    const value = getMyArgument("git_asset_server");
    if (value) return wrapURL(value);
    if (process.env.NODE_ENV === 'development') {
        return process.env.RISU_GIT_ASSET_SERVER;
    }
    return "";
}

export function setAssetServer(value: string) {
    setMyArgument("git_asset_server", value)
}

export function getAssetServerConnectionCount() {
    const value = getMyArgument("git_asset_server_max_connection");
    if(!value) return 8;
    return parseInt(value)
}

export function setAssetServerConnectionCount(value: string) {
    setMyArgument("git_asset_server_max_connection", value)
}