/* ----------------------------------------------------------------------------
  Copyright (c) 2016,2017, Microsoft Research, Daan Leijen
  This is free software; you can redistribute it and/or modify it under the
  terms of the Apache License, Version 2.0. A copy of the License can be
  found in the file "license.txt" at the root of this distribution.
-----------------------------------------------------------------------------*/

/* ----------------------------------------------------------------------------
  - We consider parent stack frames to be "below"(or "down") and child frames "above".
    The stack frame of the current function is the "top" of the stack.
    We use this terminology regardless if the stack itself actually grows up or down on
    the specific architecture.

  - When we capture a stack we always capture a delimited stack up to some handler
    on that stack. When resuming, we always restore the stack *at the exact
    same location*: this is very important when code references addresses on the
    stack, or when on execution platforms that don't allow the stack to reside in
    heap memory. This property is what makes our implementation portable and safe
    (in contrast to many other libraries for general co-routines).
    (It also means we generally need to copy stacks back and forth which may be more
    expensive than direct stack switching)

    The following things may lead to trouble on some platforms:
    - Stacks cannot move during execution. No platform does this by itself (as far as I know)
      but it does mean you cannot move resume functions between threads! A resume
      needs to be executed on the same thread as it was created.
    - First class resumptions (that escape the scope of the handler) can lead
      to a 'fragment' on the C stack. Code cannot unwind such stack beyond the fragment.
      This could happen with garbage collectors or debuggers for example. Some platforms
      may need some assembly to properly unwind through fragments. For C++ we need
      to install an exception handler on the fragment boundary to unwind properly.

    Names:
    - The `base` of C stack is always the lowest address; it equals the `top`
      of the stack if the stack grows down, or the `bottom` if the stack grows up.
    - An `entry` is a jump buffer (`_jmp_buf`) and contains the register context; it can
      be jumped to.
-----------------------------------------------------------------------------*/

#include "./libhandler.h"

#include <assert.h>  // assert
#include <errno.h>
#include <setjmp.h>  // jmpbuf
#include <stdarg.h>  // varargs
#include <stddef.h>  // ptrdiff_t
#include <stdint.h>  // intptr_t
#include <stdio.h>   // fprintf, vfprintf
#include <stdlib.h>  // exit, malloc
#include <string.h>  // memcpy

#include "./cenv.h"  // configure generated
#include "./hstack.h"
#include "./types.h"

// maintain cheap statistics
#define _STATS

__externc __returnstwice int _lh_setjmp(lh_jmp_buf buf);
__externc __noreturn void _lh_longjmp(lh_jmp_buf buf, int arg);

#include <alloca.h>
#define lh_alloca alloca

#include <stdbool.h>

// thread local `__hstack` is the 'shadow' handler stack
__thread hstack __hstack = {NULL, 0, 0, NULL};

/*-----------------------------------------------------------------
  Fatal errors
-----------------------------------------------------------------*/
static lh_fatalfun* onfatal = NULL;

void lh_debug_wait_for_enter() {
#if !defined(NDEBUG) && !defined(LH_IN_ENCLAVE)
  char buf[128];
  buf[127] = 0;
  fprintf(stderr, "(press enter to continue)\n");
  if (fgets(buf, 127, stdin) == NULL) { /* error */
  };
#endif
}

static void fatal(int err, const char* msg, ...) {
  va_list args;
  va_start(args, msg);
  char buf[256];
  vsnprintf(buf, 255, msg, args);
  va_end(args);
  if (onfatal != NULL) {
    onfatal(err, buf);
  } else {
#ifdef LH_IN_ENCLAVE
    *((int*)(NULL)) = 0;  // abort by crash?!?
#else
    fflush(stdout);
    fputs("libhandler: fatal error: ", stderr);
    fputs(buf, stderr);
    fputs("\n", stderr);
    lh_debug_wait_for_enter();
    exit(1);
#endif
  }
}

// Set up a different handler for fatal errors
void lh_register_onfatal(lh_fatalfun* _onfatal) {
  onfatal = _onfatal;
}

// Set up different allocation functions
static lh_mallocfun* custom_malloc = NULL;
static lh_callocfun* custom_calloc = NULL;
static lh_reallocfun* custom_realloc = NULL;
static lh_freefun* custom_free = NULL;

void lh_register_malloc(lh_mallocfun* _malloc, lh_callocfun* _calloc, lh_reallocfun* _realloc, lh_freefun* _free) {
  custom_malloc = _malloc;
  custom_calloc = _calloc;
  custom_realloc = _realloc;
  custom_free = _free;
}

// Allocate memory and call `fatal` when out-of-memory
#if defined(_MSC_VER) && defined(_DEBUG)
// Enable debugging logs on msvc
#undef _malloca  // suppress warning
#define _CRTDBG_MAP_ALLOC
#include <crtdbg.h>
#define checked_malloc malloc
#define checked_realloc realloc
#define checked_free free
#else
static void* checked_malloc(size_t size) {
  // assert((ptrdiff_t)(size) > 0); // check for overflow or negative sizes
  if ((ptrdiff_t)(size) <= 0) fatal(EINVAL, "invalid memory allocation size: %lu", (unsigned long)size);
  void* p = lh_malloc(size);
  if (p == NULL) fatal(ENOMEM, "out of memory");
  return p;
}
static void* checked_realloc(void* p, size_t size) {
  // assert((ptrdiff_t)(size) > 0); // check for overflow or negative sizes
  if ((ptrdiff_t)(size) <= 0) fatal(EINVAL, "invalid memory re-allocation size: %lu", (unsigned long)size);
  void* q = lh_realloc(p, size);
  if (q == NULL) fatal(ENOMEM, "out of memory");
  return q;
}
static void checked_free(void* p) {
  lh_free(p);
}
#endif

void* lh_malloc(size_t size) {
  return (custom_malloc == NULL ? malloc(size) : custom_malloc(size));
}
void* lh_calloc(size_t n, size_t size) {
  return (custom_calloc == NULL ? calloc(n, size) : custom_calloc(n, size));
}
void* lh_realloc(void* p, size_t size) {
  return (custom_realloc == NULL ? realloc(p, size) : custom_realloc(p, size));
}
void lh_free(void* p) {
  assert(p != NULL);
  if (p == NULL) return;
  if (custom_free == NULL)
    free(p);
  else
    custom_free(p);
}

/*-----------------------------------------------------------------
  Stack helpers; these abstract over the direction the C stack grows.
  The functions here give an interface _as if_ the stack
  always grows 'up' with the 'top' of the stack at the highest absolute address.
-----------------------------------------------------------------*/

