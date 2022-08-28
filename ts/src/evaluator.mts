import { Registry, OperatorDefinition} from "./parser/types.mjs";
import { none } from "./types.mjs";

const notEvaluatable = () => () => {throw new Error("can't evaluate this operator");}

const registry = new Registry<OperatorDefinition>({
  parens: {
    separators: [{ token: { type: 'ident', item: "(" } }, { token: ",", optional: true, repeat: true }, { token: { type: 'ident', item: ")" } }],
  }
});

export { registry as operators }