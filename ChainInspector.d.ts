export type HardhatNetwork = {
    [network: string]: { chainId: number, url: string }
}

export type VerifyChain = {
    network: string
    chainId: number
    rpcs: string[]
}

export namespace Chain {
    export interface LlamaTvl {
        gecko_id: string
        tvl: number
        tokenSymbol: string
        cmcId: string
        name: string
        chainId: number
    }

    export interface ChainlistRPCs {
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

    export interface ChainlistChainIds {
        [chainId: string]: string
    }

    export interface Info {
        name: string
        chain: string
        icon: string
        rpc: {
            url: string
            tracking?: string
            trackingDetails?: string
            isOpenSource?: boolean
        }[]
        features: { name: string }[]
        faucets?: any[]
        nativeCurrency: {
            name: string
            symbol: string
            decimals: number
        }
        infoURL: string
        shortName: string
        chainId: number
        networkId: number
        slip44: number
        ens: { registry: string }
        explorers: {
            name: string
            url: string
            standard: string
            icon?: string
        }[]
        tvl?: number
        chainSlug?: string
    }
}