// approximate the top of the stack -- conservatively upward
// note: often this code is written as:
//    void* top = (void*)&top; return top;
// but that does not work with optimizing compilers; these detect
// that a local address is returned which is undefined behaviour.
// Some compilers (clang and gcc) optimize to always return 0 in that case!

// .. So, we use an identity function to return the final stack address:
static __noinline void* _stack_address(void* p) {
  return p;
}

// .. And pass the stack top location by address to it:
static __noinline void* get_stack_top() {
  void* top = NULL;
  return _stack_address(&top);
}

// true if the stack grows up
static bool stackup = false;

// base of our c stack
static const void* stackbottom = NULL;

// infer the direction in which the stack grows and the size of a stack frame
static __noinline void infer_stackdir() {
  void* mark = _stack_address(&mark);
  void* top = get_stack_top();
  stackup = (mark < top);
  stackbottom = mark;
}

// The difference between stack pointers (pretending the stack grows up)
// i.e. it is `p - q` for a stack that grows up, but `q - p` for a stack that grows down.
static ptrdiff_t stack_diff(const void* p, const void* q) {
  ptrdiff_t diff = (byte*)p - (byte*)q;
  return (stackup ? diff : -diff);
}

// The address of the bottom of the stack given the `base` and `size` of a stack.
static const void* stack_bottom(const void* base, ptrdiff_t size) {
  return (stackup ? base : (byte*)base + size);
}

// The address of the top of the stack given the `base` and `size` of the stack.
static const void* stack_top(const void* base, ptrdiff_t size) {
  return (stackup ? (byte*)base + size : base);
}

// Is an address `below` another in the stack?
// i.e. if the stack grows up `p < q` and otherwise `p > q`
static bool stack_isbelow(const void* p, const void* q) {
  return (stackup ? p < q : p > q);
}

// Does this pointer point to the C stack?
static bool in_cstack(const void* p) {
  const void* top = get_stack_top();
  return !(stack_isbelow(top, p) || stack_isbelow(p, stackbottom));
}

// In debug mode, check we don't pass pointers to the C stack in `lh_value`s.
lh_value lh_check_value_ptr(const void* p) {
  if (in_cstack(p)) fatal(EINVAL, "Cannot pass pointers to the c-stack in a lh_value");
  return ((lh_value)((intptr_t)p));
}

/*-----------------------------------------------------------------
  Effect and optag names
-----------------------------------------------------------------*/

static bool op_is_release(lh_handlerdef* op) {
  assert(op != NULL);
  return (op->opkind != LH_OP_NORESUMEX);
}

/*-----------------------------------------------------------------
   Maintain statistics
-----------------------------------------------------------------*/
#ifdef _DEBUG
// maintain detailed statistics
#define _DEBUG_STATS
#endif

static struct {
  long rcont_captured_scoped;
  long rcont_captured_resume;
  long rcont_captured_fragment;
  long rcont_captured_empty;
  count rcont_captured_size;

  long rcont_resumed_scoped;
  long rcont_resumed_resume;
  long rcont_resumed_fragment;
  long rcont_resumed_tail;

  long rcont_released;
  count rcont_released_size;

  long operations;
  count hstack_max;
} stats = {
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
};

#ifdef LH_IN_ENCLAVE
void lh_print_stats(void* h) {
  /* void */
}
#else
void lh_print_stats(FILE* h) {
  static const char* line = "--------------------------------------------------------------\n";
#ifdef _STATS
  if (h == NULL) h = stderr;
  fputs(line, h);
  long captured = stats.rcont_captured_scoped + stats.rcont_captured_resume + stats.rcont_captured_fragment;
  long resumed = stats.rcont_resumed_scoped + stats.rcont_resumed_resume + stats.rcont_resumed_fragment + stats.rcont_resumed_tail;
  if (captured != stats.rcont_released) {
    fputs("libhandler: memory leaked: not all continuations are released!\n", h);
  } else {
    fputs("libhandler statistics:\n", h);
  }
  if (captured > 0) {
    fputs("resume cont:\n", h);
    fprintf(h, "  resumed     :%li\n", resumed);
    fprintf(h, "    resume    :%6li\n", stats.rcont_resumed_resume);
    fprintf(h, "    scoped    :%6li\n", stats.rcont_resumed_scoped);
    fprintf(h, "    fragment  :%6li\n", stats.rcont_resumed_fragment);
#ifdef _DEBUG_STATS
    fprintf(h, "    tail      :%6li\n", stats.rcont_resumed_tail);
#endif
    fprintf(h, "  captured    :%li\n", captured);
    fprintf(h, "    resume    :%6li\n", stats.rcont_captured_resume);
    fprintf(h, "    scoped    :%6li\n", stats.rcont_captured_scoped);
    fprintf(h, "    fragment  :%6li\n", stats.rcont_captured_fragment);
    fprintf(h, "    empty     :%6li\n", stats.rcont_captured_empty);
    fprintf(h, "    total size:%6li kb\n", (long)((stats.rcont_captured_size + 1023) / 1024));
    fprintf(h, "    avg size  :%6li bytes\n", (long)((stats.rcont_captured_size / (captured > 0 ? captured : 1))));
    if (captured != stats.rcont_released) {
      fprintf(h, "  released    :%li\n", stats.rcont_released);
      fprintf(h, "    total size:%6li kb\n", (long)((stats.rcont_released_size + 1023) / 1024));
    }
    fprintf(h, "  hstack max  :%li kb\n", (long)(stats.hstack_max + 1023) / 1024);
  }
#ifdef _DEBUG_STATS
  fputs("operations:\n", h);
  fprintf(h, "  total       :%6li\n", stats.operations);
#endif
  fputs(line, h);
#endif
}
#endif

#ifdef LH_IN_ENCLAVE
void lh_check_memory(void* h) {
  /* void */
}
#else
// Check if all continuations were released. If not, print out statistics.
void lh_check_memory(FILE* h) {
#ifdef _STATS
  count captured = stats.rcont_captured_scoped + stats.rcont_captured_resume + stats.rcont_captured_fragment;
  if (captured != stats.rcont_released) {
    lh_print_stats(h);
  }
#endif
}
#endif

/*-----------------------------------------------------------------
  Cstack
-----------------------------------------------------------------*/
static void cstack_init(ref cstack* cs) {
  assert(cs != NULL);
  cs->base = NULL;
  cs->size = 0;
  cs->frames = NULL;
}

static void cstack_free(ref cstack* cs) {
  assert(cs != NULL);
  if (cs->frames != NULL) {
    checked_free(cs->frames);
    cs->frames = NULL;
    cs->size = 0;
  }
}

