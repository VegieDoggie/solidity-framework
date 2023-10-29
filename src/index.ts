#!/usr/bin/env node

import {CLI_ARGS_TYPE, CLI_INFO, CLI_ARG} from "./options";
import Logger from "./logger";
import logger from "./logger";
import arg from "arg";
import pkg from "../dist/package.json";
import inquirer from "inquirer";
import path from "path";
import {exec} from "child_process";
import {promisify} from "util";
import * as fs from "fs-extra";
import {fileURLToPath} from 'node:url';

const main = async () => {
    try {
        let args = arg(CLI_ARGS_TYPE, {bare: true} as any)
        if (args[CLI_ARG.VERSION]) {
            Logger.success(`v${pkg.version}`);
        } else if (args[CLI_ARG.HELP]) {
            Logger.info(CLI_INFO())
        } else if (args[CLI_ARG.DEFAULT]?.length) {
            if (args[CLI_ARG.DEFAULT].length > 1 || args[CLI_ARG.DEFAULT][0] !== CLI_ARG.INIT) {
                logger.error(`\tunknown commands: ${args[CLI_ARG.DEFAULT]}`)
                return
            }
            await template(path.join(process.cwd(), "."))
        } else {
            const answer = await inquirer.prompt([{
                type: "input",
                name: CLI_ARG.NAME,
                message: "Project Name:",
                validate: (input: string) => !!input?.trim().length,
            }])
            await template(path.join(process.cwd(), answer[CLI_ARG.NAME].trim()))
        }
    } catch (e) {
        Logger.error(e);
    }
    process.chdir(process.cwd())
    process.exit()
};

const libs = [
    "@chainlink/contracts",
    "@nomicfoundation/hardhat-foundry",
    "@nomicfoundation/hardhat-toolbox",
    "@openzeppelin/contracts",
    "@openzeppelin/contracts-upgradeable",
    "@openzeppelin/hardhat-upgrades",
    "dotenv",
    "hardhat",
    "hardhat-abi-exporter",
    "hardhat-diamond-abi",
    "hardhat-exposed",
    "hardhat-ignore-warnings",
    "uniswap-v2-deploy-plugin"
]

async function template(projectPath: string) {
    const f1 = async () => {
        await promisify(fs.mkdir)(projectPath, {recursive: true});
        process.chdir(projectPath)
        return await promisify(exec)("npm init -y")
    }
    await logger.progressCall("\r\n ⚙️ Init Project ...", f1, "npm init");
    const f2 = async () => {
        // const __dirname = path.join(require.main!.filename, "..")
        await fs.copy(path.join(__dirname, "./templates"), projectPath)
        await fs.copyFile(path.join(__dirname, "./templates/.env.example"), path.join(projectPath, ".env"))
        return
    }
    await logger.progressCall("\r\n ⚙️ Generate Template ...", f2, "template");

    const f3 = async () => {
        return await promisify(exec)(`npm i --save-dev ${libs.join(" ")}`)
    }
    await logger.progressCall("\r\n ⚙️ Install Dependencies ...", f3, ...libs);

    const f4 = async () => {
        await promisify(exec)("git init")
        await promisify(exec)("git submodule add -f https://github.com/foundry-rs/forge-std lib/forge-std")
        await promisify(exec)("git submodule add -f https://github.com/mudgen/diamond-2-hardhat.git contracts/diamond-2")
        return await promisify(exec)("git submodule update --remote --init --recursive")
    }
    await logger.progressCall("\r\n ⚙️ Init Git and Submodule...", f4, "git init", "git submodule");

    await new Promise(resolve => setTimeout(resolve, 10000));

    Logger.success("\r\n 💪 Create Success!");
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
