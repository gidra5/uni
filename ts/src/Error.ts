import { TextDriver } from "./TextDriver";
import { TokenDriver } from "./TokenDriver";
export const enum LoggingLevel {
    Warn, Error
}

let loggingLevel = LoggingLevel.Error;

export const setLoggingLevel = (level: LoggingLevel)  => loggingLevel = level;

export function Error(driver: TextDriver | TokenDriver, msg: string) {
    if ((driver as TokenDriver).tokenized) {
        const tokenDriver = driver as TokenDriver;
        const currTknInfo = tokenDriver.tokenized[tokenDriver.currentTokenPos];
        console.log(`Error in file ${tokenDriver.file}
            at pos ${currTknInfo[1]}
            line ${currTknInfo[3] + 1}: ${msg}\n
            ${tokenDriver.src.split("\n")[currTknInfo[3]]}\n
            \u001b[${currTknInfo[4]}C^`);
    } else {
        const textDriver = driver as TextDriver;
        console.log(`Error in file ${textDriver.file}
            at pos ${textDriver.currentCharLinePos}
            line ${textDriver.currentCharLine + 1}: ${msg}\n
            ${textDriver.src.split("\n")[textDriver.currentCharLine]}\n
            \u001b[${textDriver.currentCharLinePos}C^`);
    }
    process.exit();
};

export function Warning(driver: TextDriver | TokenDriver, msg: string) {
    if (loggingLevel > LoggingLevel.Warn) return;

    if ((driver as TokenDriver).tokenized) {
        const tokenDriver = driver as TokenDriver;
        const currTknInfo = tokenDriver.tokenized[tokenDriver.currentTokenPos];
        console.log(`Error in file ${tokenDriver.file}
            at pos ${currTknInfo[1]}
            line ${currTknInfo[3] + 1}: ${msg}\n
            ${tokenDriver.src.split("\n")[currTknInfo[3]]}\n
            \u001b[${currTknInfo[4]}C^`);
    } else {
        const textDriver = driver as TextDriver;
        console.log(`Error in file ${textDriver.file}
            at pos ${textDriver.currentCharLinePos}
            line ${textDriver.currentCharLine + 1}: ${msg}\n
            ${textDriver.src.split("\n")[textDriver.currentCharLine]}\n
            \u001b[${textDriver.currentCharLinePos}C^`);
    }
}