// Return the lowest address to a c-stack regardless if the stack grows up or down
static const byte* cstack_base(const cstack* cs) {
  return (const byte*)cs->base;
}

// Return the top of the c-stack
static const void* cstack_top(const cstack* cs) {
  return stack_top(cs->base, cs->size);
}

// Return the bottom of the c-stack
static const void* cstack_bottom(const cstack* cs) {
  return stack_bottom(cs->base, cs->size);
}

// Pointer difference in bytes
static ptrdiff_t ptrdiff(const void* p, const void* q) {
  return (byte*)p - (byte*)q;
}

/*-----------------------------------------------------------------
  Fragments
-----------------------------------------------------------------*/

// release a continuation; returns `true` if it was released
static __noinline void fragment_free_(fragment* f) {
#ifdef _STATS
  stats.rcont_released++;
  stats.rcont_released_size += (long)f->cstack.size;
#endif
  cstack_free(&f->cstack);
  checked_free(f);
}

static void _fragment_release(fragment* f) {
  assert(f->refcount > 0);
  if (f->refcount > 1) {
    f->refcount--;
  } else if (f->refcount == 1) {
    f->refcount = -1;  // refcount is sticky on negative so can safely call release more than once
    fragment_free_(f);
  }
}

// Release a fragment
static void fragment_release(fragment* f) {
  if (f != NULL) _fragment_release(f);
}

// Release a resume continuation and set to `NULL`
static void fragment_release_at(fragment* volatile* pf) {
  fragment_release(*pf);
  *pf = NULL;
}

// Copy a reference to a resume continuation, increasing its reference count.
static fragment* fragment_acquire(fragment* f) {
  assert(f != NULL);
  if (f != NULL) {
    assert(f->refcount > 0);
    if (f->refcount >= 0) f->refcount++;
  }
  return f;
}

/*-----------------------------------------------------------------
  Resumptions
-----------------------------------------------------------------*/
// Forward
static void hstack_free(ref hstack* hs, bool do_release);

// release a resumptions; returns `true` if it was released
static __noinline void _resume_free(resume* r) {
  assert(r->refcount == -1);
#ifdef _STATS
  stats.rcont_released++;
  stats.rcont_released_size += (long)r->cstack.size + (long)r->hstack.size;
#endif
  cstack_free(&r->cstack);
  hstack_free(&r->hstack, true);
  checked_free(r);
}

static void _resume_release(resume* r) {
  assert(r->lhresume.rkind == GeneralResume || r->lhresume.rkind == ScopedResume);
  assert(r->refcount > 0);
  if (r->refcount > 1) {
    r->refcount--;
  } else if (r->refcount == 1) {
    r->refcount = -1;  // sticky on negative so can call release more than once
    _resume_free(r);
  }
}

// Release a resumption
static void resume_release(resume* r) {
  if (r != NULL) _resume_release(r);
}

// Release a resumption and set it to NULL;
static void resume_release_at(ref resume** pr) {
  resume_release(*pr);
  *pr = NULL;
}

// Acquire a resumption by increasing its reference count.
static resume* resume_acquire(resume* r) {
  assert(r != NULL);
  if (r != NULL) {
    assert(r->lhresume.rkind == GeneralResume || r->lhresume.rkind == ScopedResume);
    assert(r->refcount > 0);
    if (r->refcount >= 0) r->refcount++;
  }
  return r;
}

/*-----------------------------------------------------------------
  Handler
-----------------------------------------------------------------*/

static bool is_skiphandler(const handler* h) {
  return (h->effect == LH_EFFECT(__skip));
}

static bool is_fragmenthandler(const handler* h) {
  return (h->effect == LH_EFFECT(__fragment));
}

static bool is_scopedhandler(const handler* h) {
  return (h->effect == LH_EFFECT(__scoped));
}

#ifndef NDEBUG
static bool is_effecthandler(const handler* h) {
  return (!is_skiphandler(h) && !is_fragmenthandler(h) && !is_scopedhandler(h));
}
static count handler_size(const lh_effect effect) {
  if (effect == LH_EFFECT(__skip))
    return sizeof(skiphandler);
  else if (effect == LH_EFFECT(__fragment))
    return sizeof(fragmenthandler);
  else if (effect == LH_EFFECT(__scoped))
    return sizeof(scopedhandler);
  else
    return sizeof(effecthandler);
}
#endif

// Return the handler below on the stack
static handler* _handler_prev(const handler* h) {
  assert(h->prev >= 0);  // may be equal to zero, in which case the same handler is returned! (bottom frame)
  return (handler*)((byte*)h - h->prev);
}

// Return a pointer to the last skipped handler
static handler* _handler_prev_skip(const skiphandler* sh) {
  assert(sh->toskip > 0);
  return (handler*)((byte*)sh - sh->toskip);
}

static void handler_release(handler* h) {
  if (is_fragmenthandler(h)) {
    fragment_release_at(&((fragmenthandler*)h)->fragment);
  } else if (is_scopedhandler(h)) {
    resume_release_at(&((scopedhandler*)h)->resume);
  } else if (is_skiphandler(h)) {
    /* nothing */
  } else {
    assert(is_effecthandler(h));
    /* nothing */
  }
}

// Increase the reference count of handler fields
static handler* handler_acquire(handler* h) {
  if (is_fragmenthandler(h)) {
    fragment_acquire(((fragmenthandler*)h)->fragment);
  } else if (is_scopedhandler(h)) {
    resume_acquire(((scopedhandler*)h)->resume);
  } else if (is_skiphandler(h)) {
    /* nothing */
  } else {
    assert(is_effecthandler(h));
    /* nothing */
  }
  return h;
}

/*-----------------------------------------------------------------
  Handler stacks
-----------------------------------------------------------------*/

// Current top handler frame
static handler* hstack_top(const hstack* hs) {
  return hs->top;
}

// Bottom handler
static handler* hstack_bottom(const hstack* hs) {
  return (handler*)hs->hframes;
}

// Is the  handler stack empty?
static bool hstack_empty(const hstack* hs) {
  return (hs->count <= 0);
}

#ifndef NDEBUG
static bool hstack_contains(const hstack* hs, const handler* h) {
  return (h != NULL && hs->count > 0 && hstack_bottom(hs) <= h && h <= hstack_top(hs));
}

static bool valid_handler(const hstack* hs, const handler* h) {
  return (h != NULL && hstack_contains(hs, h) &&
          (h->prev == 0 || h->prev == handler_size(_handler_prev(h)->effect)));
}

static bool hstack_follows(const hstack* hs, const handler* h, const handler* g) {
  assert(valid_handler(hs, h));
  assert(valid_handler(hs, g));
  return (h != g && (byte*)h == (byte*)g - g->prev);
}
#endif

