import { TokenTypes } from "./TokenDriver";
import { LiteralTypes } from "./SyntaxParser";

type NodeType = TokenTypes | LiteralTypes;
type Node = [value: NodeType, semanticProcedure: () => void];

export type AST = [value: Node, ...children: AST[]];