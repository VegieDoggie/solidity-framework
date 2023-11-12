import fetch, {RequestInit} from "node-fetch";
import {createFile, writeFile} from "fs-extra";
import {queue as AsyncQueue} from "async";
import {promisify} from "util";
import os from "os";
import {builtinChains as HardhatVerifyChains} from "@nomicfoundation/hardhat-verify/internal/chain-config";
import chainlistChainIds from "../../chainlist/constants/chainIds.json";
import chainlistRPCs from "../../chainlist/constants/extraRpcs";
import {sleep} from "../sleep";
import {Chain, HardhatNetwork, VerifyChain} from "../../ChainInspector";
import logger from "../logger";

export class ChainInspector {
    static HARDHAT_NETWORK_FILE_NAME = "hardhat.network.json";
    static ENV_EXAMPLE_FILE_NAME = ".env.example";
    static ENV_FILE_NAME = ".env";

    static processHardhat = async (pickNetworks?: string[], chainRPCs?: VerifyChain[]) => {
        if (!chainRPCs) {
            const chainInfos = await ChainInspector.fetchChainInfos()
            chainRPCs = ChainInspector.parseChainRPCs(chainInfos)
        }
        const {hardhatNetwork, warnings} = await ChainInspector.parseHardhatNetwork(chainRPCs, 5000, pickNetworks)
        const env = ChainInspector.parseEnv(hardhatNetwork)
        return {hardhatNetwork, warnings, env}
    }

