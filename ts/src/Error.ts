import { currentCharLinePos, currentCharLine, src } from "./CodeDriver";
export const enum LoggingLevel {
    Warn, Error
}

let loggingLevel = LoggingLevel.Error;

export const setLoggingLevel = (level: LoggingLevel)  => loggingLevel = level;

export function Error(msg: string) {
    console.log(`Error at pos ${currentCharLinePos} line ${currentCharLine + 1}: ${msg}\n
        ${src.split("\n")[currentCharLine]}\n
        \u001b[${currentCharLinePos}C^`);
    process.exit();
};

export function Warning(msg: string) {
    if (loggingLevel > LoggingLevel.Warn) return;

    console.log(`Warning at pos ${currentCharLinePos} line ${currentCharLine + 1}: ${msg}\n
        ${src.split("\n")[currentCharLine]}\n
        \u001b[${currentCharLinePos}C^`);
}