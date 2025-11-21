import { NodeType, Tree } from "../../ast.js";
import { assert } from "../../utils/index.js";
import { Instruction, InstructionCode, Program } from "../../vm/instructions.js";

export const generateVm2Bytecode = (ast: Tree): Program => {
  const generator = new Vm2Generator();
  return generator.generate(ast);
};

class Vm2Generator {
  private program: Program = { main: [] };
  private current: Instruction[] = this.program.main;

  generate(ast: Tree): Program {
    this.emitNode(ast);
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
      case NodeType.NAME: {
        const value = node.data.value;
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
        this.current.push({ code: InstructionCode.Const, arg1: { symbol: `atom:${node.data.name}`, name: node.data.name } });
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
      default:
        throw new Error(`vm2 codegen: unsupported node type "${node.type}"`);
    }
  }

  private emitApplication(node: Tree) {
    const [callee, ...args] = node.children;
    assert(callee !== undefined, "application missing callee");
    if (callee.type === NodeType.NAME) {
      args.forEach((arg) => this.emitNode(arg));
      this.current.push({ code: InstructionCode.Native, arg1: callee.data.value, arg2: args.length });
      return;
    }

    // generic call to a named function compiled elsewhere
    if (callee.type === NodeType.HASH_NAME) {
      args.forEach((arg) => this.emitNode(arg));
      this.current.push({ code: InstructionCode.Call, arg1: callee.data.value, arg2: args.length });
      return;
    }

    throw new Error(`vm2 codegen: unsupported callee type "${callee.type}"`);
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

    if (pattern.type === NodeType.NAME) {
      this.emitNode(value);
      this.current.push({ code: InstructionCode.Const, arg1: { ref: pattern.data.value } });
      this.current.push({ code: InstructionCode.Store });
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
}
