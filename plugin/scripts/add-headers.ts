import * as fs from 'fs';
import * as path from 'path';

function main() {
    const filePath = path.join(__dirname, "..", "dist", "index.js")
    const content = fs.readFileSync(filePath, 'utf-8');
    const header = `//@name RisuGit
//@display-name RisuGit
//@arg encrypt_key string
//@arg git_url string
//@arg git_id string
//@arg git_password string
//@arg git_proxy string
//@arg git_branch string
//@arg git_client_name string
//@arg git_autosave string
//@arg git_autopush string
//@arg git_bootstrap string
//@arg git_bootstrap_full string

`
    const newContent = `${header}\n\n${content}`;
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✓ Added header to ${filePath}`);
    console.log('\n✅ Done!');
}

main();