// Return the number of bytes between a handler and the end of the handler stack
static count hstack_indexof(const hstack* hs, const handler* h) {
  assert((hs->count == 0 && h == hs->top) || valid_handler(hs, h));
  return (hs->count - ptrdiff(h, hs->hframes));
}

// Return the handler that is `idx` bytes down the handler stack
static handler* hstack_at(const hstack* hs, count idx) {
  assert(idx >= 0 && idx <= hs->count);
  return (handler*)(&hs->hframes[hs->count - idx]);
}

// Size of the handler on top
static count hstack_topsize(const hstack* hs) {
  return hstack_indexof(hs, hs->top);
}

// Return the previous handler, or NULL if at the bottom frame
static handler* hstack_prev(hstack* hs, handler* h) {
  assert(valid_handler(hs, h));
  handler* prev = _handler_prev(h);
  assert(prev == h || hstack_follows(hs, prev, h));
  return (prev == h ? NULL : prev);
}

// Return the bottomost skipped handler
static handler* hstack_prev_skip(hstack* hs, skiphandler* h) {
  assert(valid_handler(hs, to_handler(h)));
  handler* prev = _handler_prev_skip(h);
  assert(valid_handler(hs, prev));
  return prev;
}

// Release the handler frames of an `hstack`
static void hstack_free(ref hstack* hs, bool do_release) {
  assert(hs != NULL);
  if (hs->hframes != NULL) {
    if (do_release && !hstack_empty(hs)) {
      handler* h = hstack_top(hs);
      do {
        handler_release(h);
        h = hstack_prev(hs, h);
      } while (h != NULL);
    }
    checked_free(hs->hframes);
    hstack_init(hs);
  }
}

/*-----------------------------------------------------------------
  pop and push
-----------------------------------------------------------------*/

// Pop a handler frame, decreasing its reference counts.
static void hstack_pop(ref hstack* hs, bool do_release) {
  assert(!hstack_empty(hs));
  if (do_release) {
    handler_release(hstack_top(hs));
  }
  hs->count = ptrdiff(hs->top, hs->hframes);
  hs->top = _handler_prev(hs->top);
}

// Pop a fragment frame
static fragment* hstack_pop_fragment(hstack* hs) {
  if (!hstack_empty(hs)) {
    handler* h = hstack_top(hs);
    if (is_fragmenthandler(h)) {
      fragment* fragment = fragment_acquire(((fragmenthandler*)h)->fragment);
      hstack_pop(hs, true);
      return fragment;
    }
  }
  return NULL;
}

// Push a new uninitialized handler frame and return a reference to it.
static handler* _hstack_push(ref hstack* hs, lh_effect effect, count size) {
  assert(size == handler_size(effect));
  handler* h = hstack_ensure_space(hs, size);
  h->effect = effect;
  h->prev = ptrdiff(h, hs->top);
  assert((hs->count > 0 && h->prev > 0) || (hs->count == 0 && h->prev == 0));
  hs->top = h;
  hs->count += size;
  return h;
}

// Push an effect handler
static effecthandler* hstack_push_effect(ref hstack* hs, const lh_handlerdef* hdef, void* stackbase) {
  static count id = 1000;
  effecthandler* h = (effecthandler*)_hstack_push(hs, hdef->effect, sizeof(effecthandler));
  h->id = id++;
  h->hdef = hdef;
  h->stackbase = stackbase;
  h->arg = lh_value_null;
  h->arg_op = NULL;
  h->arg_resume = NULL;
  return h;
}

// Push a skip handler
static skiphandler* hstack_push_skip(ref hstack* hs, count toskip) {
  skiphandler* h = (skiphandler*)_hstack_push(hs, LH_EFFECT(__skip), sizeof(skiphandler));
  h->toskip = toskip;
  return h;
}

// Push a fragment handler
static fragmenthandler* hstack_push_fragment(ref hstack* hs, fragment* fragment) {
  fragmenthandler* h = (fragmenthandler*)_hstack_push(hs, LH_EFFECT(__fragment), sizeof(fragmenthandler));
  h->fragment = fragment;
  return h;
}

// Push a scoped handler
static scopedhandler* hstack_push_scoped(ref hstack* hs, resume* resume) {
  scopedhandler* h = (scopedhandler*)_hstack_push(hs, LH_EFFECT(__scoped), sizeof(scopedhandler));
  h->resume = resume;
  return h;
}

// Move handlers from one stack to another keeping reference counts as is.
// Include `from` in the moved handlers. Returns a pointer to the new `from` in `hs`.
static handler* hstack_append_movefrom(ref hstack* hs, ref hstack* topush, const handler* from) {
  assert(hstack_contains(topush, from));
  count needed = hstack_indexof(topush, from);
  handler* bot = hstack_ensure_space(hs, needed);
  memcpy(bot, from, needed);
  bot->prev = hstack_topsize(hs);
  hs->count += needed;
  hs->top = hstack_at(hs, hstack_topsize(topush));
  return bot;
}

// Copy handlers from one stack to another increasing reference counts as appropiate.
// Include `from` in the copied handlers but will not acquire it!!
// Returns a pointer to the new `from` in `hs`.
static handler* hstack_append_copyfrom(ref hstack* hs, ref hstack* tocopy, handler* from) {
  assert(hstack_contains(tocopy, from));
  handler* bot = hstack_append_movefrom(hs, tocopy, from);
  handler* h = hstack_top(hs);
  while (h > bot) {
    handler_acquire(h);
    h = hstack_prev(hs, h);
  }
  assert(h == bot);
  return bot;
}

// Find an operation that handles `optag` in the handler stack.
static effecthandler* hstack_find(ref hstack* hs, lh_effect optag, out lh_handlerdef** op, out count* skipped) {
  if (!hstack_empty(hs)) {
    handler* h = hstack_top(hs);
    do {
      assert(valid_handler(hs, h));
      if (h->effect == optag) {
        effecthandler* eh = (effecthandler*)h;
        assert(eh->hdef != NULL);
        lh_handlerdef* hdef = &eh->hdef;
        *skipped = hstack_indexof(hs, h);
        assert(*skipped > 0);
        *op = hdef;
        return eh;
      } else if (is_skiphandler(h)) {
        h = hstack_prev_skip(hs, (skiphandler*)h);
      }
      h = hstack_prev(hs, h);
    } while (h != NULL);
  }
  fatal(ENOSYS, "no handler for operation found");
  *skipped = 0;
  *op = NULL;
  return NULL;
}

