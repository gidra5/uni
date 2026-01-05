import { NodeType, Tree } from "../../ast.js";
import { desugar } from "../../analysis/desugar.js";
import { assert, nextId } from "../../utils/index.js";
import { Instruction, InstructionCode, Program } from "../../vm/instructions.js";

export const generateVm2Bytecode = (ast: Tree): Program => {
  const generator = new Vm2Generator();
  return generator.generate(ast);
};

class Vm2Generator {
  private program: Program = { main: [] };
  private current: Instruction[] = this.program.main;
  private functionNames = new Map<number, string>();
  private functionParamCounts = new Map<number, number>();
  private asyncFunctionNames = new Map<number, string>();
  private nativeNames = new Set(["print", "symbol", "alloc", "free"]);
  private loopStack: { breakJumps: number[]; continueTarget: number; resultRef: string }[] = [];
  private labelStack: { name: string; breakJumps: number[]; continueTarget: number; resultRef: string }[] = [];

  generate(ast: Tree): Program {
    const desugared = desugar(ast);
    this.emitNode(desugared);
    this.ensureReturn();
    return this.program;
  }

  private ensureReturn() {
    const last = this.current[this.current.length - 1];
    if (!last || last.code !== InstructionCode.Return) {
      this.current.push({ code: InstructionCode.Return });
    }
  }

  private emitNode(node: Tree): void {
    switch (node.type) {
      case NodeType.SCRIPT:
      case NodeType.BLOCK:
      case NodeType.SEQUENCE:
        node.children.forEach((child) => this.emitNode(child));
        break;
      case NodeType.FUNCTION: {
        const fnName = this.registerFunction(node);
        this.current.push({ code: InstructionCode.Closure, arg1: fnName });
        break;
      }
      case NodeType.ASYNC: {
        const target = node.children[0];
        assert(target, "async requires a target expression");
        const fnName = this.registerAsyncFunction(target);
        this.current.push({ code: InstructionCode.Closure, arg1: fnName });
        this.current.push({ code: InstructionCode.Fork });
        break;
      }
      case NodeType.AWAIT: {
        const target = node.children[0];
        assert(target, "await requires a target expression");
        this.emitNode(target);
        this.current.push({ code: InstructionCode.Join });
        break;
      }
      case NodeType.NAME: {
        const value = node.data.value;
        if (["break", "continue"].includes(value) && this.loopStack.length > 0) {
          if (value === "break") this.emitBreak([]);
          else this.emitContinue();
          break;
        }
        if (value === "true") {
          this.current.push({ code: InstructionCode.Const, arg1: true });
        } else if (value === "false") {
          this.current.push({ code: InstructionCode.Const, arg1: false });
        } else if (value === "null") {
          this.current.push({ code: InstructionCode.Const, arg1: null });
        } else {
          this.current.push({ code: InstructionCode.Const, arg1: { ref: value } });
          this.current.push({ code: InstructionCode.Load });
        }
        break;
      }
      case NodeType.PARENS:
        assert(node.children[0] !== undefined, "empty parentheses");
        this.emitNode(node.children[0]);
        break;
      case NodeType.NUMBER:
      case NodeType.STRING:
        this.current.push({ code: InstructionCode.Const, arg1: node.data.value });
        break;
      case NodeType.ATOM:
        this.current.push({
          code: InstructionCode.Const,
          arg1: { symbol: `atom:${node.data.name}`, name: node.data.name },
        });
        break;
      case NodeType.DEREF: {
        const target = node.children[0];
        assert(target, "deref missing target");
        this.emitNode(target);
        this.current.push({ code: InstructionCode.Load });
        break;
      }
      case NodeType.TEMPLATE:
        this.emitTemplate(node);
        break;
      case NodeType.PLUS:
        assert(node.children[0] !== undefined, "unary plus missing value");
        this.emitNode(node.children[0]);
        break;
      case NodeType.MINUS:
        assert(node.children[0] !== undefined, "unary minus missing value");
        this.emitNode(node.children[0]);
        this.current.push({ code: InstructionCode.Const, arg1: -1 });
        this.current.push({ code: InstructionCode.Mul });
        break;
      case NodeType.ADD:
        this.emitBinaryChain(node.children, InstructionCode.Add);
        break;
      case NodeType.SUB:
        this.emitBinaryChain(node.children, InstructionCode.Sub);
        break;
      case NodeType.MULT:
        this.emitBinaryChain(node.children, InstructionCode.Mul);
        break;
      case NodeType.DIV:
        this.emitBinaryChain(node.children, InstructionCode.Div);
        break;
      case NodeType.MOD:
        this.emitBinaryChain(node.children, InstructionCode.Mod);
        break;
      case NodeType.LESS:
        this.emitBinaryChain(node.children, InstructionCode.Lt);
        break;
      case NodeType.POW:
        this.emitBinaryChain(node.children, InstructionCode.Pow);
        break;
      case NodeType.EQUAL:
        this.emitBinaryChain(node.children, InstructionCode.Eq);
        break;
      case NodeType.DEEP_EQUAL:
        this.emitBinaryChain(node.children, InstructionCode.DeepEq);
        break;
      case NodeType.GREATER:
        this.emitBinaryChain(node.children, InstructionCode.Gt);
        break;
      case NodeType.AND:
        this.emitBinaryChain(node.children, InstructionCode.And);
        break;
      case NodeType.OR:
        this.emitBinaryChain(node.children, InstructionCode.Or);
        break;
      case NodeType.IN:
        this.emitBinaryChain(node.children, InstructionCode.In);
        break;
      case NodeType.NOT:
        assert(node.children[0] !== undefined, "negation missing operand");
        this.emitNode(node.children[0]);
        this.current.push({ code: InstructionCode.Not });
        break;
      case NodeType.IS:
        this.emitIs(node);
        break;
      case NodeType.INCREMENT:
        this.emitIncrement(node, { postfix: false });
        break;
      case NodeType.POST_INCREMENT:
        this.emitIncrement(node, { postfix: true });
        break;
      case NodeType.PIPE:
        this.emitPipe(node);
        break;
      case NodeType.IF:
      case NodeType.IF_ELSE:
        this.emitIf(node);
        break;
      case NodeType.LOOP:
        this.emitLoop(node);
        break;
      case NodeType.CODE_LABEL:
        this.emitLabel(node);
        break;
        break;
      case NodeType.TUPLE:
        this.emitTuple(node);
        break;
      case NodeType.RECORD:
        this.emitRecord(node);
        break;
      case NodeType.DECLARE:
      case NodeType.ASSIGN:
        this.emitAssignment(node);
        break;
      case NodeType.APPLICATION:
      case NodeType.DELIMITED_APPLICATION:
        this.emitApplication(node);
        break;
      case NodeType.IMPLICIT_PLACEHOLDER:
      case NodeType.PLACEHOLDER:
        this.current.push({ code: InstructionCode.Const, arg1: null });
        break;
      default:
        throw new Error(`vm2 codegen: unsupported node type "${node.type}"`);
    }
  }

