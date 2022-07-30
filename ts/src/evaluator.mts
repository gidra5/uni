import { Registry, OperatorDefinition ,MAX_PRECEDENCE, Environment, Value, Record, OperatorRegistry} from "./parser/types.mjs";
import { none, some } from "./types.mjs";

const evaluate = (env: Environment, registry: OperatorRegistry) => {
  return { type: 'record', item: new Record() } as Value;
}

const notEvaluatable = () => () => {throw new Error("can't evaluate this operator");}

const registry = new Registry<OperatorDefinition>();
registry.register({
  precedence: [none(), none()],
  separators: [{ ident: "(" }, { token: ",", optional: true, repeat: true }, { ident: ")" }],
  type: () => ({ type: 'type', item: { type: 'nominal' } }),
  evaluate: (env) => (...items) => items.map()
});
registry.register({
  precedence: [none(), none()],
  separators: [{ ident: "{" }, { token: ["\n", ";"], optional: true, repeat: true }, { ident: "}" }],
  type: (...items) => ({ type: 'type', item: { type: 'unknown' } }),
  keepNewLine: true,
});
registry.register({
  precedence: [some(MAX_PRECEDENCE), some(0)],
  separators: [{ ident: "=" }],
  type: (left) => ({ type: 'type', item: { type: 'assignable', assignableType: '' } })
});
registry.register({
  precedence: [some(MAX_PRECEDENCE), some(0)],
  separators: [{ ident: ":=" }],
  type: (left) => ({ type: 'type', item: { type: 'define', pattern: { type: 'bind', item: 'bind' } } })
});
registry.register({
  precedence: [none(), some(MAX_PRECEDENCE)],
  separators: [{ ident: "ext" }],
  type: (right) => ({ type: 'type', item: { type: 'define', pattern: { type: 'bind', item: 'bind' } } }),
  evaluate: notEvaluatable
});
registry.register({
  precedence: [
    some(MAX_PRECEDENCE - 1),
    some(MAX_PRECEDENCE),
  ],
  separators: [{ ident: "." }],
});
registry.register({
  precedence: [some(1), some(2)],
  separators: [{ ident: "+" }],
});
registry.register({
  precedence: [none(), some(0)],
  separators: [{ ident: "[" }, { ident: "]" }, { ident: "->" }],
});
registry.register({
  precedence: [some(MAX_PRECEDENCE), none()],
  separators: [{ ident: "[" }, { ident: "]" }],
});
registry.register({
  precedence: [some(MAX_PRECEDENCE), some(0)],
  separators: [{ ident: "->" }],
});

export { registry as operators }