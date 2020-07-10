import { Grammar } from "./Grammar";
import { letter, digit } from "./Scanner";
export const grammars: Map<string, Grammar> = new Map();

grammars.set("identifier", new Grammar([letter(), digit()], ["L"], [
    [["S"], [letter(), "L"]],
    [["L"], [digit(), "L"]],
    [["L"], [letter(), "L"]]
]));
// grammars.set("", new Grammar());