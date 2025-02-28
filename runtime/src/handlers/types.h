#pragma once
#ifndef __lh_types_h
#define __lh_types_h

#include "./libhandler.h"
#include "./cenv.h"

// Annotate pointer parameters
#define ref
#define out

// assume gcc or clang
// __thread is already defined
#define __noinline __attribute__((noinline))
#define __noreturn __attribute__((noreturn))
#define __returnstwice __attribute__((returns_twice))

#define __externc

/* Select the right definition of setjmp/longjmp;

   We need a _fast_ and _plain_ version where `setjmp` just saves the register
   context, and `longjmp` just restores the register context and jumps to the saved
   location. Some platforms or libraries try to do more though, like trying
   to unwind the stack on a longjmp to invoke finalizers or saving and restoring signal
   masks. In those cases we try to substitute our own definitions.
*/
// define the lh_jmp_buf in terms of `void*` elements to have natural alignment
typedef void* lh_jmp_buf[ASM_JMPBUF_SIZE / sizeof(void*)];

/*-----------------------------------------------------------------
  Types
-----------------------------------------------------------------*/
// Basic types
typedef unsigned char byte;
typedef ptrdiff_t count;  // signed natural machine word

// forward declarations
struct _handler;
typedef struct _handler handler;

// A handler stack; Separate from the C-stack so it can be searched even if the C-stack contains fragments
// Handler frames are variable size so we use a `byte*` for the frames.
// Also, we use relative addressing (using `handler::prev`) such that an `hstack` can be reallocated
// and copied freely.
typedef struct _hstack {
  handler* top;     // top of the handlers `hframes <= top < hframes+count`
  ptrdiff_t count;  // number of bytes in use in `hframes`
  ptrdiff_t size;   // size in bytes
  byte* hframes;    // array of handlers (0 is bottom frame)
} hstack;

// A captured C stack
typedef struct _cstack {
  const void* base;  // The `base` is the lowest/smallest adress of where the stack is captured
  ptrdiff_t size;    // The byte size of the captured stack
  byte* frames;      // The captured stack data (allocated in the heap)
} cstack;

// A `fragment` is a captured C-stack and an `entry`.
typedef struct _fragment {
  lh_jmp_buf entry;       // jump powhere the fragment was captured
  struct _cstack cstack;  // the captured c stack
  count refcount;         // fragments are allocated on the heap and reference counted.
  volatile lh_value res;  // when jumped to, a result is passed through `res`
} fragment;

// Operation handlers receive an `lh_resume*`; the kind determines what it points to.
typedef enum _resumekind {
  GeneralResume,  // `lh_resume` is a `resume`
  ScopedResume,   // `lh_resume` is a `resume` but automatically released once out of scope
  TailResume      // `lh_resume` is a `tailresume`
} resumekind;

// Typedef'ed to `lh_resume` in the header.
// This is an algebraic data type and is either a `resume` or `tailresume`.
// The `_lh_resume` should be the first field of those (so we can upcast safely).
struct _lh_resume {
  resumekind rkind;  // the resumption kind
};

// Every resume kind starts with an `lhresume` field (for safe upcasting)
#define to_lhresume(r) (&(r)->lhresume)

// A first-class resumption
typedef struct _resume {
  struct _lh_resume lhresume;    // contains the kind: always `GeneralResume` or `ScopedResume` (must be first field, used for casts)
  count refcount;                // resumptions are heap allocated
  lh_jmp_buf entry;              // jump point where the resume was captured
  struct _cstack cstack;         // captured cstack
  struct _hstack hstack;         // captured hstack  always `size == count`
  volatile lh_value arg;         // the argument to `resume` is passed through `arg`.
  count resumptions;             // how often was this resumption resumed?
} resume;

// An optimized resumption that can only used for tail-call resumptions (`lh_tail_resume`).
typedef struct _tailresume {
  struct _lh_resume lhresume;  // the kind: always `TailResume` (must be first field, used for casts)
  volatile lh_value local;     // the new local value for the handler
  volatile bool resumed;       // set to `true` if `lh_tail_resume` was called
} tailresume;

// A handler; there are four kinds of frames
// 1. normal effect handlers, pushed when a handler is called
// 2. a "fragment" handler: these are pushed when a first-class continuation is
//    resumed through `lh_resume` or `lh_release_resume`. Such resume may overwrite parts of the
//    current stack which is saved in its own `fragment` continuation.
// 3. a "scoped" handler: these are pushed when a `LH_OP_SCOPED` operation is executed
//    to automatically release the resumption function when the scope is exited.
// 4. a "skip" handler: used to skip a number of handler frames for tail call resumptions.
struct _handler {
  lh_effect effect;  // The effect that is handled (fragment, skip, and scoped handlers have their own effect)
  count prev;        // the handler below on the stack is `prev` bytes before this one
};

// Every handler type starts with a handler field (for safe upcasting)
#define to_handler(h) (&(h)->handler)

// The special handlers are identified by these effects. These should not clash with real effects.
LH_DEFINE_EFFECT0(__fragment)
LH_DEFINE_EFFECT0(__scoped)
LH_DEFINE_EFFECT0(__skip)

// Regular effect handler.
typedef struct _effecthandler {
  struct _handler handler;
  lh_jmp_buf entry;            // used to jump back to a handler
  count id;                    // uniquely identifies the handler (cannot always use pointer due to reallocation)
  const lh_handlerdef* hdef;   // operation definitions
  volatile lh_value arg;       // the yield argument is passed here
  const lh_operation* arg_op;  // the yielded operation is passed here
  resume* arg_resume;          // the resumption function for the yielded operation
  void* stackbase;             // pointer to the c-stack just below the handler
  lh_value local;
} effecthandler;

// A skip handler.
typedef struct _skiphandler {
  struct _handler handler;
  count toskip;  // when looking for an operation handler, skip the next `toskip` bytes.
} skiphandler;

// A fragment handler just contains a `fragment`.
typedef struct _fragmenthandler {
  struct _handler handler;
  struct _fragment* fragment;
} fragmenthandler;

// A scoped handler keeps track of the resumption in the scope of
// an operator so it can be released properly.
typedef struct _scopedhandler {
  struct _handler handler;
  struct _resume* resume;
} scopedhandler;

#endif  // __lh_types_h