import { Scope } from "../scope";

export type TypeScope = Scope<Type>;
export type Type = {
  kind: string;
  types: Type[];
  name?: string;
  index?: number;
  implicit?: boolean;
  order: number;
  value?: any;
};
