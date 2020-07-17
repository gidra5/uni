import { TextDriver } from "./TextDriver";
import { Error, Warning } from "./Error";
import { TokenDriver, Token } from "./TokenDriver";

export function or(el1: (driver: TextDriver) => any, el2: (driver: TextDriver) => any): (driver: TextDriver) => any {
    return (driver: TextDriver) => {
        try {
            return el1(driver);
        } catch (e) {
            return el2(driver);
        }
    };
}

export function assertStringAndMove(driver: TextDriver, str: string, err: string) {
    if (driver.nextString(str.length) !== str) Error(driver, err);
    driver.nextChar(str.length);
}

export function checkCurrToken(driver: TokenDriver, expected: Token, err: string): boolean {
    if (driver.currentToken !== expected) {
        Warning(driver, err);
        return false;
    }

    return true;
}