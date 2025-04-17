import { Tree } from "../ast";
import { SystemError } from "../error";
import { TokenGroup, ValidatedTokenGroup } from "../parser/tokenGroups";

const validateTokenGroup = (token: TokenGroup): [SystemError[], ValidatedTokenGroup[]] => {
  const errors: SystemError[] = [];

  switch (token.type) {
    case "error": {
      errors.push(token.cause);
      if (!token.token) return [errors, []];

      const [errors2, validatedToken] = validateTokenGroup(token.token);
      errors.push(...errors2);
      return [errors, validatedToken];
    }
    case "group": {
      const [errors2, validatedTokens] = validateTokenGroups(token.tokens);
      errors.push(...errors2);
      return [errors, [{ ...token, tokens: validatedTokens }]];
    }
    default:
      return [errors, [token as ValidatedTokenGroup]];
  }
};

export const validateTokenGroups = (tokens: TokenGroup[]) => {
  return tokens.map(validateTokenGroup).reduce<[SystemError[], ValidatedTokenGroup[]]>(
    ([errors, validated], [errors2, validated2]) => [
      [...errors, ...errors2],
      [...validated, ...validated2],
    ],
    [[], []]
  );
};

const validateChildren = (children: Tree[]) => {
  return children.map(validate).reduce<[SystemError[], Tree[]]>(
    ([errors, validated], [errors2, validated2]) => [
      [...errors, ...errors2],
      [...validated, validated2],
    ],
    [[], []]
  );
};

export const validate = (ast: Tree): [SystemError[], Tree] => {
  const errors: SystemError[] = [];

  switch (ast.type) {
    case "error": {
      errors.push(ast.data.cause);
      if (!ast.children[0]) return [errors, ast];

      const [errors2, validatedTree] = validate(ast.children[0]);
      errors.push(...errors2);
      return [errors, validatedTree];
    }
    default:
      const [errors2, validatedChildren] = validateChildren(ast.children);
      errors.push(...errors2);
      return [errors, { ...ast, children: validatedChildren }];
  }
};