/*-----------------------------------------------------------------
  Unwind a handler stack
  This is a bit involved since it requires popping one frame at a
  time decreasing reference counts, but also when a "fragment" handler
  is encountered we need to restore its saved stack. We cannot do that
  right away though as that may overwrite our own stack frame. Therefore,
  the unwinding returns a `cstack` object that should be restored when
  possible.

  Todo:  we could optimize more by first scanning the maximum
  stack we need and allocate only once; now we reallocate on every
  newly extending fragment. In practice though it is rare to encounter
  more than one fragment so this may not be worth it.
-----------------------------------------------------------------*/
const byte* _min(const byte* p, const byte* q) { return (p <= q ? p : q); }
const byte* _max(const byte* p, const byte* q) { return (p >= q ? p : q); }

// Extend cstack `cs` in-place to encompass both the `ds` stack and itself.
static void cstack_extendfrom(ref cstack* cs, ref cstack* ds, bool will_free_ds) {
  const byte* csb = cstack_base(cs);
  const byte* dsb = cstack_base(ds);
  if (cs->frames == NULL) {
    // nothing yet, just copy `ds`
    if (ds->frames != NULL) {
      if (will_free_ds) {
        // `ds` is about to be freed.. take over its frames
        *cs = *ds;  // copy fields
        // and prevent freeing `ds`
        ds->frames = NULL;
        ds->size = 0;
      } else {
        // otherwise copy the c-stack from ds
        cs->frames = (byte*)checked_malloc(ds->size);
        memcpy(cs->frames, ds->frames, ds->size);
        cs->base = ds->base;
        cs->size = ds->size;
      }
    }
  } else {
    // otherwise extend such that we can merge `cs` and `ds` together
    const byte* newbase = _min(csb, dsb);
    ptrdiff_t newsize = _max(csb + cs->size, dsb + ds->size) - newbase;
    // check if we need to reallocate; no need if `ds` fits right in.
    if (csb != newbase || cs->size != newsize) {
      // reallocate..
      byte* newframes = (byte*)checked_malloc(newsize);
      // if non-overlapping, copy the current stack first into the gap
      // (there is never a gap at the ends as `cs` or `ds` either start or end the `newframes`).
      if ((dsb > csb + cs->size) || (dsb + ds->size < csb)) {
        // todo: we could optimize this further by just copying the gap part
        memcpy(newframes, newbase, newsize);
      }
      // next copy the cs->frames into the new frames
      assert(csb >= newbase);
      assert(csb + cs->size <= newbase + newsize);
      memcpy(newframes + (csb - newbase), cs->frames, cs->size);
      // and update cs
      checked_free(cs->frames);
      cs->frames = newframes;
      cs->size = newsize;
      cs->base = newbase;
    }
    // and finally copy the new `ds->frames` into `cs` (which is now large enought to contain `ds`)
    assert(cs->base == newbase);
    assert(cs->size == newsize);
    assert(dsb >= newbase);
    assert(dsb + ds->size <= newbase + newsize);
    memcpy(cs->frames + (dsb - newbase), ds->frames, ds->size);
  }
}

// Pop the stack up to the given handler `h` (which should reside in `hs`)
// Return a stack object in `cs` (if not `NULL) that should be restored later on.
static void hstack_pop_upto(ref hstack* hs, ref handler* h, bool do_release, out cstack* cs) {
  if (cs != NULL) cstack_init(cs);
  assert(!hstack_empty(hs));
  handler* cur = hstack_top(hs);
  //  handler* skip_upto = NULL;
  while (cur > h) {
    /*
    if (skip_upto != NULL) {
      if (cur==skip_upto) skip_upto = NULL;
      else if (cur < skip_upto) fatal(EFAULT, "handler stack is invalid");
    }
    else {
    */
    if (is_fragmenthandler(cur)) {
      // special "fragment" handler; remember to restore the stack
      fragment* f = ((fragmenthandler*)cur)->fragment;
      if (f->cstack.frames != NULL) {
        cstack_extendfrom(cs, &f->cstack, do_release && f->refcount == 1);
      }
    }
    /*
      else if (is_skiphandler(cur)) {
        // todo: if 'do_release' is false, we could skip right up to handler
        skip_upto = hstack_prev_skip(hs,(skiphandler*)cur);
        assert(valid_handler(hs, skip_upto));
      }
    }
    */
    hstack_pop(hs, do_release);
    cur = hstack_top(hs);
  }
  assert(cur == h);
  assert(hstack_top(hs) == h);
}

/*-----------------------------------------------------------------
  Initialize globals
-----------------------------------------------------------------*/

static bool initialized = false;

static __noinline bool _lh_init(hstack* hs) {
  if (!initialized) {
    initialized = true;
    infer_stackdir();
  }
  stackbottom = get_stack_top();  // in debug mode we use this to check if operation arguments are not passed on the stack
  assert(__hstack.size == 0 && hs == &__hstack);
  hstack_init(hs);
  return true;
}

static bool lh_init(hstack* hs) {
  if (hs->size != 0)
    return false;
  else
    return _lh_init(hs);
}

static __noinline void lh_done(hstack* hs) {
  assert(hs == &__hstack && hs->size > 0 && hs->count == 0 && (byte*)hs->top == &hs->hframes[0]);
  hstack_free(hs, true);
}

#define LH_INIT(hs) \
  {                 \
    bool __init = lh_init(hs);
#define LH_DONE(hs)        \
  if (__init) lh_done(hs); \
  }

/*-----------------------------------------------------------------
  Internal: Jump to a context
-----------------------------------------------------------------*/

// `_jumpto_stack` jumps to a given entry with a given c-stack to restore.
// It is called from `jumpto` which ensures through an `alloca` that it will
// run in a stack frame just above the stack we are restoring (so the local
// variables will remain in-tact. The `no_opt` parameter is there so
// smart compilers (i.e. clang) will not optimize away the `alloca` in `jumpto`.
static __noinline __noreturn void _jumpto_stack(
    byte* cframes, ptrdiff_t size, byte* base,
    lh_jmp_buf* entry, bool freecframes, byte* no_opt) {
  if (no_opt != NULL) no_opt[0] = 0;
  // copy the saved stack onto our stack
  memcpy(base, cframes, size);  // this will not overwrite our stack frame
  if (freecframes) {
    free(cframes);
  }  // should be fine to call `free` (assuming it will not mess with the stack above its frame)
  // and jump
  // _lh_longjmp_chain(*entry, cstack_bottom(&cs), exnframe);

  _lh_longjmp(*entry, 1);
}

