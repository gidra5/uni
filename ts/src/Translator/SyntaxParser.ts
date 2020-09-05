import { TokenDriver } from "./TokenDriver";
import { nodeParsers, TypesOf } from "./Tables";
import { DynamicEnum } from "../Utility/Helper";

export type Node = [type: number, tokenPos: number, ...extraInfo: any[]];
export type ParseTree = [node: Node, ...children: ParseTree[]];
export type ParseContextInfo = { driver: TokenDriver, parent?: ParseTree, parserParams?: any[] };
export type ParserInput = number | number[] | DynamicEnum;

export function parse(parseContext: ParseContextInfo, input: ParserInput = TypesOf.Nodes.Program):
    ParseTree | undefined {
    const failIfNoParser = true;
    const failIfNotParsed = true;
    const { driver, parent, parserParams } = parseContext;

    let parsed: ParseTree | undefined;
    if (typeof input === "number") {
        if (TypesOf.Tokens.values.includes(input)) {
            if (driver.currentToken[0] === input) {
                if (parserParams && driver.currentToken[1] !== parserParams[0]) {
                    if (failIfNotParsed) driver.error(`expected ${TypesOf[input]}[${parserParams[0]}]`);
                    return;
                }
                parsed = [[input, driver.currentTokenPos]];
                driver.nextToken();
            }
        } else {
            const parser = nodeParsers[input];

            if (!parser) {
                if (failIfNoParser) driver.error(`No parser for ${TypesOf[input]}`);
                else return parsed;
            }

            // const beginPos = driver.currentTokenPos;
            parsed = parser(driver, parserParams);

            if (!parsed) {
                if (failIfNotParsed) driver.error(`Incorrect syntax for ${TypesOf[input]}`);
                else parsed = [[TypesOf.Nodes.Code, driver.currentTokenPos]];

                //if failed return back tokenPos
                // driver.nextToken(beginPos - driver.currentTokenPos);
            }
        }
    } else if (input instanceof DynamicEnum) {
        parsed = parse(parseContext, input.values);
        if (!parsed) {
            const children = input.values.filter(v => v instanceof DynamicEnum);
            for (const child of children) {
                parsed = parse(parseContext, child);
                if (parsed) break;
            }
        }
    } else {
        if (input.length > 1) {
            try {
                return parse(parseContext, input.shift()!);
            } catch (err) {
                return parse(parseContext, input);
            }
        } else return parse(parseContext, input[0]);
    }

    if (parsed) {
        // parsed[1] = parent;
        parent?.push(parsed);
    }

    return parsed;
};