  private emitApplication(node: Tree) {
    const { callee: unwrapped, args } = this.flattenApplication(node);
    const callee = this.unwrapParens(unwrapped);

    if (callee.type === NodeType.NAME && ["break", "continue"].includes(callee.data.value)) {
      if (callee.data.value === "break") this.emitBreak(args);
      else this.emitContinue();
      return;
    }

    if (callee.type === NodeType.NAME && callee.data.value === "return") {
      args.forEach((arg) => this.emitNode(arg));
      this.current.push({ code: InstructionCode.Return });
      return;
    }

    const labelControl = this.getLabelControl(callee);
    if (labelControl) {
      if (labelControl.kind === "break") {
        this.emitLabelBreak(labelControl.name, args);
      } else {
        this.emitLabelContinue(labelControl.name);
      }
      return;
    }

    if (callee.type === NodeType.NAME && this.emitBuiltin(callee.data.value, args)) return;

    if (callee.type === NodeType.NAME && this.nativeNames.has(callee.data.value)) {
      this.emitNativeCall(callee.data.value, args);
      return;
    }

    if (callee.type === NodeType.HASH_NAME) {
      args.forEach((arg) => this.emitNode(arg));
      this.current.push({ code: InstructionCode.Call, arg1: callee.data.value, arg2: args.length });
      return;
    }

    const paramCount = this.getParamCount(callee);
    const effectiveParamCount = paramCount ?? 1;
    if (args.length > effectiveParamCount) {
      const headArgs = args.slice(0, effectiveParamCount);
      const tailArgs = args.slice(effectiveParamCount);
      this.emitCall(callee, headArgs);
      tailArgs.forEach((arg) => this.emitCallOnStack([arg]));
      return;
    }

    this.emitCall(callee, args);
  }

