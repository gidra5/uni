// import { err, ok, Result, none } from "../types.js";
// import {
//   isOperator,
//   Operator,
//   OperatorRegistry,
//   Precedence,
//   Error,
// } from "./types.mjs";

// export const transpose = <T>(x: Result<T, Error>[]): [T[], Error[]] => {
//   const operands = [] as T[];
//   const errors = [] as Error[];

//   for (const it of x) {
//     if (it.type === "err") errors.push(it.err);
//     else operands.push(it.value);
//   }

//   return [operands, errors];
// };

// export const DEFAULT_PRECEDENCE = [none(), none()] as Precedence;
// /**
//  *
//  * @param operatorRegistry
//  * @returns left is `less\greater` to right
//  */
// export const compareOperators =
//   (operatorRegistry: OperatorRegistry) =>
//   (left?: Operator, right?: Operator): boolean => {
//     if (isOperator(left)) console.log("c3", operatorRegistry.get(left.item));
//     if (isOperator(right)) console.log("c4", operatorRegistry.get(right.item));

//     const [, _leftBP] = isOperator(left)
//       ? operatorRegistry.get(left.item).precedence ?? DEFAULT_PRECEDENCE
//       : DEFAULT_PRECEDENCE;
//     const [_rightBP] = isOperator(right)
//       ? operatorRegistry.get(right.item).precedence ?? DEFAULT_PRECEDENCE
//       : DEFAULT_PRECEDENCE;

//     if (_rightBP.type === "none") return false;
//     if (_leftBP.type === "none") return true;

//     return _leftBP.value < _rightBP.value;
//   };
