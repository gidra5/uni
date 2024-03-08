import { CopySymbol, copy } from "../utils/copy.js";
import { Register } from "../vm/utils.js";

type RegisterValue<T> = {
  value: T;
  stale: boolean; // needs to be written to memory before value is accessed
  weak: boolean; // can be overwritten to store another value
};

export class RegisterState<T> {
  state: (RegisterValue<T> | null)[];
  constructor(size: number) {
    this.state = Array(size).fill(null);
  }

  [CopySymbol]() {
    return this.copy();
  }

  copy() {
    const copied = new RegisterState<T>(0);
    copied.state = copy(this.state);
    return copied;
  }

  clear(f?: (x: RegisterValue<T> | null) => boolean) {
    if (f) this.state = this.state.map((x) => (f(x) ? null : x));
    else this.state = this.state.map(() => null);
  }

  find(f: (x: RegisterValue<T> | null) => boolean): Register | null {
    const index = this.state.findIndex(f);
    return index === -1 ? null : index;
  }

  get(register: Register): RegisterValue<T> | null {
    return this.state[register];
  }

  set(register: Register, value: T) {
    this.state[register] = { value, stale: true, weak: true };
  }

  unset(register: Register) {
    this.state[register] = null;
  }

  update(register: Register, value: T) {
    const _register = this.state[register];
    if (!_register) {
      this.set(register, value);
      return;
    }
    _register.value = value;
  }

  stale(register: Register) {
    const _register = this.state[register];
    if (_register) _register.stale = true;
  }

  synced(register: Register) {
    const _register = this.state[register];
    if (_register) _register.stale = false;
  }

  free(register: Register) {
    const _register = this.state[register];
    if (_register) _register.weak = true;
  }

  allocate(register: Register) {
    const _register = this.state[register];
    if (_register) _register.weak = false;
  }
}
