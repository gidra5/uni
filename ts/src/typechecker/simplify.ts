import { match } from "../parser/utils";
import { mapField } from "../utils";
import { and, unknown, placeholder } from "./type";
import { Type } from "./types";

export const simplifyType = (type: Type): Type => {
  console.dir({ msg: "simplifyType", type }, { depth: null });
  if (match(type, and(placeholder(), unknown()))[0]) return type.children[0];
  if (match(type, and(unknown(), placeholder()))[0]) return type.children[1];
  return mapField(["children"], (children) => children.map(simplifyType))(type);
};