/* jump to `entry` while restoring cstack `cs` and pushing handlers `hs` onto the global handler stack.
   Set `freecframes` to `true` to release the cstack after jumping.
*/
static __noinline __noreturn void jumpto(
    cstack* cs, lh_jmp_buf* entry, bool freecframes) {
  if (cs->frames == NULL) {
    // if no stack, just jump back down the stack;
    // sanity: check if the entry is really below us!
    void* top = get_stack_top();
    if (cs->base != NULL && stack_isbelow(top, cstack_top(cs))) {
      fatal(EFAULT, "Trying to jump up the stack to a scope that was already exited!");
    }
    // long jump back down direcly, no need to restore stacks
    _lh_longjmp(*entry, 1);
  } else {
    // ensure there is enough room on the stack;
    void* top = get_stack_top();
    ptrdiff_t extra = stack_diff(cstack_top(cs), top);
    extra += 0x200;  // ensure a little more for the `_jumpto_stack` stack frame
                     // clang tends to optimize out a bare `alloca` call so we need to
                     //  ensure it sees it as live; we store it in a local and pass that to `_jumpto_stack`
    byte* no_opt = NULL;
    if (extra > 0) {
      no_opt = (byte*)lh_alloca(extra);  // allocate room on the stack; in here the new stack will get copied.
    }

    _jumpto_stack(cs->frames, cs->size, (byte*)cstack_base(cs),
                  entry, freecframes, no_opt);
  }
}

// jump to a fragment
static __noinline __noreturn void jumpto_fragment(fragment* f, lh_value res) {
  assert(f->refcount >= 1);
  f->res = res;  // set the argument in the cont slot
  jumpto(&f->cstack, &f->entry, false);
}

// jump to a resumption
static __noinline __noreturn void jumpto_resume(resume* r, lh_value arg) {
  // first restore the hstack and set the new local
  handler* h = hstack_bottom(&r->hstack);
  assert(is_effecthandler(h));
  if (r->refcount == 1) {
    h = hstack_append_movefrom(&__hstack, &r->hstack, hstack_bottom(&r->hstack));
    hstack_free(&r->hstack, false /* no release */);  // zero out the hstack in the resume since we moved it
  } else {
    h = hstack_append_copyfrom(&__hstack, &r->hstack, hstack_bottom(&r->hstack));  // does not acquire h
  }
  assert(is_effecthandler(h));
  if (r->refcount == 1) {
    handler_acquire(h);  // acquire now that the new local is in there (as it may alias the original)
  }
  // and then restore the cstack and jump
  r->arg = arg;      // set the argument in the cont slot
  r->resumptions++;  // increment resume count
  jumpto(&r->cstack, &r->entry, false);
}

/*-----------------------------------------------------------------
  Capture stack
-----------------------------------------------------------------*/

// Copy part of the C stack into a context.
static void capture_cstack(cstack* cs, const void* bottom, const void* top) {
  ptrdiff_t size = stack_diff(top, bottom);
  if (size <= 0) {  // (stackdown ? top >= bottom : top <= bottom) {
    // top is not above bottom; don't capture the stack
    cs->base = bottom;
    cs->size = 0;
    cs->frames = NULL;
  } else {
    // copy the stack
    cs->base = (bottom <= top ? bottom : top);  // always lowest address
    cs->size = size;
    cs->frames = (byte*)checked_malloc(size);
    memcpy(cs->frames, cs->base, size);
  }
}

// Capture part of a handler stack (includeing h).
static void capture_hstack(hstack* hs, hstack* to, effecthandler* h, bool copy) {
  hstack_init(to);
  if (copy) {
    handler* toh = hstack_append_copyfrom(to, hs, to_handler(h));
    handler_acquire(toh);
  } else {
    hstack_append_movefrom(to, hs, to_handler(h));
  }
}

/*-----------------------------------------------------------------
    Yield to handler
-----------------------------------------------------------------*/

// Return to a handler by unwinding the handler stack.
static void __noinline __noreturn yield_to_handler(hstack* hs, effecthandler* h,
                                                   resume* resume, lh_handlerdef* op, lh_value oparg, bool do_release) {
  cstack cs;
  cstack_init(&cs);
  hstack_pop_upto(hs, to_handler(h), do_release, &cs);
  h->arg = oparg;
  h->arg_op = op;
  h->arg_resume = resume;
  jumpto(&cs, &h->entry, true);
}

/*-----------------------------------------------------------------
  Captured resume & yield
-----------------------------------------------------------------*/

// Call a `resume* r`. First capture a jump point and c-stack into a `fragment`
// and push it in a fragment handler so the resume will return here later on.
static __noinline lh_value capture_resume_call(hstack* hs, resume* r, lh_value resumearg) {
  // initialize continuation
  fragment* f = (fragment*)checked_malloc(sizeof(fragment));
  f->refcount = 1;
  f->res = lh_value_null;

#ifdef _STATS
  stats.rcont_captured_fragment++;
#endif
  // and set our jump point
  if (_lh_setjmp(f->entry) != 0) {
    // longjmp back from the resume
    lh_value res = f->res;  // get result

#ifdef _STATS
    stats.rcont_resumed_fragment++;
#endif
    // release our fragment
    fragment_release(f);

    // return the result of the resume call
    return res;
  } else {
    // we set our jump point; now capture the stack upto the stack base of the continuation
    void* top = get_stack_top();
    capture_cstack(&f->cstack, cstack_bottom(&r->cstack), top);
#ifdef _STATS
    if (f->cstack.frames == NULL) stats.rcont_captured_empty++;
    stats.rcont_captured_size += (long)f->cstack.size;
#endif
    // push a special "fragment" frame to remember to restore the stack when yielding to a handler across non-scoped resumes
    hstack_push_fragment(hs, f);
    // and now jump to the entry with resume arg
    jumpto_resume(r, resumearg);
  }
}

// Capture a first-class resumption and yield to the handler.
static __noinline lh_value capture_resume_yield(hstack* hs, effecthandler* h, lh_handlerdef* op, lh_value oparg) {
  // initialize continuation
  resume* r = (resume*)checked_malloc(sizeof(resume));
  r->lhresume.rkind = (op->opkind <= LH_OP_SCOPED ? ScopedResume : GeneralResume);
  r->refcount = 1;
  r->resumptions = 0;
  r->arg = lh_value_null;
#ifdef _STATS
  stats.rcont_captured_resume++;
#endif
  // and set our jump point
  if (_lh_setjmp(r->entry) != 0) {
    // longjmp back here when the resumption is called
    assert(hs == &__hstack);
    lh_value res = r->arg;
#ifdef _STATS
    stats.rcont_resumed_resume++;
#endif

    // release our context
    resume_release(r);
    // return the result of the resume call
    return res;
  } else {
    // we set our jump point; now capture the stack upto the handler
    void* top = get_stack_top();
    capture_cstack(&r->cstack, h->stackbase, top);
    // capture hstack
    capture_hstack(hs, &r->hstack, h, false);
#ifdef _STATS
    if (r->cstack.frames == NULL) stats.rcont_captured_empty++;
    stats.rcont_captured_size += (long)r->cstack.size + (long)r->hstack.size;
#endif
    assert(h->hdef == ((effecthandler*)(r->hstack.hframes))->hdef);  // same handler?
    // and yield to the handler
    yield_to_handler(hs, h, r, op, oparg, false /* we moved the frames to the resumption */);
  }
}

