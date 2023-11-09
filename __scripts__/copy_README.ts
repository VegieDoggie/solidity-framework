import fs from "fs";
import path from "path"
import {promisify} from "util";

async function main(){
    const source = path.join(process.cwd(), "README.md");
    const dest = path.join(process.cwd(), "dist", "README.md");
    await promisify(fs.copyFile)(source, dest)
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
