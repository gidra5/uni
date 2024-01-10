import { ParsingError, Position } from "./parser/types";
import { indexPosition } from "./position";

export const formatError = (line: number, where: string, msg: string) =>
  `[line ${line}] Error${where}: ${msg}`;

export const intent = (text: string, prefix: string) =>
  text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
export const print = (errors: ParsingError[]) =>
  errors
    .map((error, i) => {
      let formatted = `Error #${i}. ${error.message}`;
      if (error.cause) formatted += intent(print(error.cause), "  ");
      return formatted;
    })
    .join("\n\n");

export const error = (
  message: string,
  pos: Position,
  cause: ParsingError[] = []
): ParsingError => ({
  message,
  cause,
  pos,
});

export const endOfTokensError = (index: number) =>
  error("end of tokens", indexPosition(index));
export const endOfSrcError = (index: number) =>
  error("end of src", indexPosition(index));