  private emitPipe(node: Tree) {
    assert(node.children.length >= 2, "pipe requires at least two expressions");
    let acc = node.children[0];
    for (const stage of node.children.slice(1)) {
      acc = { type: NodeType.APPLICATION, id: nextId(), data: {}, children: [stage, acc] };
    }
    this.emitNode(acc);
  }

  private emitCall(callee: Tree, args: Tree[]) {
    const tempRef = this.tempRef();
    this.emitNode(callee);
    this.storeTopInTemp(tempRef);
    args.forEach((arg) => this.emitNode(arg));
    this.loadTemp(tempRef);
    this.current.push({ code: InstructionCode.Call, arg2: args.length });
  }

  private emitCallOnStack(args: Tree[]) {
    const tempRef = this.tempRef();
    this.storeTopInTemp(tempRef);
    args.forEach((arg) => this.emitNode(arg));
    this.loadTemp(tempRef);
    this.current.push({ code: InstructionCode.Call, arg2: args.length });
  }

  private getLabelControl(callee: Tree): { kind: "break" | "continue"; name: string } | null {
    if (callee.type !== NodeType.INDEX) return null;
    const [target, key] = callee.children;
    if (!target || !key || target.type !== NodeType.NAME || key.type !== NodeType.ATOM) return null;
    if (!["break", "continue"].includes(key.data.name)) return null;
    const labelCtx = this.findLabelContext(target.data.value);
    if (!labelCtx) return null;
    return { kind: key.data.name as "break" | "continue", name: target.data.value };
  }

  private findLabelContext(name: string) {
    for (let i = this.labelStack.length - 1; i >= 0; i--) {
      if (this.labelStack[i].name === name) return this.labelStack[i];
    }
    return null;
  }

  private emitLabelBreak(name: string, args: Tree[]) {
    const ctx = this.findLabelContext(name);
    assert(ctx, `vm2 codegen: 'break' used outside of label "${name}"`);
    if (args.length > 0) {
      this.emitNode(args[0]);
    } else {
      this.current.push({ code: InstructionCode.Const, arg1: null });
    }
    this.current.push({ code: InstructionCode.Const, arg1: { ref: ctx.resultRef } });
    this.current.push({ code: InstructionCode.Store });
    const jumpIndex = this.current.length;
    this.current.push({ code: InstructionCode.Jump, arg1: -1 });
    ctx.breakJumps.push(jumpIndex);
  }

  private emitLabelContinue(name: string) {
    const ctx = this.findLabelContext(name);
    assert(ctx, `vm2 codegen: 'continue' used outside of label "${name}"`);
    this.current.push({ code: InstructionCode.Jump, arg1: ctx.continueTarget });
  }

  private emitNativeCall(name: string, args: Tree[]) {
    args.forEach((arg) => this.emitNode(arg));
    this.current.push({ code: InstructionCode.Native, arg1: name, arg2: args.length });
  }

  private getParamCount(callee: Tree): number | null {
    if (callee.type === NodeType.FUNCTION) return this.extractParams(callee.children[0]).length;
    return null;
  }

  private emitBuiltin(name: string, args: Tree[]): boolean {
    switch (name) {
      case "length":
        assert(args.length === 1, "length expects 1 argument");
        this.emitNode(args[0]);
        this.current.push({ code: InstructionCode.Length });
        return true;
      case "index":
        assert(args.length === 2, "index expects 2 arguments");
        this.emitNode(args[0]);
        this.emitNode(args[1]);
        this.current.push({ code: InstructionCode.Index });
        return true;
      case "append": {
        assert(args.length === 2, "append expects 2 arguments");
        const tempRef = this.tempRef();
        // preserve evaluation order: first collection, then value
        this.emitNode(args[0]);
        this.storeTopInTemp(tempRef);
        this.emitNode(args[1]);
        this.loadTemp(tempRef);
        this.current.push({ code: InstructionCode.Append });
        return true;
      }
      default:
        return false;
    }
  }

  private flattenApplication(node: Tree): { callee: Tree; args: Tree[] } {
    const [callee, ...args] = node.children;
    assert(callee, "application missing callee");

    const unwrappedCallee = this.unwrapParens(callee);
    if (unwrappedCallee.type === NodeType.APPLICATION || unwrappedCallee.type === NodeType.DELIMITED_APPLICATION) {
      const inner = this.flattenApplication(unwrappedCallee);
      return { callee: inner.callee, args: [...inner.args, ...args] };
    }

    return { callee: unwrappedCallee, args };
  }

  private unwrapParens(node: Tree): Tree {
    if (node.type === NodeType.PARENS && node.children[0]) return node.children[0];
    return node;
  }

