/*
Grammar: terminals, nonTerminals, rules, sTerminal
terminals & nonTerminals = undefined;
rules: [...(terminals | nonTerminals)[], terminal, ...(terminals | nonTerminals)[]], (terminals | nonTerminals)[]
sTerminals extends terminals;
*/

import { AST } from "./AST";
import { specialChars, TextDriver } from "./TextDriver";
import { Token, EOTToken, TokenTypes } from "./TokenDriver";

const enum GrammarTypes { Unrestricted, ContextSensitive, ContextFree, Regular };

export type Rule = [ lhs: Token[], rhs: Token[] ];

export class Grammar {
    terminals: Set<Token> = new Set([EOTToken]);
    nonTerminals: Set<Token> = new Set([[TokenTypes.Name, "S"]]);
    rules: Rule[] = [];
    sNonTerminal: Token = this.nonTerminals.values()[0];
    type: GrammarTypes = GrammarTypes.Regular;

    constructor(terminals: Token[] = [], nonTerminals: Token[] = [], rules: Rule[] = [], sTerminal?: Token) {
        terminals.forEach(t => this.terminals.add(t));
        nonTerminals.forEach(t => this.nonTerminals.add(t));
        this.rules.push(...rules);
        this.sNonTerminal = sTerminal ?? this.sNonTerminal;

        for (const rule of this.rules) {
            if (this.type > GrammarTypes.ContextFree) {
                if (rule[0].length < 2) {
                    let n = 0;
                    while (this.terminals.has(rule[1][n]))
                        ++n;

                    if (this.nonTerminals.has(rule[1][n])) ++n;

                    if (n > 1 && this.terminals.has(rule[1][n]))
                        this.type = GrammarTypes.ContextFree;
                } else this.type = GrammarTypes.ContextSensitive;
            }
            if (this.type > GrammarTypes.Unrestricted) {
                const context: [left: Token[], right: Token[]] = [[], []];
                let subject: Token | undefined = undefined;
                const reversedRule = [rule[0].reverse(), rule[1].reverse()];

                for (let i = context[0].length; this.terminals.has(rule[0][i]); ++i)
                    context[0].push(rule[0][i]);

                for (let i = context[1].length; this.terminals.has(reversedRule[0][i]); ++i)
                    context[1].push(reversedRule[0][i]);

                if (context[0].length + context[1].length + 1 === rule[0].length) {
                    let i = 0;
                    for (; i < context[0].length; ++i)
                        if (context[0][i] !== rule[1][i]) break;

                    if (context[0].length !== i) this.type = GrammarTypes.Unrestricted;

                    i = 0;
                    for (; i < context[1].length; ++i)
                        if (context[1][i] !== reversedRule[1][i]) break;

                    if (context[1].length !== i) this.type = GrammarTypes.Unrestricted;
                } else {

                }
                if (this.type === GrammarTypes.Unrestricted)
                    break;
            }
        }
    }

    parser(): (driver: TextDriver) => AST | Rule[] {
        switch (this.type) {
            case GrammarTypes.Regular:
                return (driver: TextDriver) => {
                };
            case GrammarTypes.ContextFree:
                return (driver: TextDriver) => {
                };
            case GrammarTypes.ContextSensitive:
                return (driver: TextDriver) => {
                };
            case GrammarTypes.Unrestricted:
                return (driver: TextDriver) => {
                };
        }
    }
};