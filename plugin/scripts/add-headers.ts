import * as fs from 'fs';
import * as path from 'path';

function main() {
    const filePath = path.join(__dirname, "..", "dist", "index.js")
    const content = fs.readFileSync(filePath, 'utf-8');
    const header = `//@name RisuGit
//@display-name RisuGit (rev 20251115)
//@arg encrypt_key string
//@arg git_proxy string
//@arg git_url string
//@arg git_id string
//@arg git_password string
//@arg git_branch string
//@arg git_client_name string
//@arg git_on_request_save_chat string
//@arg git_setting_close_save_other string
//@arg git_automatic_push string
//@arg git_bootstrap_pull string
//@arg git_bootstrap_save_push_character string
//@arg git_bootstrap_save_push_other string
//@arg git_bootstrap_push_asset string
//@arg git_asset_server string
//@arg git_asset_server_max_connection string

`
    const newContent = `${header}\n\n${content}`;
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✓ Added header to ${filePath}`);
    console.log('\n✅ Done!');
}

main();