  private registerFunction(node: Tree): string {
    if (this.functionNames.has(node.id)) return this.functionNames.get(node.id)!;

    const fnName = `fn_${node.id}`;
    this.functionNames.set(node.id, fnName);

    const pattern = node.children[0];
    const body = node.children[node.children.length - 1];
    const params = this.extractParams(pattern);
    this.functionParamCounts.set(node.id, params.length);

    const prev = this.current;
    const fnBody: Instruction[] = [];
    this.program[fnName] = fnBody;
    this.current = fnBody;

    this.emitParamBindings(params);
    if (body) this.emitNode(body);
    this.ensureReturn();

    this.current = prev;

    return fnName;
  }

  private registerAsyncFunction(body: Tree): string {
    if (this.asyncFunctionNames.has(body.id)) return this.asyncFunctionNames.get(body.id)!;

    const fnName = `async_${body.id}`;
    this.asyncFunctionNames.set(body.id, fnName);

    const prev = this.current;
    const fnBody: Instruction[] = [];
    this.program[fnName] = fnBody;
    this.current = fnBody;

    this.emitNode(body);
    this.ensureReturn();

    this.current = prev;

    return fnName;
  }

  private extractParams(pattern: Tree): string[] {
    if (!pattern) return [];
    if (pattern.type === NodeType.TUPLE) {
      return pattern.children.map((child) => this.extractParamName(child));
    }
    if (pattern.type === NodeType.PLACEHOLDER || pattern.type === NodeType.IMPLICIT_PLACEHOLDER) return [];
    return [this.extractParamName(pattern)];
  }

  private extractParamName(node: Tree): string {
    if (node.type === NodeType.NAME) return node.data.value;
    throw new Error(`vm2 codegen: unsupported parameter pattern "${node.type}"`);
  }

  private emitParamBindings(params: string[]) {
    // bind from last to first to consume the stack in call order
    for (let i = params.length - 1; i >= 0; i--) {
      this.current.push({ code: InstructionCode.Const, arg1: { ref: params[i] } });
      this.current.push({ code: InstructionCode.Store });
    }
  }

  private emitBinaryChain(children: Tree[], opcode: InstructionCode) {
    assert(children.length > 0, "binary expression missing operands");
    this.emitNode(children[0]);
    for (const child of children.slice(1)) {
      this.emitNode(child);
      this.current.push({ code: opcode } as Instruction);
    }
  }

  private emitTuple(node: Tree) {
    if (node.children.length === 0) {
      this.current.push({ code: InstructionCode.Const, arg1: { tuple: [] } });
      return;
    }

    if (node.children.every((child) => child.type === NodeType.LABEL)) {
      node.children.forEach((entry) => this.emitRecordEntry(entry));
      this.current.push({ code: InstructionCode.Record, arg1: node.children.length });
      return;
    }

    node.children.forEach((child) => this.emitNode(child));
    this.current.push({ code: InstructionCode.Tuple, arg1: node.children.length });
  }

  private emitRecord(node: Tree) {
    const entries = node.children;
    if (entries.length === 0) {
      this.current.push({ code: InstructionCode.Const, arg1: { record: {} } });
      return;
    }
    entries.forEach((entry) => this.emitRecordEntry(entry));
    this.current.push({ code: InstructionCode.Record, arg1: entries.length });
  }

  private emitRecordEntry(entry: Tree) {
    if (entry.type !== NodeType.LABEL) throw new Error(`vm2 codegen: unsupported record entry "${entry.type}"`);

    const [key, value] = entry.children;
    assert(key, "record entry missing key");
    assert(value, "record entry missing value");
    this.emitRecordKey(key);
    this.emitNode(value);
  }

  private emitRecordKey(key: Tree) {
    if (key.type === NodeType.NAME) {
      this.current.push({
        code: InstructionCode.Const,
        arg1: { symbol: `atom:${key.data.value}`, name: key.data.value },
      });
      return;
    }
    if (key.type === NodeType.ATOM) {
      this.current.push({
        code: InstructionCode.Const,
        arg1: { symbol: `atom:${key.data.name}`, name: key.data.name },
      });
      return;
    }
    if (key.type === NodeType.SQUARE_BRACKETS) {
      assert(key.children[0], "record key missing computed expression");
      this.emitNode(key.children[0]);
      return;
    }

    throw new Error(`vm2 codegen: unsupported record key "${key.type}"`);
  }

