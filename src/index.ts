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
import {createFile, pathExistsSync, readFile, readFileSync, statSync, writeFile} from "fs-extra";
import {ChainInspector} from "./chain/ChainInspector";

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
            // cmd: sol networks
            if (args[CLI_ARG.DEFAULT][0] === CLI_ARG.NETWORKS) {
                const root = path.join(process.cwd(), ChainInspector.HARDHAT_NETWORK_FILE_NAME)
                if (!pathExistsSync(root) || !statSync(root).isFile()) {
                    logger.warning(`[WARN] Missing ${root}!`)
                    await createFile(root);
                }
                let chainRPCs = ChainInspector.parseChainRPCs(await ChainInspector.fetchChainInfos());
                let chainList = chainRPCs.map(chain => chain.network);
                const cmdList = args[CLI_ARG.DEFAULT].slice(1)?.filter(network => {
                    if (!chainList.includes(network)) {
                        logger.warning(`[WARN] Unknown network name: ${network}, maybe just try "sol networks"`)
                        process.exit(1);
                    }
                    return true
                })
                let pickNetworks = cmdList.length > 0 ? cmdList : chainList
                const processHardhat = async () => {
                    return await ChainInspector.processHardhat(pickNetworks, chainRPCs);
                }
                const {hardhatNetwork, warnings} =
                    await logger.progressCall("", processHardhat, ...pickNetworks);
                if (warnings) {
                    logger.warning(warnings)
                }
                const content = (await promisify(readFile)(root)).toString().trim()
                const networks = JSON.parse(content.length > 0 ? content : "{}");
                for (let network in hardhatNetwork) {
                    networks[network] = hardhatNetwork[network]
                }
                const write = async () => await promisify(writeFile)(root, JSON.stringify(networks, undefined, 2))
                await logger.progressCall("", write, "Write")
                return
            }
            if (args[CLI_ARG.DEFAULT][0] === CLI_ARG.SHOW && args[CLI_ARG.DEFAULT][1] === CLI_ARG.NETWORKS) {
                logger.success(
                    `${ChainInspector.HardhatVerifyChainsList()
                        .map((network, i) => {
                            return ((i + 1) % 5 === 0 ? network.padEnd(18) + " \n" : network.padEnd(22) + " ")
                        })
                        .join("")
                    }`
                )
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
    "hardhat-ignore-warnings",
    "uniswap-v2-deployer"
]

const libs = [
    "@openzeppelin/contracts",
    "@openzeppelin/contracts-upgradeable",
    "@chainlink/contracts",
]

async function template(projectPath: string) {

    // npm init
    const funcInit = async () => {
        await promisify(fs.mkdir)(projectPath, {recursive: true});
        process.chdir(projectPath)
        return await promisify(exec)("npm init -y")
    }
    await logger.progressCall("\r\n ⚙️ Init Project ...", funcInit, "npm init");

    // promise Hardhat
    const promHardhat = ChainInspector.processHardhat()

    // copy template
    const funcTemplate = async () => {
        // const __dirname = path.join(require.main!.filename, "..")
        await fs.copy(path.join(__dirname, "./template"), projectPath)
        await promisify(fs.rename)(path.join(projectPath, "_.gitignore"), path.join(projectPath, ".gitignore"))
        return
    }
    await logger.progressCall("\r\n ⚙️ Install Template ...", funcTemplate, "template");

    // npm i
    const funcNpm = async () => {
        await promisify(exec)(`npm i --save-dev ${libDevs.join(" ")}`)
        return await promisify(exec)(`npm i ${libs.join(" ")}`)
    }
    await logger.progressCall("\r\n ⚙️ Install Dependencies ...", funcNpm, ...[...libDevs, ...libs]);

    // git
    const funcGit = async () => {
        await promisify(exec)("git init")
        await promisify(exec)("git submodule add -f https://github.com/foundry-rs/forge-std lib/forge-std")
        await promisify(exec)("git submodule add -f https://github.com/mudgen/diamond-2-hardhat.git contracts/diamond-2")
        return await promisify(exec)("git submodule update --remote --init --recursive")
    }
    await logger.progressCall("\r\n ⚙️ Init Git and Submodule...", funcGit, "git init", "git submodule");

    // hardhat
    const funcNetwork = async () => {
        const hardhat = await promHardhat
        await Promise.all([
            ChainInspector.write(path.join(projectPath, ChainInspector.HARDHAT_NETWORK_FILE_NAME), hardhat.hardhatNetwork, true),
            ChainInspector.write(path.join(projectPath, ChainInspector.ENV_EXAMPLE_FILE_NAME), hardhat.env),
            ChainInspector.write(path.join(projectPath, ChainInspector.ENV_FILE_NAME), hardhat.env)
        ])
        return hardhat
    }
    const hardhat = await logger.progressCall("\r\n ⚙️ Detect Networks...", funcNetwork, "hardhat");
    if (hardhat.warnings) {
        logger.warning(hardhat.warnings)
    }

    // git add
    await promisify(exec)("git add .")

    // done
    Logger.success("\r\n 👋 Success! Have a good day!");
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
