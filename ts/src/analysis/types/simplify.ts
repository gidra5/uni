import { Iterator } from "iterator-js";
import { isSubtype, Type } from "./infer";
import { isTypeEqual } from "./utils";

export const simplify = (type: Type): Type => {
  if (typeof type === "string") return type;

  switch (true) {
    case "fn" in type: {
      const argType = simplify(type.fn.arg);
      const returnType = simplify(type.fn.return);
      const closure = type.fn.closure?.map(simplify);

      return { fn: { arg: argType, return: returnType, closure } };
    }
    case "and" in type: {
      const and = Iterator.iter(type.and)
        .map(simplify)
        .flatMap((type) => (typeof type === "object" && "and" in type ? type.and : [type]))
        .filter((type) => type !== "unknown")
        .unique(isTypeEqual)
        .toArray();

      if (and.includes("void")) return "void";
      // if there are two or more primitive types, then it is void (you can't be both int and float)
      if (and.filter((type) => typeof type === "string").length > 1) return "void";
      const negations = and.filter((type) => typeof type === "object" && "not" in type);

      for (const type of and) {
        if (negations.some((_type) => isTypeEqual(type, _type.not))) return "void";
      }

      // const copy = [...and];
      // for (const type of copy) {
      //   if (!(typeof type === "object" && "fn" in type)) continue;
      //   const index = copy.indexOf(type);

      //   for (const restType of copy.slice(index + 1)) {
      //     if (!(typeof restType === "object" && "fn" in restType)) continue;
      //     // if argument types are disjoint, then skip
      //     if (isSubtype({ and: [restType.fn.arg, type.fn.arg] }, "void")) continue;

      //     // TODO: do closures
      //     // if arg types have intersection, then replace this pair
      //     // with triplet of disjoint argument types with corresponding return types
      //     const firstArg: Type = { and: [restType.fn.arg, { not: type.fn.arg }] };
      //     const secondArg: Type = { and: [{ not: restType.fn.arg }, type.fn.arg] };
      //     const first: Type = { fn: { arg: firstArg, return: restType.fn.return, closure: restType.fn.closure } };
      //     const second: Type = { fn: { arg: secondArg, return: type.fn.return, closure: type.fn.closure } };
      //     const restIndex = copy.indexOf(restType);
      //     and.splice(index, 0);
      //     and.splice(restIndex, 1, simplify(first), simplify({ or: [type, restType] }), simplify(second));
      //   }
      // }

      return { and };
    }
    case "or" in type: {
      const or = Iterator.iter(type.or)
        .map(simplify)
        .flatMap((type) => (typeof type === "object" && "or" in type ? type.or : [type]))
        .filter((type) => type !== "void")
        .unique(isTypeEqual)
        .toArray();

      if (or.includes("unknown")) return "unknown";

      return { or };
    }
    case "not" in type: {
      const not = simplify(type.not);
      if (typeof not === "object" && "not" in not) {
        return simplify(not.not);
      }

      if (not === "void") return "unknown";
      if (not === "unknown") return "void";
      return { not };
    }
    default:
      return type;
  }
};
