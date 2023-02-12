export type Token = { id: string; src: string; span: [start: number, end: number] };
export type Operator = Separator[];
export type Separator = { tokenId: string; repeat: [min: number, max: number]; whitespace: boolean };

export type SeparatorOperand = ParsedOperator[];
export type SeparatorOperandRepeat = SeparatorOperand[];
export type ParsedOperator = Token | { operands: SeparatorOperandRepeat[]; operatorId: string };

export const ERROR_NO_SUCH_OPERATOR = 1;
export class ParserEngine {
  errors: { error: number; span: [number, number] }[] = [];
  constructor(
    private nextToken: (src: string) => [token: Token, rest: string],
    private operators: [id: string, operator: Operator][]
  ) {}

  separatorOperandRepeat(
    src: string,
    separator: Separator,
    separatorsRest: Separator[],
    callback: (breakingSeparatorIndex: number, separatorOperand: SeparatorOperand) => void,
    separatorOperandRepeat: SeparatorOperandRepeat = []
  ): [operands: SeparatorOperandRepeat, rest: string] {
    let separatorOperand: SeparatorOperand = [];

    while (true) {
      const [operand, rest] = this.nextOperator(src);
      src = rest;

      if ("id" in operand && separator.tokenId === operand.id) {
        separatorOperandRepeat.push(separatorOperand);

        if (separatorOperandRepeat.length < separator.repeat[1]) {
          separatorOperand = [];
          continue;
        } else break;
      }

      if (separatorOperandRepeat.length >= separator.repeat[0]) {
        const breakingSeparatorIndex = separatorsRest.findIndex(
          (separator) => "id" in operand && separator.tokenId === operand.id
        );

        if (breakingSeparatorIndex !== -1) {
          callback(breakingSeparatorIndex, separatorOperand);
          break;
        }
      }

      separatorOperand.push(operand);
    }

    return [separatorOperandRepeat, src];
  }

  operands(src: string, [...separators]: Operator): [operands: SeparatorOperandRepeat[], rest: string] {
    const operands: SeparatorOperandRepeat[] = [];
    let _separatorOperandRepeat: SeparatorOperandRepeat = [];

    while (separators.length > 0) {
      let called = false;
      const separator = separators.shift() as Separator;
      const [separatorOperandRepeat, rest] = this.separatorOperandRepeat(
        src,
        separator,
        separators,
        (index, operands) => {
          separators = separators.slice(index);
          _separatorOperandRepeat = [operands];
          called = true;
        },
        _separatorOperandRepeat
      );
      src = rest;

      if (!called) _separatorOperandRepeat = [];
      operands.push(separatorOperandRepeat);
    }

    return [operands, src];
  }

  nextOperator(src: string): [operator: ParsedOperator, rest: string] {
    const [token, rest] = this.nextToken(src);

    const operator = this.operators.find(([, separators]) => separators[0].tokenId === token.id);
    if (!operator) return [token, rest];

    const [operatorId, separators] = operator;

    separators.shift(); // consume first, since it was already matched

    const [operands, rest2] = this.operands(rest, separators);

    return [{ operands, operatorId }, rest2];
  }
}
