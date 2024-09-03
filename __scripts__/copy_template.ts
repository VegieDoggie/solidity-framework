import * as fs from "fs-extra";

async function main() {
    const from = "./template/", to = "./dist/template/";
    await Promise.all([
        fs.copy(from + "contracts", to + "contracts"),
        fs.copy(from + "ignition", to + "ignition"),
        fs.copy(from + "scripts", to + "scripts"),
        fs.copy(from + "test", to + "test"),
        fs.copy(from + ".env.example", to + ".env.example"),
        fs.copy(from + ".gitignore", to + "_.gitignore"), //
        fs.copy(from + ".gitmodules", to + ".gitmodules"),
        fs.copy(from + "foundry.toml", to + "foundry.toml"),
        fs.copy(from + "hardhat.config.ts", to + "hardhat.config.ts"),
        fs.copy(from + "README.md", to + "README.md"),
        fs.copy(from + "README.en.md", to + "README.en.md"),
        fs.copy(from + "tsconfig.json", to + "tsconfig.json"),
    ])
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
