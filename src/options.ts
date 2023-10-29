import arg from "arg";
import Table from "cli-table";

export const enum CLI_ARG {
    NAME = "--name",
    DEBUG = "--debug",
    VERSION = "--version",
    HELP = "--help",
    DEFAULT = "_",
    INIT = "init",
    PATH = "path",
}

export const enum CLIArgAlias {
    NAME = "-n",
    VERSION = "-v",
    HELP = "-h",
}

export const CLI_ARGS_TYPE = {
    [CLI_ARG.NAME]: String,
    [CLI_ARG.DEBUG]: Boolean,
    [CLI_ARG.VERSION]: Boolean,
    [CLI_ARG.HELP]: Boolean,
    // Aliases
    [CLIArgAlias.NAME]: CLI_ARG.NAME,
    [CLIArgAlias.VERSION]: CLI_ARG.VERSION,
    [CLIArgAlias.HELP]: CLI_ARG.HELP,
};

export const isDebug = arg(CLI_ARGS_TYPE)[CLI_ARG.DEBUG]


export const CLI_INFO = () => {
    const table = new Table({
        head: ["Command", "Alias", "Description"],
        style: {
            head: new Array(3).fill("cyan"),
        },
    });

    let rows = [
        ["init", "", "init the current directory as project"],
        [CLI_ARG.NAME, CLIArgAlias.NAME, "File name to be used"],
        [CLI_ARG.VERSION, CLIArgAlias.VERSION, "Show the current version of the package"],
    ];

    table.push(...rows);

    return table.toString()
};