  private emitAssignment(node: Tree) {
    const [pattern, value] = node.children;
    assert(pattern, "assignment missing pattern");
    assert(value, "assignment missing value");

    if (pattern.type === NodeType.MUTABLE) {
      assert(pattern.children[0], "mutable pattern missing name");
      this.emitAssignment({ ...node, children: [pattern.children[0], value] });
      return;
    }

    if (pattern.type === NodeType.NAME) {
      this.emitNode(value);
      this.current.push({ code: InstructionCode.Const, arg1: { ref: pattern.data.value } });
      this.current.push({ code: InstructionCode.Store });
      this.current.push({ code: InstructionCode.Const, arg1: { ref: pattern.data.value } });
      this.current.push({ code: InstructionCode.Load });
      return;
    }

    throw new Error(`vm2 codegen: unsupported assignment pattern "${pattern.type}"`);
  }

  private emitTemplate(node: Tree) {
    assert(node.children.length > 0, "template missing parts");
    this.emitNode(node.children[0]);
    for (const child of node.children.slice(1)) {
      this.emitNode(child);
      this.current.push({ code: InstructionCode.Concat });
    }
  }

  private emitIf(node: Tree) {
    const [condition, thenBranch, elseBranch] = node.children;
    assert(condition && thenBranch, "if missing branches");

    this.emitNode(condition);
    const jumpIfFalseIndex = this.current.length;
    this.current.push({ code: InstructionCode.JumpIfFalse, arg1: -1 });

    this.emitNode(thenBranch);

    if (elseBranch) {
      const jumpOverElseIndex = this.current.length;
      this.current.push({ code: InstructionCode.Jump, arg1: -1 });
      this.setJumpTarget(jumpIfFalseIndex, this.current.length);
      this.emitNode(elseBranch);
      this.setJumpTarget(jumpOverElseIndex, this.current.length);
    } else {
      this.setJumpTarget(jumpIfFalseIndex, this.current.length);
    }
  }

  private emitLabel(node: Tree) {
    const body = node.children[0];
    assert(body, "label requires body");

    const resultRef = this.tempRef();
    this.current.push({ code: InstructionCode.Const, arg1: null });
    this.current.push({ code: InstructionCode.Const, arg1: { ref: resultRef } });
    this.current.push({ code: InstructionCode.Store });

    const start = this.current.length;
    const ctx = { name: node.data.name as string, breakJumps: [], continueTarget: start, resultRef };
    this.labelStack.push(ctx);

    this.emitNode(body);
    this.current.push({ code: InstructionCode.Const, arg1: { ref: resultRef } });
    this.current.push({ code: InstructionCode.Store });

    const endIndex = this.current.length;
    this.labelStack.pop();
    ctx.breakJumps.forEach((index) => this.setJumpTarget(index, endIndex));

    this.current.push({ code: InstructionCode.Const, arg1: { ref: resultRef } });
    this.current.push({ code: InstructionCode.Load });
  }

  private emitIs(node: Tree) {
    const [valueNode, pattern] = node.children;
    assert(valueNode && pattern, "is requires value and pattern");

    const valueRef = this.tempRef();
    this.emitNode(valueNode);
    this.current.push({ code: InstructionCode.Const, arg1: { ref: valueRef } });
    this.current.push({ code: InstructionCode.Store });

    this.emitPatternMatch(pattern, valueRef);
  }

  private emitPatternMatch(pattern: Tree, valueRef: string) {
    switch (pattern.type) {
      case NodeType.NAME: {
        this.current.push({ code: InstructionCode.Const, arg1: { ref: valueRef } });
        this.current.push({ code: InstructionCode.Load });
        this.current.push({ code: InstructionCode.Const, arg1: { ref: pattern.data.value } });
        this.current.push({ code: InstructionCode.Store });
        this.current.push({ code: InstructionCode.Const, arg1: true });
        break;
      }
      case NodeType.PLACEHOLDER:
      case NodeType.IMPLICIT_PLACEHOLDER:
        this.current.push({ code: InstructionCode.Const, arg1: true });
        break;
      case NodeType.NOT: {
        const target = pattern.children[0];
        assert(target, "not pattern missing operand");
        this.emitPatternMatch(target, valueRef);
        this.current.push({ code: InstructionCode.Not });
        break;
      }
      case NodeType.NUMBER:
      case NodeType.STRING: {
        this.current.push({ code: InstructionCode.Const, arg1: { ref: valueRef } });
        this.current.push({ code: InstructionCode.Load });
        this.current.push({ code: InstructionCode.Const, arg1: pattern.data.value });
        this.current.push({ code: InstructionCode.Eq });
        break;
      }
      case NodeType.ATOM: {
        this.current.push({ code: InstructionCode.Const, arg1: { ref: valueRef } });
        this.current.push({ code: InstructionCode.Load });
        this.current.push({
          code: InstructionCode.Const,
          arg1: { symbol: `atom:${pattern.data.name}`, name: pattern.data.name },
        });
        this.current.push({ code: InstructionCode.Eq });
        break;
      }
      default:
        throw new Error(`vm2 codegen: unsupported pattern "${pattern.type}" in "is" expression`);
    }
  }

