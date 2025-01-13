import { Iterator } from "iterator-js";
import { isSubtype, Type } from "./infer";
import { isTypeEqual } from "./utils";

export const simplify = (type: Type): Type => {
  if (typeof type === "string") return type;

  switch (true) {
    case "fn" in type: {
      const argType = simplify(type.fn.arg);
      const returnType = simplify(type.fn.return);
      const closure = type.fn.closure.map(simplify);

      return { fn: { arg: argType, return: returnType, closure } };
    }
    case "and" in type: {
      const and = Iterator.iter(type.and)
        .map(simplify)
        .flatMap((type) => (typeof type === "object" && "and" in type ? type.and : [type]))
        .filter((type) => type !== "unknown")
        .unique()
        .toArray();

      if (and.includes("void")) return "void";
      // if there are two or more primitive types, then it is void (you can't be both int and float)
      if (and.filter((type) => typeof type === "string").length > 1) return "void";
      const negations = and.filter((type) => typeof type === "object" && "not" in type);

      for (const type of and) {
        if (negations.some((_type) => isTypeEqual(type, _type.not))) return "void";
      }

      for (const type of and) {
        if (!(typeof type === "object" && "fn" in type)) continue;

        for (const restType of and) {
          if (restType === type) continue;
          if (!(typeof restType === "object" && "fn" in restType)) continue;
          // if argument types are disjoint, then skip
          if (isSubtype({ and: [restType.fn.arg, type.fn.arg] }, "void")) continue;

          // if arg types have intersection, then replace this pair
          // with triplet of disjoint argument types with corresponding return types
        }
      }

      return { and };
    }
    case "or" in type: {
      const or = Iterator.iter(type.or)
        .map(simplify)
        .flatMap((type) => (typeof type === "object" && "or" in type ? type.or : [type]))
        .filter((type) => type !== "void")
        .unique()
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
