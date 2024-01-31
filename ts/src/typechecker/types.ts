import { Scope } from "../scope";

export type TypeScope = Scope<Type>;
export type Type = {
  name: string;
  children: Type[];

  argName?: string;
  index?: number;
  implicit?: boolean;
  order: number;
  value?: any;
};
