import { ParsingError } from "./parser/types";

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
