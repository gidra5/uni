type Lambda =
  | { type: "var"; id: number }
  | { type: "app"; func: Term; arg: Term }
  | { type: "fn"; argType: Term; body: (term: Term) => Term }
  | { type: "type"; order: number }
  | { type: "fnType"; argType: Term; retType: (term: Term) => Term };
type Handlers =
  | { type: "inject"; id: number; handler: (term: Term, cont: Term) => Term; return: (term: Term) => Term }
  | { type: "handle"; id: number; value: Term };
type Process =
  | { type: "channel"; sender: (sender: Term) => Term; receiver: (receiver: Term) => Term }
  | { type: "send"; id: number; value: Term; rest: Term }
  | { type: "receive"; ids: number[] };
type Term = Lambda | Handlers | Process;

export {};