    // step 1
    static fetchChainInfos = async () => {
        // fetch data
        const [chainInfos, llamaTvls] = await Promise.all([
            (async () => {
                return await (await fetch("https://chainid.network/chains.json")).json() as Chain.Info[]
            })(),
            (async () => {
                return (await (await fetch("https://api.llama.fi/chains")).json() as Chain.LlamaTvl[])
                    .reduce((pre, cur) => {
                        return pre.set(cur.name.toLowerCase(), cur.tvl)
                    }, new Map<string, number>());
            })()
        ]);

        const combine = (chainInfo: Chain.Info, llamaTvls: Map<string, number>, chainlistRPCs: Chain.ChainlistRPCs, chainlistChainIds: Chain.ChainlistChainIds) => {
            // remove rpc tail "/" and wrap to { url: <url> }
            const unslashAndWrap = (rpc: string | { url: string }): { url: string } => {
                if (typeof rpc === "string") {
                    return {
                        url: rpc.endsWith("/") ? rpc.slice(0, -1) : rpc,
                    };
                } else {
                    return {
                        ...rpc,
                        url: rpc.url.endsWith("/") ? rpc.url.slice(0, -1) : rpc.url,
                    };
                }
            }
            // distinct rpc and remove useless
            const rpcs = [
                ...chainInfo.rpc?.map(unslashAndWrap) ?? [],
                ...chainlistRPCs[chainInfo.chainId]?.rpcs?.map(unslashAndWrap) ?? []
            ];
            const res = [], set = new Set();
            for (let rpc of rpcs) {
                if (set.has(rpc.url)) continue
                if (rpc.url.includes("${INFURA_API_KEY}")) continue
                if (rpc.url.includes("${ALCHEMY_API_KEY}")) continue
                set.add(rpc.url)
                res.push(rpc)
            }
            chainInfo.rpc = res;
            // add chainSlug field
            const chainSlug = chainlistChainIds[chainInfo.chainId];
            return !llamaTvls.has(chainSlug)
                ? chainInfo
                : {
                    ...chainInfo,
                    tvl: llamaTvls.get(chainSlug),
                    chainSlug,
                };
        }

        // combine and sort
        return chainInfos
            .map((chain) => combine(chain, llamaTvls, chainlistRPCs, chainlistChainIds))
            .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0));
    }

    // step 2
    // iChains: function `fetchChainInfos()` returned
    static parseChainRPCs = (iChains: Chain.Info[]) => {
        const vChains = HardhatVerifyChains.reduce((pre, cur) => {
            return pre.set(cur.chainId, cur.network)
        }, new Map<number, string>());
        return iChains.reduce((pre, cur) => {
            if (!vChains.has(cur.chainId)) return pre;
            if (!cur.rpc?.length) return pre;
            const rpcList = cur.rpc.map(rpc => rpc.url);
            pre.push({
                network: vChains.get(cur.chainId)!,
                chainId: cur.chainId,
                rpcs: rpcList

            });
            return pre
        }, [] as VerifyChain[]);
    }

    static HardhatVerifyChainsList = () => {
        return HardhatVerifyChains.map(chain => chain.network)
    }

    // step 3
    // chains: function `parseChainRPCs()` returned
    static parseHardhatNetwork = async (chains: VerifyChain[], timeout = 3000, pickNetworks?: string[]) => {
        type PickRPCTask = {
            url: string
            requestInit: RequestInit
            timeout: number
            chainController: {
                finished: boolean
                errCounter: number
                maxErrCount: number
            }
        }
        const concurrencyLimit = Math.max(8, Math.floor(os.cpus().length));
        const taskQueue = AsyncQueue<PickRPCTask>(async (task) => {
            if (task.chainController.finished) return
            try {
                const res = await Promise.race([
                    fetch(task.url, task.requestInit),
                    sleep(task.timeout)
                ])
                if (res?.ok) {
                    const data = await res.json();
                    if (data.result && BigInt(data.result) > 0n) {
                        task.chainController.finished = true
                        return task.url
                    }
                }
            } catch (e: any) {
            }
            task.chainController.errCounter++
            while (!task.chainController.finished
            && task.chainController.errCounter !== task.chainController.maxErrCount) {
                await sleep(500)
            }
        }, concurrencyLimit);
        const result = {hardhatNetwork: <HardhatNetwork>{}, warnings: ""};
        await Promise.all(
            (
                pickNetworks?.length
                    ? chains.filter(chain => pickNetworks.includes(chain.network))
                    : chains
            ).map(async (chain) => {
                const rpcs = chain.rpcs.filter(rpc => rpc.startsWith("https"));
                const chainController = {
                    finished: false,
                    errCounter: 0,
                    maxErrCount: rpcs.length,
                }
                const rpc = await Promise.race(
                    rpcs.map(((url) => {
                        return taskQueue.push<string | undefined>({
                            url,
                            timeout,
                            requestInit: ChainInspector.eth_blockNumber(),
                            chainController
                        });
                    }))
                );
                result.hardhatNetwork[chain.network] = {
                    chainId: chain.chainId,
                    url: rpc ?? chain.rpcs[0]
                }
                if (!rpc) {
                    result.warnings += `BAD NETWORK: ${chain.network}, using default: ${chain.rpcs[0]}\r\n`
                }
            })
        );
        return result;
    }


    // step 4
    // hardhatNetwork: function `parseHardhatNetwork` returned
    static parseEnv = (hardhatNetwork: HardhatNetwork) => {
        let envText = "PRIVATE_KEY = 0x0000000000000000000000000000000000000000000000000000000000000000\r\n"
        for (let network in hardhatNetwork) {
            envText += `ETHERSCAN_${network} = \r\n`
        }
        return envText
    }

    static write = async (output: string, obj: any, isPretty?: boolean) => {
        await createFile(output);
        if (typeof obj === "string") {
            await promisify(writeFile)(output, obj)
        } else {
            if (isPretty) {
                await promisify(writeFile)(output, JSON.stringify(obj, undefined, 2))
            } else {
                await promisify(writeFile)(output, JSON.stringify(obj))
            }
        }
    }

    private static eth_blockNumber() {
        return {
            method: "POST",
            headers: {"Content-Type": "application/json", "accept": "application/json"},
            body: JSON.stringify({
                "id": 1,
                "jsonrpc": "2.0",
                "method": "eth_blockNumber",
            })
        };
    }
}
