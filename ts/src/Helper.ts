import { TextDriver } from "./TextDriver";
import { TokenDriver } from "./TokenDriver";

export function or(el1: (driver: TextDriver | TokenDriver) => any, el2: (driver: TextDriver | TokenDriver) => any): (driver: TextDriver | TokenDriver) => any {
    return (driver: TextDriver | TokenDriver) => {
        try {
            return el1(driver);
        } catch (e) {
            return el2(driver);
        }
    };
}