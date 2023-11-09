async function main() {
    // console.time("createNetworkAndEnv")
    // await createNetworkAndEnv()
    // console.timeEnd("createNetworkAndEnv")
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
