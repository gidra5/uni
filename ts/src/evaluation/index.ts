import { AbstractSyntaxTree } from "../parser/ast";
import { Scope } from "../scope.js";
import { isEqual, omitASTDataScope } from "../utils/index.js";

type SymbolValue = symbol;
type RecordValue = Map<Value, Value>;
type FunctionValue = (arg: Value) => Value;
type Value = number | string | boolean | null | FunctionValue | RecordValue | SymbolValue;
type Context = { scope: Scope<Value> };

export const initialContext = (): Context => ({ scope: new Scope<Value>() });

const atoms: Record<string, symbol> = {};

export const evaluate = (ast: AbstractSyntaxTree, context = initialContext()): Value => {
  console.dir(
    {
      msg: "evaluate",
      ast: omitASTDataScope(ast),
      context,
    },
    { depth: null }
  );

  switch (ast.name) {
    case "program":
      return evaluate(ast.children[0], context);
    case "operator": {
      switch (ast.value) {
        case "print": {
          const result = evaluate(ast.children[0], context);
          console.log(result);
          return result;
        }

        case "ref":
        case "deref":
        case "free":
        case "allocate": {
          throw new Error("Not implemented");
        }

        case "+": {
          return ast.children.reduce((acc, child) => acc + (evaluate(child, context) as number), 0);
        }
        case "*": {
          return ast.children.reduce((acc, child) => acc * (evaluate(child, context) as number), 1);
        }
        case "-": {
          return (evaluate(ast.children[0], context) as number) - (evaluate(ast.children[1], context) as number);
        }
        case "/": {
          return (evaluate(ast.children[0], context) as number) / (evaluate(ast.children[1], context) as number);
        }
        case "%": {
          return (evaluate(ast.children[0], context) as number) % (evaluate(ast.children[1], context) as number);
        }
        case "^": {
          return Math.pow(evaluate(ast.children[0], context) as number, evaluate(ast.children[1], context) as number);
        }

        case ",": {
          return new Map(
            ast.children.map((child, i) => {
              if (child.name === "label") {
                const key =
                  child.children[0].name === "name" ? child.children[0].value : evaluate(child.children[0], context);
                return [key, evaluate(child.children[1], context)];
              }
              return [i, evaluate(child, context)];
            })
          );
        }

        case "in": {
          return (evaluate(ast.children[0], context) as RecordValue).has(evaluate(ast.children[1], context));
        }

        case "and": {
          return ast.children.every((child) => evaluate(child, context) as boolean);
        }

        case "or": {
          return ast.children.some((child) => evaluate(child, context) as boolean);
        }

        case "==": {
          return evaluate(ast.children[0], context) === evaluate(ast.children[1], context);
        }

        case "!=": {
          return evaluate(ast.children[0], context) !== evaluate(ast.children[1], context);
        }

        case "===": {
          return isEqual(evaluate(ast.children[0], context), evaluate(ast.children[1], context));
        }

        case "!==": {
          return !isEqual(evaluate(ast.children[0], context), evaluate(ast.children[1], context));
        }

        case "!": {
          return !evaluate(ast.children[0], context);
        }

        case "<": {
          return (evaluate(ast.children[0], context) as number) < (evaluate(ast.children[1], context) as number);
        }

        case "<=": {
          return (evaluate(ast.children[0], context) as number) <= (evaluate(ast.children[1], context) as number);
        }

        case ">": {
          return (evaluate(ast.children[0], context) as number) > (evaluate(ast.children[1], context) as number);
        }

        case ">=": {
          return (evaluate(ast.children[0], context) as number) >= (evaluate(ast.children[1], context) as number);
        }

        case "fn": {
          const scope = context.scope;
          const name = ast.children[0].value;
          return (arg: Value) => {
            try {
              const boundScope = name !== undefined ? scope.add(name, arg) : scope.push(arg);
              return evaluate(ast.children[1], { scope: boundScope });
            } catch (error) {
              if (error instanceof ReturnError) {
                return error.value;
              }
              throw error;
            }
          };
        }

        case ";": {
          return ast.children.reduce<Value>((_, child) => evaluate(child, context), null);
        }

        case "#": {
          const relativeIndex = ast.children[0].value;
          return context.scope.getByRelativeIndex(relativeIndex)?.value ?? null;
        }

        case "match": {
          const value = evaluate(ast.children[0], context);
          const scope = context.scope;
          const cases = ast.children.slice(1);
          for (const caseAst of cases) {
            const [pattern, body] = caseAst.children;
            context.scope = scope;
            const match = evaluate(pattern, context);
            if (isEqual(value, match)) {
              return evaluate(body, context);
            }
          }
          context.scope = scope;
          return null;
        }

        case "if": {
          const scope = context.scope;
          const condition = evaluate(ast.children[0], context);
          if (condition) {
            const result = evaluate(ast.children[1], context);
            context.scope = scope;
            return result;
          }
          context.scope = scope;
          return null;
        }

        case "ifElse": {
          const scope = context.scope;
          const condition = evaluate(ast.children[0], context);
          if (condition) {
            const result = evaluate(ast.children[1], context);
            context.scope = scope;
            return result;
          }
          context.scope = scope;
          const result = evaluate(ast.children[2], context);
          context.scope = scope;
          return result;
        }

        case "loop": {
          const scope = context.scope;
          const values: Value[] = [];
          let i = 0;
          while (i < 100) {
            let value: Value;
            try {
              context.scope = scope;
              value = evaluate(ast.children[0], context);
              // console.log("loop result", result);

              if (value !== null) {
                values.push(value);
              }
            } catch (error) {
              if (!(error instanceof BreakError) && !(error instanceof ContinueError)) throw error;
              if (error.label !== undefined && error.label !== ast.data.label) {
                throw error;
              }

              const value = error.value;
              if (value !== null) {
                values.push(value);
              }

              if (error instanceof BreakError) break;
              if (error instanceof ContinueError) continue;
            }
            i++;
          }
          return new Map(values.entries());
        }

        case "break": {
          // console.dir(["break", omitASTDataScope(ast)], { depth: null });

          throw new BreakError(ast.data.label, evaluate(ast.children[0], context));
        }

        case "continue": {
          throw new ContinueError(ast.data.label, evaluate(ast.children[0], context));
        }

        case "return": {
          throw new ReturnError(evaluate(ast.children[0], context));
        }

        case "yield": {
          throw new YieldError(evaluate(ast.children[0], context));
        }

        case "pipe": {
          const value = evaluate(ast.children[0], context);
          const func = evaluate(ast.children[1], context) as FunctionValue;
          return func(value);
        }

        case "=": {
          const value = evaluate(ast.children[1], context);

          if (ast.children[0].name === "name") {
            const name = ast.children[0].value;
            const entryIndex = context.scope.toIndex({ name });
            const entry = context.scope.scope[entryIndex];
            if (entry !== undefined) {
              entry.value = value;
            }
          } else {
            const accessor = ast.children[0];
            const recordFieldNode = accessor.children[1];
            const record = evaluate(accessor.children[0], context) as RecordValue;
            const key = accessor.name === "access" ? recordFieldNode.value : evaluate(recordFieldNode, context);
            record?.set(key, value);
          }

          return value;
        }

        case ":=": {
          const name = ast.children[0].value;
          const value = evaluate(ast.children[1], context);
          context.scope = context.scope.add(name, value);
          return value;
        }

        case "atom": {
          const name = ast.children[0].value;
          if (!(name in atoms)) {
            atoms[name] = Symbol(name);
          }
          return atoms[name];
        }

        case "access": {
          const value = evaluate(ast.children[0], context) as RecordValue;
          const key = ast.children[1].value;
          return value.get(key) ?? null;
        }

        case "accessDynamic": {
          const value = evaluate(ast.children[0], context) as RecordValue;
          const key = evaluate(ast.children[1], context);
          return value.get(key) ?? null;
        }

        case "negate": {
          return -(evaluate(ast.children[0], context) as number);
        }

        case "application": {
          const func = evaluate(ast.children[0], context) as FunctionValue;
          return func(evaluate(ast.children[1], context));
        }

        case "parallel":
        case "send":
        case "receive":
        case "peekSend":
        case "peekReceive":
        case "channel":
        case "set":
        case "import":
        case "importWith":
        case "use":
        case "useWith":
        case "export":
        case "exportAs":
        case "external":

        // must be eliminated by that point
        case "inRange_<_<":
        case "inRange_<=_<":
        case "inRange_<_<=":
        case "inRange_<=_<=":
        case "inRange_>_>":
        case "inRange_>=_>":
        case "inRange_>_>=":
        case "inRange_>=_>=":
        case "inRange_<_>":
        case "inRange_<=_>":
        case "inRange_<_>=":
        case "inRange_<=_>=":
        case "inRange_>_<":
        case "inRange_>=_<":
        case "inRange_>_<=":
        case "inRange_>=_<=":
        case "async":
        case "await":
        case "is":
        case "as":
        case "mut":
        case "->":
        case "pin":
        case "...":
        case "matchColon":
        case "ifBlock":
        case "ifElseBlock":
        case "ifBlockElseBlock":
        case "forBlock":
        case "whileBlock":
        case "loopBlock":
        case "while":
        case "for":
        case "label":
        case "operator":
        case "operatorPrecedence":
        case "prefixDecrement":
        case "prefixIncrement":
        case "postfixDecrement":
        case "postfixIncrement":
        default:
          throw new Error(`Operator ${ast.value} not implemented`);
      }
    }
    case "group": {
      switch (ast.value) {
        case "true":
          return true;
        case "false":
          return false;
        case "symbol":
          return Symbol();
        case "parens": {
          return evaluate(ast.children[0], context);
        }
        case "braces": {
          const scope = context.scope;
          try {
            const result = evaluate(ast.children[0], context);
            context.scope = scope;
            return result;
          } catch (error) {
            context.scope = scope;
            if (error instanceof BreakError) {
              if (error.label !== undefined && error.label !== ast.data.label) {
                throw error;
              }
              return error.value;
            }
            throw error;
          }
        }
        case "brackets":
        default:
          return null;
      }
    }
    case "float":
    case "int": {
      return Number(ast.value);
    }
    case "string": {
      return String(ast.value);
    }
    case "placeholder":
      return null;
    case "name": {
      return context.scope.getByName(ast.value)?.value ?? null;
    }
    default:
      return null;
  }
};

class BreakError extends Error {
  constructor(public label?: string, public value: Value = null) {
    super("Break");
  }
}

class ContinueError extends Error {
  constructor(public label?: string, public value: Value = null) {
    super("Continue");
  }
}

class ReturnError extends Error {
  constructor(public value: Value = null) {
    super("Return");
  }
}

class YieldError extends Error {
  constructor(public value: Value = null) {
    super("Yield");
  }
}
