import * as fs from 'fs';
import * as path from 'path';

function main() {
    const filePath = path.join(__dirname, "..", "dist", "index.js")
    const content = fs.readFileSync(filePath, 'utf-8');
    const header = `//@name _GitRisu
//@display-name RisuGit
//@arg risu_git_url string
//@arg risu_git_token string
//@arg risu_git_branch string

`
    const newContent = `${header}\n\n${content}`;
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✓ Added header to ${filePath}`);
    console.log('\n✅ Done!');
}

main();