/*-----------------------------------------------------------------
   Handle
-----------------------------------------------------------------*/

// Start a handler
static __noinline lh_value handle_with(
    hstack* hs, effecthandler* h, lh_actionfun* action, lh_value arg) {
// set the handler entry point
#if !defined(NDEBUG)
  const count id = h->id;
#endif
#ifndef NDEBUG
  const lh_handlerdef* hdef = h->hdef;
  void* base = h->stackbase;
#endif
  if (_lh_setjmp(h->entry) != 0) {
    // needed as some compilers optimize wrongly (e.g. gcc v5.4.0 x86_64 with -O2 on msys2)
    hs = &__hstack;
    // we yielded back to the handler; the `handler->arg` is filled in.
    // note: if we return trough non-scoped resumes the handler stack may be
    // different and handler `h` will point to a random handler in that stack!
    // ie. we need to load from the top of the current handler stack instead.
    // This is also necessary if the handler stack was reallocated to grow.
    h = (effecthandler*)(hstack_top(hs));  // re-load our handler
    assert(is_effecthandler(to_handler(h)));
#ifndef NDEBUG
    assert(id == h->id);
    assert(hdef == h->hdef);
    assert(base == h->stackbase);
#endif
    lh_value res = h->arg;
    resume* resume = h->arg_resume;
    const lh_handlerdef* op = h->arg_op;
    assert(op == NULL || op->effect == h->handler.effect);
    hstack_pop(hs, (op == NULL) /*|| !op_is_release(op)*/);  // no release if moved into resumption
    if (op != NULL && op->opfun != NULL) {
      // push a scoped frame if necessary
      if (op->opkind >= LH_OP_SCOPED) {
        hstack_push_scoped(hs, resume);

        assert((void*)&resume->lhresume == (void*)resume);
        void (*op_fn)(void*, uint8_t*, lh_resume, lh_value) = op->opfun->function_ptr;
        op_fn(&res, &op->opfun->closure, &resume->lhresume, res);
        assert(hs == &__hstack);

        hstack_pop(hs, op->opkind == LH_OP_SCOPED);
      } else {
        // and call the operation handler
        void (*op_fn)(void*, uint8_t*, lh_resume, lh_value) = op->opfun->function_ptr;
        op_fn(&res, &op->opfun->closure, &resume->lhresume, res);
      }
    }
    return res;
  } else {
    // we set up the handler, now call the action
    lh_value res;
    lh_resultfun* resfun = NULL;

    void (*action_fn)(void*, uint8_t*, lh_value) = action->function_ptr;
    action_fn(&res, &action->closure, arg);
    assert(hs == &__hstack);
    h = (effecthandler*)hstack_top(hs);  // re-load our handler since the handler stack could have been reallocated
#ifndef NDEBUG
    assert(id == h->id);
    assert(hdef == h->hdef);
    assert(base == h->stackbase);
#endif
    // pop our handler
    resfun = h->hdef->resultfun;
    hstack_pop(hs, true);
    if (resfun != NULL) {
      void (*ret_fn)(void*, uint8_t*, lh_value) = resfun->function_ptr;
      ret_fn(&res, &resfun->closure, res);
    }
    return res;
  }
}

// `handle_upto` installs a handler on the stack with a given stack `base`.
static __noinline lh_value handle_upto(hstack* hs, void* base, const lh_handlerdef* def,
                                       lh_actionfun* action, lh_value arg) {
  // allocate handler frame on the stack so it will be part of a captured continuation
  effecthandler* h = hstack_push_effect(hs, def, base);
  fragment* fragment;
  lh_value res;

  res = handle_with(hs, h, action, arg);
  fragment = hstack_pop_fragment(hs);
  // after returning, check if there is a fragment frame we should jump to..
  if (fragment != NULL) {
    jumpto_fragment(fragment, res);
  }
  // otherwise just return normally
  return res;
}

// `handle` installs a new handler on the stack and calls the given `action` with argument `arg`.
__noinline lh_value lh_handle(const lh_handlerdef* def, lh_actionfun* action, lh_value arg) {
  void* base = NULL;  // get_stack_top();
  hstack* hs = &__hstack;
  lh_value res;
  LH_INIT(hs)
  res = handle_upto(hs, &base, def, action, arg);
  LH_DONE(hs)
  return res;
}

/*-----------------------------------------------------------------
  Linear handlers only have tail resume operations that do not exit themselves.
  In that case we never have to capture a first-class resumption
  and we can make them more convenient with block structured
  macros.
-----------------------------------------------------------------*/

ptrdiff_t _lh_linear_handler_init(const lh_handlerdef* hdef,  bool* init) {
  hstack* hs = &__hstack;
  bool _init = lh_init(hs);
  if (init != NULL) *init = _init;
  effecthandler* h = hstack_push_effect(hs, hdef, NULL /*no base*/);
  return h->id;
}

void _lh_linear_handler_done(ptrdiff_t id, bool init, bool do_release) {
  hstack* hs = &__hstack;
#ifndef NDEBUG
  handler* top = hstack_top(hs);
  assert(is_effecthandler(top));
  assert(((effecthandler*)top)->id == id);
#endif
  hstack_pop(hs, do_release);
  if (init) lh_done(hs);
}

// Effect declaration for defer (defined as macros in libhandler.h)
LH_DEFINE_EFFECT0(defer)

// Default operation declaration for implicit parameters (define in libhandler.h)
// Just a default definition, as the actual implementation uses `lh_yield_local`.
lh_value _lh_implicit_get(lh_resume r, lh_value arg) {
  return lh_tail_resume(r, arg);
}

/*-----------------------------------------------------------------
  Yield an operation
-----------------------------------------------------------------*/

