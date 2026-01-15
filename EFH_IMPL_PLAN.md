# EFH_IMPL_PLAN

Goal: implement effect handlers in the TS VM using SetHandlers and EmitEffect, with first-class continuations and return handlers.

Plan
1) Instruction definitions
- Add InstructionCode.SetHandlers, InstructionCode.EmitEffect, and InstructionCode.ReturnHandler in `ts/src/vm/instructions.ts`.
- Extend the Instruction union to include all three opcodes.

2) Value + handler entry model
- Add a Continuation value shape (for example `{ continuation: ContinuationState }`) to `Value`.
- Define a HandlerEntry type for `Thread.handlersStack` with:
  - `handlers: Record<string, Closure>`
  - `returnHandler: Closure`
- Add small helpers in `ts/src/vm/handlers.ts` (or `ts/src/vm/index.ts`) to:
  - Clone stack, call stack frames, and closure env chains.
  - Normalize effect keys using existing `normalizeKey`.
- Add `handlers` to `VM` as a shared handler record (no stack scoping) used when `handlersStack` has no matching handler.

3) SetHandlers implementation
- In `ts/src/vm/handlers.ts`, pop the return handler closure and handlers record (validate types).
- Push a new HandlerEntry.
- This installs the handler for the current scope without advancing the IP.

1) EmitEffect implementation
- Pop the argument and effect atom; normalize the key.
- Walk `thread.handlersStack` from top to bottom to find the nearest entry with a matching handler closure.
- If no match in `handlersStack`, fall back to `vm.ambientHandlers` for the effect.
- Create a continuation snapshot that captures:
  - `functionName`, `ip` set to `thread.ip + 1`
  - `stack`, `callStack`, `env`, `handlersStack` (including the matched entry)
  - `blockedChannel`
- Temporarily remove the matched handler entry from `thread.handlersStack` while running the handler (deep handler semantics).
- Call the handler closure with two arguments: `[continuation, arg]`.
- Return `false` so the current frame does not auto-advance the IP.

1) Continuation invocation
- Update the Call handler to accept continuation values.
- For continuations, enforce `argCount === 1`.
- Restore the saved thread state, push the argument as the result of the EmitEffect opcode, and resume from the saved `ip`.
- Do not increment the old IP (this is a non-local jump).

1) Return handler on scope end
- Implement a ReturnHandler opcode handler that:
  - Pops the current handler entry from `thread.handlersStack`.
  - Pops the current result value from the stack and calls its `returnHandler` closure with it.
  - Leaves the return handler result on the stack as the scope result.
  - Returns `false` so the opcode manages its own control flow.
  - Is no-op if there is no handler entry (leave the popped value as-is).

1) Codegen alignment
- Update the VM codegen (or desugaring stage) so each handle scope emits ReturnHandler at the lexical end.
- Emit SetHandlers at the start of the scope, emit the body, then emit ReturnHandler to close the scope.

1) Tests
- Constraint: only modify `ts/tests/vm.test.ts`; do not touch `ts/tests/evaluation.test.ts` or `ts/tests/_llvm.test.ts`.
- Therefore, mirror evaluation coverage in VM tests (enable TODOs and add missing cases) so VM has parity:
  - Enable in `ts/tests/vm.test.ts`: effect handlers inject scoping, all in one, inject, mask, mask 2, without, inject shadowing, parallel inside, handler with continuation.
  - Add new VM tests (language-level, matching evaluation suite but missing in VM):
    - block-inject-fn-handle
    - block-inject-fn-handle twice
    - no continuation calls
    - no continuation calls sequential
    - single continuation call
    - multiple continuation calls
    - multiple continuation calls with mutations
    - multiple continuation calls with inner mutation
    - multiple continuation calls with mutations and refs
    - multiple continuation calls with mutations and closure
    - multi-level state backtracking
    - disjoint-level state backtracking
    - choose int loop
    - unhandled fail
    - choose int recursion
    - pythagorean triple example
    - logger example (return handler)
    - transaction example (return handler)
- Avoid adding opcode-level tests outside the language suite, to keep all coverage inside `ts/tests/vm.test.ts`.
- After enabling/adding VM tests, run the VM test suite to verify passing (update snapshots if needed).
