export const enum LogLevels {
    Warn, Error
}

export let currLogLevel = LogLevels.Error;

export const setLogLevel = (level: LogLevels)  => currLogLevel = level;