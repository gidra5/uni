// import { Program } from "./parser/types.mjs";
// import { TaggedItemUnion } from "./types.js";

// export class Record {
//   constructor(private values: { name: Value; value: Value }[] = []) {}

//   static fromArray(values: Value[]) {
//     return new Record(
//       values.map((value, index) => ({
//         value,
//         name: { type: "number", item: index },
//       }))
//     );
//   }

//   append(value: Value, _name?: Value) {
//     if (_name) this.values = this.values.filter(({ name }) => name === _name);
//     this.values.push({
//       value,
//       name: _name ?? { type: "number", item: this.values.length },
//     });
//   }
//   set(_value: Value, _name: Value) {
//     this.values = this.values.map(({ name, value }) => ({
//       name,
//       value: name === _name ? _value : value,
//     }));
//   }
// }

// export type Value = TaggedItemUnion<{
//   // string: string;
//   // char: string;
//   number: number;
//   // boolean: boolean;
//   // record: Record;
//   // function: {
//   //   env: Environment;
//   //   registry: OperatorRegistry;
//   //   body: Expression;
//   //   pattern: Pattern;
//   // };
// }>;

// export type Environment = { [x in string]: Value };

// export const evaluate = (program: Program): Value => {
//   return { type: "number", item: 0 };
// };
