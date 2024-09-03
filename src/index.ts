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

const main = async () => {
    try {
        let args = arg(CLI_ARGS_TYPE, {bare: true} as any)
        if (args[CLI_ARG.VERSION]) {
            Logger.success(`${pkg.version}`);
        } else if (args[CLI_ARG.HELP]) {
            Logger.success(CLI_INFO())
        } else if (args[CLI_ARG.DEFAULT]?.length) {
            // cmd: sol init
            if (args[CLI_ARG.DEFAULT][0] === CLI_ARG.INIT && args[CLI_ARG.DEFAULT].length === 1) {
                await template(process.cwd())
                return
            }
            logger.error(`\tunknown commands: ${args[CLI_ARG.DEFAULT]}`)
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
        Logger.error("[ERROR]", e);
    }
    process.exit()
};

const libDevs = [
    "@nomicfoundation/hardhat-foundry",
    "@nomicfoundation/hardhat-toolbox",
    "@openzeppelin/hardhat-upgrades",
    "dotenv",
    "hardhat",
    "hardhat-abi-exporter",
    "hardhat-diamond-abi",
    "hardhat-exposed",
    "hardhat-ignore-warnings"
]

const libs = [
    "@openzeppelin/contracts",
    "@openzeppelin/contracts-upgradeable",
]

async function template(projectPath: string) {

    // init
    const funcInit = async () => {
        await promisify(fs.mkdir)(projectPath, {recursive: true});
        process.chdir(projectPath)
        return promisify(exec)("npm init -y");
    }
    await logger.progressCall("\r\n ⚙️ Init Project ...", funcInit, "npm init");

    // copy
    const funcTemplate = async () => {
        await fs.copy(path.join(__dirname, "./template"), projectPath)
        await promisify(fs.rename)(path.join(projectPath, "_.gitignore"), path.join(projectPath, ".gitignore"))
        return
    }
    await logger.progressCall("\r\n ⚙️ Install Template ...", funcTemplate, "template");

    // install
    const funcNpm = async () => {
        await promisify(exec)(`npm i --save-dev ${libDevs.join(" ")}`)
        return promisify(exec)(`npm i ${libs.join(" ")}`);
    }
    await logger.progressCall("\r\n ⚙️ Install Dependencies ...", funcNpm, ...[...libDevs, ...libs]);

    // submodule
    const funcGit = async () => {
        await promisify(exec)("git init")
        await promisify(exec)("git submodule add -f https://github.com/foundry-rs/forge-std lib/forge-std")
        return promisify(exec)("git submodule update --remote --init --recursive");
    }
    await logger.progressCall("\r\n ⚙️ Init Git and Submodule...", funcGit, "git init", "git submodule");

    await promisify(exec)("git add .")

    // done
    Logger.success("\r\n 👋 Success! Have a good day!");
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
