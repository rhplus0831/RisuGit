import { BaseOverlay } from "./baseOverlay";
import * as configure from "../lib/configure";

export function settingLogic(overlay: BaseOverlay, container: HTMLDivElement): () => void {
    // Encryption
    const encryptKey = container.querySelector<HTMLInputElement>("#encrypt_key")!;

    // Git
    const gitProxy = container.querySelector<HTMLInputElement>("#git_proxy")!;
    const gitProxyPublic = container.querySelector<HTMLButtonElement>("#git_proxy_public")!;
    const gitUrl = container.querySelector<HTMLInputElement>("#git_url")!;
    const gitId = container.querySelector<HTMLInputElement>("#git_id")!;
    const gitPassword = container.querySelector<HTMLInputElement>("#git_password")!;
    const gitBranch = container.querySelector<HTMLInputElement>("#git_branch")!;
    const gitClientName = container.querySelector<HTMLInputElement>("#git_client_name")!;

    // Auto-Save
    const gitOnRequestSaveChat = container.querySelector<HTMLInputElement>("#git_on_request_save_chat")!;
    const gitSettingCloseSaveOther = container.querySelector<HTMLInputElement>("#git_setting_close_save_other")!;
    const gitAutomaticPush = container.querySelector<HTMLInputElement>("#git_automatic_push")!;

    // Behavior on Boot
    const gitBootstrapPull = container.querySelector<HTMLInputElement>("#git_bootstrap_pull")!;
    const gitBootstrapSavePushCharacter = container.querySelector<HTMLInputElement>("#git_bootstrap_save_push_character")!;
    const gitBootstrapSavePushOther = container.querySelector<HTMLInputElement>("#git_bootstrap_save_push_other")!;
    const gitBootstrapPushAsset = container.querySelector<HTMLInputElement>("#git_bootstrap_push_asset")!;

    // Asset
    const gitAssetServer = container.querySelector<HTMLInputElement>("#git_asset_server")!;
    const gitAssetServerPublic = container.querySelector<HTMLButtonElement>("#git_asset_server_public")!;
    const gitAssetConnectionCount = container.querySelector<HTMLButtonElement>("#git_asset_max_connection")!;

    // Buttons
    const saveButton = container.querySelector<HTMLButtonElement>("#save_button")!;
    const cancelButton = container.querySelector<HTMLButtonElement>("#cancel_button")!;

    // Load initial values
    encryptKey.value = configure.getEncryptPassword();
    gitProxy.value = configure.getGitProxy();
    gitUrl.value = configure.getGitURL();
    gitId.value = configure.getGitId();
    gitPassword.value = configure.getGitPassword();
    gitBranch.value = configure.getBranch();
    gitClientName.value = configure.getClientName();
    gitOnRequestSaveChat.checked = configure.getOnRequestSaveChat();
    gitSettingCloseSaveOther.checked = configure.getBoolean("git_setting_close_save_other", false);
    gitAutomaticPush.checked = configure.getAutomaticPush();
    gitBootstrapPull.checked = configure.getBootstrapPull();
    gitBootstrapSavePushCharacter.checked = configure.getBootstrapSavePushCharacter();
    gitBootstrapSavePushOther.checked = configure.getBootstrapSavePushOther();
    gitBootstrapPushAsset.checked = configure.getBootstrapPushAsset();
    gitAssetServer.value = configure.getAssetServer();
    gitAssetConnectionCount.value = configure.getAssetServerConnectionCount().toString();

    // Public server buttons
    gitProxyPublic.onclick = () => {
        gitProxy.value = "https://cors.mephistopheles.moe/";
    };
    gitAssetServerPublic.onclick = () => {
        gitAssetServer.value = "https://arisu.mephistopheles.moe/";
    };

    // Save and Cancel
    saveButton.onclick = () => {
        configure.setEncryptPassword(encryptKey.value);
        configure.setGitProxy(gitProxy.value);
        configure.setGitURL(gitUrl.value);
        configure.setGitId(gitId.value);
        configure.setGitPassword(gitPassword.value);
        configure.setBranch(gitBranch.value);
        configure.setClientName(gitClientName.value);
        configure.setOnRequestSaveChat(gitOnRequestSaveChat.checked);
        configure.setOnRequestSaveOther(gitSettingCloseSaveOther.checked);
        configure.setAutomaticPush(gitAutomaticPush.checked);
        configure.setBootstrapPull(gitBootstrapPull.checked);
        configure.setBootstrapSavePushCharacter(gitBootstrapSavePushCharacter.checked);
        configure.setBootstrapSavePushOther(gitBootstrapSavePushOther.checked);
        configure.setBootstrapPushAsset(gitBootstrapPushAsset.checked);
        configure.setAssetServer(gitAssetServer.value);
        configure.setAssetServerConnectionCount(gitAssetConnectionCount.value);
        overlay.close();
    };

    cancelButton.onclick = () => {
        overlay.close();
    };

    return () => {
        // No cleanup needed
    };
}
