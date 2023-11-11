import {createChains, createNetworkWithEnv} from "../src/rpc.ts.bk";

async function main() {
    console.time("createNetworkAndEnv")
    await createChains()
    console.timeEnd("createNetworkAndEnv")
    // await createChains()
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
