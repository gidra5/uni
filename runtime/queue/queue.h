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
int queue_push(_Atomic uint32_t *q, int exp);

// Commits and completes the push operation. Do this after storing into the
// array. This operation cannot fail.
void queue_push_commit(_Atomic uint32_t *q);

// Return the array index for the next value to be popped. The size of this
// array must be (1 << exp) elements. Read from this array index, then
// commit the pop. This element load need not be atomic. The value will be
// removed from the queue after the commit. Returns -1 if the queue is
// empty.
int queue_pop(_Atomic uint32_t *q, int exp);

// Commits and completes the pop operation. Do this after loading from the
// array. This operation cannot fail.
void queue_pop_commit(_Atomic uint32_t *q);

// Like queue_pop() but for multiple-consumer queues. The element load must
// be atomic since it is concurrent with the producer's push, though it can
// use a relaxed memory order. The loaded value must not be used unless the
// commit is successful. Stores a temporary "save" to be used at commit.
int queue_mpop(_Atomic uint32_t *q, int exp, uint32_t *save);

// Like queue_pop_commit() but for multiple-consumer queues. It may fail if
// another consumer pops concurrently, in which case the pop must be retried
// from the beginning.
_Bool queue_mpop_commit(_Atomic uint32_t *q, uint32_t save);