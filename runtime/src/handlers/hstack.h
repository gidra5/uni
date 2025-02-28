#pragma once
#ifndef __hstack_h
#define __hstack_h

#include "./libhandler.h"
#include "./cenv.h"
#include "./types.h"

#include <assert.h>  // assert

// forward
static handler* hstack_at(const hstack* hs, count idx);

#define HSTACK_DYNAMIC

#ifdef HSTACK_DYNAMIC

#define HMINSIZE (32 * sizeof(effecthandler))
#define HMAXEXPAND (2 * 1024 * 1024)

// forward
static handler* hstack_at(const hstack* hs, count idx);

// Initialize a handler stack
static void hstack_init(hstack* hs) {
  hs->count = 0;
  hs->size = 0;
  hs->hframes = NULL;
  hs->top = hstack_at(hs, 0);
}

static count hstack_topsize(const hstack* hs);
static void* checked_realloc(void* p, size_t size);

static count hstack_goodsize(count needed) {
  if (needed > HMAXEXPAND) {
    return (HMAXEXPAND * ((needed + HMAXEXPAND - 1) / HMAXEXPAND));  // round up to next HMAXEXPAND
  } else {
    count newsize;
    for (newsize = HMINSIZE; newsize < needed; newsize *= 2) {
    }  // round up to next power of 2
    return newsize;
  }
}

// Reallocate the hstack
static void hstack_realloc_(ref hstack* hs, count needed) {
  count newsize = hstack_goodsize(needed);
  count topsize = hstack_topsize(hs);
  hs->hframes = (byte*)checked_realloc(hs->hframes, newsize);
  hs->size = newsize;
  hs->top = hstack_at(hs, topsize);
#ifdef _STATS
  if (newsize > stats.hstack_max) stats.hstack_max = newsize;
#endif
}

// Ensure the handler stack is big enough for `extracount` handlers.
static handler* hstack_ensure_space(ref hstack* hs, count extracount) {
  count needed = hs->count + extracount;
  if (needed > hs->size) {
    hstack_realloc_(hs, needed);
  }
  return hstack_at(hs, 0);
}

#else

#define HSIZE (4096 * sizeof(effecthandler))

// forward
static handler* hstack_at(const hstack* hs, count idx);

// Initialize a handler stack
static void hstack_init(hstack* hs) {
  hs->count = 0;
  hs->size = HSIZE;
  hs->hframes = NULL;
  hs->top = hstack_at(hs, 0);
}

// Ensure the handler stack is big enough for `extracount` handlers.
inline static handler* hstack_ensure_space(ref hstack* hs, count extracount) {
  count needed = hs->count + extracount;
  assert(needed <= HSIZE);
  return hstack_at(hs, 0);
}

#endif

#endif  // __hstack_h