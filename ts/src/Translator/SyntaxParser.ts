import { TokenDriver } from "./TokenDriver";
import { nodeParsers, TypesOf } from "./Tables";

// export type Literal = [type: number, val: any];
export type Node = [type: number, tokenPos: number, ...extraInfo: any[]];
export type ParseTree = [node: Node, parent: ParseTree | undefined, ...children: ParseTree[]];

export function parse(driver: TokenDriver, type: number | number[] = TypesOf.Nodes.Program, parent?: ParseTree,
    failIfNotParsed = true, failIfNoParser = true): boolean {

    let parsed;
    if (typeof type === "number") {
        console.log(TypesOf[type], TypesOf);

        if (TypesOf.Tokens.values.includes(type)) {
            if (driver.currentToken[0] === type) {
                parent?.push([[type, driver.currentTokenPos], parent])
                driver.nextToken();

                return true;
            }
            return false;
        }

        const parser = nodeParsers[type];

        if (!parser) {
            console.log(type, parent);
            if (failIfNoParser) driver.error(`No parser for ${TypesOf.Nodes[type]}`);
            else return false;
        }

        const beginPos = driver.currentTokenPos;
        parsed = parser(driver);

        if (!parsed) {
            if (failIfNotParsed) driver.error(`Incorrect syntax for ${TypesOf.Nodes[type]}`);
            else parsed = [[TypesOf.Nodes.Code, driver.currentTokenPos], parent];

            //if failed return back tokenPos
            driver.nextToken(beginPos - driver.currentTokenPos);
        }
    } else {
        console.log(type.map(v => TypesOf[v]));

        if (type.length > 1) {
            try {
                return parse(driver, type.shift()!, parent, failIfNotParsed, failIfNoParser);
            } catch (err) {
                return parse(driver, type, parent, failIfNotParsed, failIfNoParser);
            }
        } else return parse(driver, type[0], parent, failIfNotParsed, failIfNoParser);
    }

    parsed[1] = parent;
    parent?.push(parsed);

    return !!parsed;
};