// `yieldop` yields to the first enclosing handler that can handle
//   operation `optag` and passes it the argument `arg`.
static lh_value yieldop(lh_effect optag, lh_value arg) {
  // find the operation handler along the handler stack
  hstack* hs = &__hstack;
  count skipped;
  const lh_handlerdef* op;
  effecthandler* h = hstack_find(hs, optag, &op, &skipped);

  // No resume (i.e. like `throw`)
  if (op->opkind <= LH_OP_NORESUME) {
    yield_to_handler(hs, h, NULL, op, arg, op_is_release(op));
  }

  // Tail resumptions
  else if (op->opkind <= LH_OP_TAIL) {
    // setup up a stack allocated tail resumption
    tailresume r;
    r.lhresume.rkind = TailResume;
    r.resumed = false;
    assert((void*)(&r.lhresume) == (void*)&r);
    lh_value res;
    if (op->opkind != LH_OP_TAIL_NOOP) {
      // push a skip frame
      hstack_push_skip(hs, skipped);
      count hidx = hstack_indexof(hs, to_handler(h));

      // call the operation handler directly for a tail resumption
      void (*op_fn)(void*, uint8_t*, lh_resume, lh_value) = op->opfun->function_ptr;
      op_fn(&res, &op->opfun->closure, &r.lhresume, arg);
      h = (effecthandler*)hstack_at(hs, hidx);
      assert(is_effecthandler(to_handler(h)));

      assert(!hstack_empty(hs));
      assert(is_skiphandler(hstack_top(hs)));
      hstack_pop(hs, false);  // skip frames need no release
    }
    // OP_TAIL_NOOP: will not call operations so no need for a skip frame
    // call the operation function and return directly (as it promised to tail resume)
    else {
      void (*op_fn)(void*, uint8_t*, lh_resume, lh_value) = op->opfun->function_ptr;
      op_fn(&res, &op->opfun->closure, &r.lhresume, arg);
    }

    // if we returned from a `lh_tail_resume` we just return its result
    if (r.resumed) {
      return res;
    }
    // otherwise no resume was called; yield back to the handler with the result.
    else {
      yield_to_handler(hs, h, NULL, NULL, res, true);
    }
  }

  // In general, capture a resumption and yield to the handler
  else {
    return capture_resume_yield(hs, h, op, arg);
  }

  assert(false);
  return lh_value_null;
}

// Yield to the first enclosing handler that can handle
// operation `optag` and pass it the argument `arg`.
lh_value lh_yield(lh_effect optag, lh_value arg) {
#ifdef _DEBUG_STATS
  stats.operations++;
#endif
  return yieldop(optag, arg);
}

/*-----------------------------------------------------------------
  Get the local state of a handler
-----------------------------------------------------------------*/

// `lh_yield_local` yields to the first enclosing handler for
// operation `optag` and returns its local state. This should be used
// with care as it violates the encapsulation principle but works
// well for implicit parameters and to reduce the number of explicit
// operations for many effects.
lh_value lh_yield_local(lh_effect optag) {
  // find the operation handler along the handler stack
  hstack* hs = &__hstack;
  count skipped;
  lh_handlerdef* op;
  effecthandler* h = hstack_find(hs, optag, &op, &skipped);
  // and return the local state
  return 0;
}

/*-----------------------------------------------------------------
  Passing multiple arguments
-----------------------------------------------------------------*/

// Get a pointer to values passed by stack reference in an operation handler
void* lh_cstack_ptr(lh_resume r, void* p) {
  if (r->rkind == TailResume) return p;
  assert(r->rkind == GeneralResume || r->rkind == ScopedResume);
  cstack* cs = &((resume*)r)->cstack;
  ptrdiff_t delta = ptrdiff(cs->frames, cs->base);
  byte* q = (byte*)p + delta;
  assert(q >= cs->frames && q < cs->frames + cs->size);
  // paranoia: check that the new pointer is indeed in the captured stack
  if (q >= cs->frames && q < cs->frames + cs->size) {
    return q;
  } else {
    return p;
  }
}

// Yield N arguments to an operation
lh_value lh_yieldN(lh_effect optag, int argcount, ...) {
  assert(argcount >= 0);
  va_list ap;
  va_start(ap, argcount);
  // note: allocated on the stack; use `lh_cstack_ptr` to retrieve in the operation handler.
  yieldargs* yargs = (yieldargs*)lh_alloca(sizeof(yieldargs) + (argcount * sizeof(lh_value)));
  yargs->argcount = argcount;
  int i = 0;
  while (i < argcount) {
    yargs->args[i] = va_arg(ap, lh_value);
    i++;
  }
  assert(i == argcount);
  yargs->args[i] = lh_value_null;  // sentinel value
  va_end(ap);
  return lh_yield(optag, lh_value_yieldargs(yargs));
}

/*-----------------------------------------------------------------
  Resume
-----------------------------------------------------------------*/

// Cast to a first class resumption.
static resume* to_resume(lh_resume r) {
  if (r->rkind == TailResume) fatal(EINVAL, "Trying to generally resume a tail-resumption");
  return (resume*)r;
}

static __noinline lh_value lh_release_resume_(resume* r, lh_value resarg) {
  hstack* hs = &__hstack;
  lh_value res;
  LH_INIT(hs)
  res = capture_resume_call(&__hstack, r, resarg);
  LH_DONE(hs)
  return res;
}

lh_value __noinline lh_call_resume(lh_resume r, lh_value res) {
  return lh_release_resume_(resume_acquire(to_resume(r)), res);
}

lh_value lh_scoped_resume(lh_resume r, lh_value res) {
  return lh_call_resume(r, res);
}

__noinline lh_value lh_release_resume(lh_resume r, lh_value res) {
  if (r->rkind == ScopedResume) {
    return lh_scoped_resume(r, res);
  } else {
    return lh_release_resume_(to_resume(r), res);
  }
}

lh_value lh_tail_resume(lh_resume r, lh_value res) {
  if (r->rkind == TailResume) {
    tailresume* tr = (tailresume*)(r);
    tr->resumed = true;
    return res;
  } else if (r->rkind == ScopedResume) {
    return lh_scoped_resume(r,  res);
  } else {
    return lh_release_resume(r,  res);
  }
}

static void _lh_release(resume* r) {
  resume_release(r);
}

void __noinline lh_release(lh_resume r) {
  if (r->rkind != TailResume) _lh_release(to_resume(r));
}

void lh_nothing() {}

// Convert function pointers to lh_values's;
// ISO C doesn't allow casting from pointers to function pointers
// but we assume it is ok to do this for our target platforms.
lh_value lh_value_from_fun_ptr(lh_voidfun* fun) {
  void** pfun = (void**)&fun;
  return lh_value_ptr(*pfun);
}

lh_voidfun* lh_fun_ptr_value(lh_value v) {
  void* p = lh_ptr_value(v);
  lh_voidfun** pfun = (lh_voidfun**)&p;
  return *pfun;
}
