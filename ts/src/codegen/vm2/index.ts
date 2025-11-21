import { NodeType, Tree } from "../../ast.js";
import { assert } from "../../utils/index.js";
import { Instruction, InstructionCode, Program } from "../../vm2/instructions.js";

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
      case NodeType.PARENS:
        assert(node.children[0] !== undefined, "empty parentheses");
        this.emitNode(node.children[0]);
        break;
      case NodeType.NUMBER:
      case NodeType.STRING:
        this.current.push({ code: InstructionCode.Const, arg1: node.data.value });
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
      case NodeType.POW:
        this.emitBinaryChain(node.children, InstructionCode.Pow);
        break;
      case NodeType.EQUAL:
        this.emitBinaryChain(node.children, InstructionCode.Eq);
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
      case NodeType.NOT:
        assert(node.children[0] !== undefined, "negation missing operand");
        this.emitNode(node.children[0]);
        this.current.push({ code: InstructionCode.Not });
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
}
