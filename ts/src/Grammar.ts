/*
Grammar: terminals, nonTerminals, rules, sTerminal
terminals & nonTerminals = undefined;
rules: (terminals, nonTerminals)[], (terminals, nonTerminals)[]
sTerminals extends terminals;
*/

export enum TokenType { None, Keyword, Identifier, Separator, Literal, Comment };
const enum GrammarTypes { Unrestricted, ContextSensitive, ContextFree, Regular };

export type Token = [type: TokenType, value: any] | RegExp | string;
type NotTerminal = [TokenType.Identifier, string];

export type Rule = [ l: Token[], r: Token[] ];
type UnrestrictedRule = Rule;
type ContextSensativeRule = UnrestrictedRule;
type ContextFreeRule = ContextSensativeRule & { l: Token[] & { length: 1 } };
type RegularRule = ContextFreeRule;

export class Grammar {
    terminals: Set<Token> = new Set([""]);
    nonTerminals: Set<Token> = new Set([[TokenType.Identifier, "S"]]);
    rules: Rule[] = [];
    sTerminal: Token = this.nonTerminals[0];
    type: GrammarTypes = GrammarTypes.Regular;

    constructor(terminals?: Token[] = [], nonTerminals?: Token[] = [], rules?: Rule[] = [], sTerminal?: Token) {
        terminals.forEach(t => this.terminals.add(t));
        nonTerminals.forEach(t => this.nonTerminals.add(t));
        this.rules.push(...rules);
        this.sTerminal ??= sTerminal;

        for (const rule of this.rules) {
            if (this.type > GrammarTypes.ContextFree) {
                if (rule.l.length < 2) {
                    let n = 0;
                    while (this.terminals.has(rule.r[n]))
                        ++n;

                    if (this.nonTerminals.has(rule.r[n])) ++n;

                    if (n > 1 && this.terminals.has(rule.r[n]))
                        this.type = GrammarTypes.ContextFree;
                } else this.type = GrammarTypes.ContextSensitive;
            }
            if (this.type > GrammarTypes.Unrestricted) {
                const context: [left: Token[], right: Token[]] = [[], []];
                let subject: Token | undefined = undefined;
                const reversedRule = [rule.l.reverse(), rule.r.reverse()];

                for (let i = context.left.length; this.terminals.has(rule.l[i]); ++i)
                    context.left.push(rule.l[i]);

                for (let i = context.right.length; this.terminals.has(rule.l.reverse()[i]); ++i)
                    context.right.push(rule.l.reverse()[i]);

                if (context.left.length + context.right.length + 1 === rule.l.length) {
                    let i = 0;
                    for (; i < context.left.length; ++i)
                        if (context.left[i] !== rule.r[i]) break;

                    if (context.left.length !== i) this.type = GrammarTypes.Unrestricted;

                    i = 0;
                    for (; i < context.right.length; ++i)
                        if (context.right[i] !== rule.r.reverse()[i]) break;

                    if (context.right.length !== i) this.type = GrammarTypes.Unrestricted;
                } else {

                }
                if (this.type === GrammarTypes.Unrestricted)
                    break;
            }
        }
    }

    parser(): ((src: string) => (step?: number) => string) {
        let currentCharPos = 0;
        let currentCharLine = 0;
        let currentCharLinePos = 0;
        const body = (src: string) => {
            let currentChar = src.charAt(currentCharPos);
            return (step?: number = 1) => {
                currentCharPos += step;
                currentCharLinePos += step;
                currentChar = src.charAt(currentCharPos);

                if (src.substring(currentCharPos, currentCharPos + step).includes("\n")) {
                    ++currentCharLine;
                    currentCharLinePos = 0;
                }

                return currentChar;
            }
        };

        switch (this.type) {
            case GrammarTypes.Regular:
                return (src: string) => {

                    return body(src);
                }
            case GrammarTypes.ContextFree:
                return (src: string) => {

                    return body(src);
                }
            case GrammarTypes.ContextSensitive:
                return (src: string) => {

                    return body(src);
                }
            case GrammarTypes.Unrestricted:
                return (src: string) => {

                    return body(src);
                }
        }
    }
};