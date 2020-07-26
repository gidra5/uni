import { TokenDriver, Token } from "./TokenDriver";

export enum LiteralTypes { String };
export enum NodeTypes { Program, Code, GrammarDecl, Group };

export type Literal = [type: LiteralTypes, val: any];
export type Node = [type: NodeTypes, tokenPos: number, ...extraInfo: any[]];
export type ParseTree =
    [node: Node, parent: ParseTree | undefined, ...children: ParseTree[]] |
    [literal: Literal, parent: ParseTree];

export function parse(driver: TokenDriver): ParseTree {
    const pt: ParseTree = [[NodeTypes.Program, 0], undefined];

    

    return pt;
}