  private tempRef() {
    return `_calltmp_${nextId()}`;
  }

  private storeTopInTemp(ref: string) {
    this.current.push({ code: InstructionCode.Const, arg1: { ref } });
    this.current.push({ code: InstructionCode.Store });
  }

  private loadTemp(ref: string) {
    this.current.push({ code: InstructionCode.Const, arg1: { ref } });
    this.current.push({ code: InstructionCode.Load });
  }

  private setJumpTarget(index: number, target: number) {
    const instr = this.current[index];
    assert(
      instr.code === InstructionCode.Jump || instr.code === InstructionCode.JumpIfFalse,
      "vm2 codegen: expected jump instruction"
    );
    (instr as Extract<Instruction, { arg1: number }>).arg1 = target;
  }

  private emitIncrement(node: Tree, { postfix }: { postfix: boolean }) {
    const target = node.children[0];
    assert(target && target.type === NodeType.NAME, "increment expects name");
    const name = target.data.value;
    const temp = this.tempRef();

    // store old value in temp
    this.current.push({ code: InstructionCode.Const, arg1: { ref: name } });
    this.current.push({ code: InstructionCode.Load });
    this.current.push({ code: InstructionCode.Const, arg1: { ref: temp } });
    this.current.push({ code: InstructionCode.Store });

    // compute new value
    this.current.push({ code: InstructionCode.Const, arg1: { ref: temp } });
    this.current.push({ code: InstructionCode.Load });
    this.current.push({ code: InstructionCode.Const, arg1: 1 });
    this.current.push({ code: InstructionCode.Add });

    this.current.push({ code: InstructionCode.Const, arg1: { ref: name } });
    this.current.push({ code: InstructionCode.Store });

    // push result: postfix returns old, prefix returns new
    this.current.push({ code: InstructionCode.Const, arg1: { ref: postfix ? temp : name } });
    this.current.push({ code: InstructionCode.Load });
  }

  private currentLoop() {
    return this.loopStack[this.loopStack.length - 1];
  }

  private emitBreak(args: Tree[]) {
    const loop = this.currentLoop();
    assert(loop, "vm2 codegen: 'break' used outside of loop");
    if (args.length > 0) {
      this.emitNode(args[0]);
    } else {
      this.current.push({ code: InstructionCode.Const, arg1: null });
    }
    this.current.push({ code: InstructionCode.Const, arg1: { ref: loop.resultRef } });
    this.current.push({ code: InstructionCode.Store });
    const jumpIndex = this.current.length;
    this.current.push({ code: InstructionCode.Jump, arg1: -1 });
    loop.breakJumps.push(jumpIndex);
  }

  private emitContinue() {
    const loop = this.currentLoop();
    assert(loop, "vm2 codegen: 'continue' used outside of loop");
    this.current.push({ code: InstructionCode.Jump, arg1: loop.continueTarget });
  }

  private emitLoop(node: Tree) {
    const [body] = node.children;
    assert(body, "loop requires body");

    const resultRef = this.tempRef();
    this.current.push({ code: InstructionCode.Const, arg1: null });
    this.current.push({ code: InstructionCode.Const, arg1: { ref: resultRef } });
    this.current.push({ code: InstructionCode.Store });

    const loopStart = this.current.length;
    const ctx = { continueTarget: loopStart, resultRef };
    this.loopStack.push({ breakJumps: [], ...ctx });

    this.emitNode(body);
    this.current.push({ code: InstructionCode.Jump, arg1: loopStart });

    const endIndex = this.current.length;
    const loopCtx = this.loopStack.pop()!;
    loopCtx.breakJumps.forEach((index) => {
      this.setJumpTarget(index, endIndex);
    });

    this.current.push({ code: InstructionCode.Const, arg1: { ref: resultRef } });
    this.current.push({ code: InstructionCode.Load });
  }
}
