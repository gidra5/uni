import { TextDriver } from "./TextDriver";

export let textDrivers;
export let srcOutFiles;

const commands = {
    ["in"]: (files: string[] | undefined) => { textDrivers = files?.map(file => new TextDriver(file)); },
    ["out"]: (files: string[] | undefined) => {
        if (files) srcOutFiles = files;
        else textDrivers?.forEach(td => td.src.split(".")[0] + ".code");
    }
}

export function translate(args: string[]) {
    const keys = Object.keys(commands);
    const parametersArgs = {};
    let currKey = "in";

    for (const arg of args) {
        if (arg.charAt(0) === "-") {
            currKey = arg.slice(1);
            continue;
        }

        if (parametersArgs[currKey])
            parametersArgs[currKey].push(arg);
        else parametersArgs[currKey] = [arg];
    }

    if (args.length === 0) {
        console.log("Enter filepath, pleeeease.");
        process.exit();
    }

    keys.forEach(key => commands[key](parametersArgs[key]));
}