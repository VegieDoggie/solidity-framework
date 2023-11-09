import {ethers, Network} from "ethers";
import logger from "../template/scripts/libraries/logger";
import path from "path";
import {createFile, writeFile} from "fs-extra";
import {promisify} from "util";
import {builtinChains} from "@nomicfoundation/hardhat-verify/internal/chain-config";
import localRpcs from "../chainlist/constants/extraRpcs";
import localChainIds from "../chainlist/constants/chainIds.json";

export async function createNetworkWithEnv(outputDir = "../template", withEnv?: boolean, timeout = 30000) {
    const hardhatNetwork = await buildHardhatNetwork(timeout)

    // save hardhat.network.json
    const out1 = path.join(outputDir, "hardhat.network.json")
    await createFile(out1);
    await promisify(writeFile)(out1, JSON.stringify(hardhatNetwork, undefined, 2))

    // save .env.example
    if (withEnv) {
        let exampleEnv = "PRIVATE_KEY = 0x0000000000000000000000000000000000000000000000000000000000000000\r\n"
        for (let network in hardhatNetwork) {
            exampleEnv += `ETHERSCAN_${network} = \r\n`
        }
        const out2 = path.join(outputDir, ".env.example")
        const out3 = path.join(outputDir, ".env")
        await createFile(out2);
        await createFile(out3);
        await Promise.all([
            promisify(writeFile)(out2, exampleEnv),
            promisify(writeFile)(out3, exampleEnv)
        ])
    }
}

export async function createChainInfos(output = "../dist/n-chains.json") {
    const chainInfos = await buildChainInfos();
    await createFile(output);
    // await promisify(writeFile)(output, JSON.stringify(chainInfos, undefined, 2))
    await promisify(writeFile)(output, JSON.stringify(chainInfos))
}

// 基于网络链信息和校验默认配置构造合约校验对象
export async function buildHardhatNetwork(timeout = 30000) {
    const iChains = await buildChainInfos()
    const vChains = builtinChains.reduce((pre, cur) => {
        return pre.set(cur.chainId, cur.network)
    }, new Map<number, string>());
    const chains = iChains.reduce((pre, cur) => {
        if (!vChains.has(cur.chainId)) return pre;
        if (!cur.rpc?.length) return pre;
        const rpcList = cur.rpc.filter(rpc => rpc.url.startsWith("https")).map(rpc => rpc.url);
        pre.push({
            network: vChains.get(cur.chainId)!,
            chainId: cur.chainId,
            rpcs: rpcList

        });
        return pre
    }, [] as VerifyChain[]);

    const hardhatNetwork: HardhatNetwork = {}
    await Promise.all(chains.map(async (chain) => {
        let failed = 0;
        let network = new Network(chain.network, chain.chainId)
        let rpc = await Promise.race([
            ...chain.rpcs.map(async (rpc) => {
                try {
                    const provider = new ethers.JsonRpcProvider(rpc, undefined, {staticNetwork: network})
                    await provider.getBlockNumber()
                    return rpc
                } catch (e) {
                    failed++
                    await new Promise(resolve => setTimeout(resolve, timeout))
                }
            }),
            // 如果全部卡住，则最长3秒
            (async () => {
                await new Promise(resolve => setTimeout(resolve, timeout))
            })(),
            // 如果全部失败，则终止等待
            (async () => {
                while (true) {
                    if (failed == chain.rpcs.length) break
                    await new Promise(resolve => setTimeout(resolve, 50))
                }
            })(),
        ]);
        // logger.success(chain.network, chain.chainId, rpc)
        hardhatNetwork[chain.network] = {
            chainId: chain.chainId,
            url: rpc ?? chain.rpcs[0]
        }
    }))
    return hardhatNetwork
}

// 拉取网络链信息
export async function buildChainInfos() {
    const chainInfos: ChainData.Info[] = await (await fetch("https://chainid.network/chains.json")).json();
    const llamaTvls = (await (await fetch("https://api.llama.fi/chains")).json() as ChainData.LlamaTvl[])
        .reduce((pre, cur) => {
            return pre.set(cur.name.toLowerCase(), cur.tvl)
        }, new Map<string, number>());
    return chainInfos
        .map((chain) => combine(chain, llamaTvls, localRpcs, localChainIds))
        .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0));
}

function combine(chainInfo: ChainData.Info, llamaTvls: Map<string, number>, localRpcs: ChainData.LocalRPCs, localChainIds: ChainData.LocalChainIds) {
    chainInfo.rpc = distinct([
        ...chainInfo.rpc?.map(unslashAndWrap) ?? [],
        ...localRpcs[chainInfo.chainId]?.rpcs?.map(unslashAndWrap) ?? []
    ]);
    const chainSlug = localChainIds[chainInfo.chainId];
    return !llamaTvls.has(chainSlug)
        ? chainInfo
        : {
            ...chainInfo,
            tvl: llamaTvls.get(chainSlug),
            chainSlug,
        };
}

function distinct(rpcs: { url: string }[]) {
    const res = []
    const set = new Set()
    for (let rpc of rpcs) {
        if (set.has(rpc.url)) continue
        if (rpc.url.includes("${INFURA_API_KEY}")) continue
        if (rpc.url.includes("${ALCHEMY_API_KEY}")) continue
        set.add(rpc.url)
        res.push(rpc)
    }
    return res
}

function unslashAndWrap(rpc: string | { url: string }): { url: string } {
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


type VerifyChain = {
    network: string
    chainId: number
    rpcs: string[]
}

type HardhatNetwork = {
    [network: string]: { chainId: number, url: string }
}

// fetch from network and local backup
namespace ChainData {
    export interface Info {
        name: string
        chain: string
        icon: string
        rpc: RPC[]
        features: FeatureVersion[]
        faucets: any[]
        nativeCurrency: NativeCurrency
        infoURL: string
        shortName: string
        chainId: number
        networkId: number
        slip44: number
        ens: Ens
        explorers: Explorer[]
        tvl: number
        chainSlug: string
    }

    export interface LlamaTvl {
        gecko_id: string
        tvl: number
        tokenSymbol: string
        cmcId: string
        name: string
        chainId: number
    }

    export interface LocalRPCs {
        [chainId: string]: {
            name?: string
            rpcs: {
                url: string
                tracking: string
                trackingDetails?: string
                isOpenSource?: boolean
            }[]
        }
    }

    export interface LocalChainIds {
        [chainId: string]: string
    }

    interface RPC {
        url: string
        tracking?: string
        trackingDetails?: string
        isOpenSource?: boolean
    }

    interface FeatureVersion {
        name: string
    }

    interface NativeCurrency {
        name: string
        symbol: string
        decimals: number
    }

    interface Ens {
        registry: string
    }

    interface Explorer {
        name: string
        url: string
        standard: string
        icon?: string
    }

}

