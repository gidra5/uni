// A lock-free, concurrent, generic queue in 32 bits
//
// This is a bit of a mess since I wanted to hit many different combinations
// of implementations with the same code, especially under TSan:
//
// impl  threads  atom target cmd
// ----  -------  ---- ------ ----------
// Clang pthreads C11  spsc   clang -O3 -DNTHR=1 queue.c
// Clang pthreads C11  spmc   clang -O3 -DNTHR=2 queue.c
//
// Also multiply that by multiple operating systems (Linux, Windows, BSD).
//
// Ref: https://nullprogram.com/blog/2022/05/14/
// This is free and unencumbered software released into the public domain.
#include <stdatomic.h>
#include <stdint.h>

// Return the array index for then next value to be pushed. The size of this
// array must be (1 << exp) elements. Write the value into this array index,
// then commit it. With a single-consumer queue, this element store need not
// be atomic. The value will appear in the queue after the commit. Returns
// -1 if the queue is full.
static int
queue_push(_Atomic uint32_t *q, int exp) {
  uint32_t r = *q;

  int mask = (1u << exp) - 1;
  int head = r & mask;
  int tail = r >> 16 & mask;
  int next = (head + 1u) & mask;
  if (r & 0x8000) {  // avoid overflow on commit
    *q &= ~0x8000;
  }
  return next == tail ? -1 : head;
}

// Commits and completes the push operation. Do this after storing into the
// array. This operation cannot fail.
static void
queue_push_commit(_Atomic uint32_t *q) {
  *q += 1;
}

// Return the array index for the next value to be popped. The size of this
// array must be (1 << exp) elements. Read from this array index, then
// commit the pop. This element load need not be atomic. The value will be
// removed from the queue after the commit. Returns -1 if the queue is
// empty.
static int
queue_pop(_Atomic uint32_t *q, int exp) {
  uint32_t r = *q;
  int mask = (1u << exp) - 1;
  int head = r & mask;
  int tail = r >> 16 & mask;
  return head == tail ? -1 : tail;
}

// Commits and completes the pop operation. Do this after loading from the
// array. This operation cannot fail.
static void
queue_pop_commit(_Atomic uint32_t *q) {
  *q += 0x10000;
}

// Like queue_pop() but for multiple-consumer queues. The element load must
// be atomic since it is concurrent with the producer's push, though it can
// use a relaxed memory order. The loaded value must not be used unless the
// commit is successful. Stores a temporary "save" to be used at commit.
static int
queue_mpop(_Atomic uint32_t *q, int exp, uint32_t *save) {
  uint32_t r = *save = *q;
  int mask = (1u << exp) - 1;
  int head = r & mask;
  int tail = r >> 16 & mask;
  return head == tail ? -1 : tail;
}

// Like queue_pop_commit() but for multiple-consumer queues. It may fail if
// another consumer pops concurrently, in which case the pop must be retried
// from the beginning.
static _Bool
queue_mpop_commit(_Atomic uint32_t *q, uint32_t save) {
  return atomic_compare_exchange_strong(q, &save, save + 0x10000);
}