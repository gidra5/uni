// A lock-free, concurrent, generic queue in 32 bits
//
// This is a bit of a mess since I wanted to hit many different combinations
// of implementations with the same code, especially under TSan:
//
// impl  threads  atom target cmd
// ----  -------  ---- ------ ----------
// GCC   pthreads C11  spsc   gcc -O3 -DNTHR=1 -DPTHREADS queue.c
// GCC   pthreads GNU  spsc   gcc -O3 -std=c99 -DNTHR=1 -DPTHREADS queue.c
// GCC   win32    C11  spsc   gcc -O3 -DNTHR=1 queue.c
// GCC   win32    GNU  spsc   gcc -O3 -std=c99 -DNTHR=1 queue.c
// GCC   pthreads C11  spmc   gcc -O3 -DNTHR=2 -DPTHREADS queue.c
// GCC   pthreads GNU  spmc   gcc -O3 -std=c99 -DNTHR=2 -DPTHREADS queue.c
// GCC   win32    C11  spmc   gcc -O3 -DNTHR=2 queue.c
// GCC   win32    GNU  spmc   gcc -O3 -std=c99 -DNTHR=2 queue.c
// Clang pthreads C11  spsc   clang -O3 -DNTHR=1 -DPTHREADS queue.c
// Clang pthreads GNU  spsc   clang -O3 -std=c99 -DNTHR=1 -DPTHREADS queue.c
// Clang win32    C11  spsc   clang -O3 -DNTHR=1 queue.c
// Clang win32    GNU  spsc   clang -O3 -std=c99 -DNTHR=1 queue.c
// Clang pthreads C11  spmc   clang -O3 -DNTHR=2 -DPTHREADS queue.c
// Clang pthreads GNU  spmc   clang -O3 -std=c99 -DNTHR=2 -DPTHREADS queue.c
// Clang win32    C11  spmc   clang -O3 -DNTHR=2 queue.c
// Clang win32    GNU  spmc   clang -O3 -std=c99 -DNTHR=2 queue.c
// MSC   win32    MSC  spsc   cl /Ox /DNTHR=1 queue.c
// MSC   win32    MSC  spmc   cl /Ox /DNTHR=2 queue.c
//
// Also multiply that by multiple operating systems (Linux, Windows, BSD).
//
// Ref: https://nullprogram.com/blog/2022/05/14/
// This is free and unencumbered software released into the public domain.
#include <stdint.h>
#include <stdio.h>

#include "./queue.h"

#define NVALS 1000000
#define QEXP 6
#define NTHR 2

// Threads
#include <pthread.h>
#include <stdatomic.h>

struct task {
  _Atomic uint32_t *q;
#if NTHR > 1
  _Atomic
#endif
      uint64_t *slots;
  uint64_t result;
};

static void *
worker(void *arg) {
  struct task *t = arg;
  _Atomic uint32_t *q = t->q;
  uint64_t sum = 0;
  for (;;) {
    int i;
    uint64_t v;
#if NTHR == 1
    do {
      i = queue_pop(q, QEXP);
    } while (i < 0);
    v = t->slots[i];
    queue_pop_commit(q);
#else
    uint32_t save;
    do {
      do {
        i = queue_mpop(q, QEXP, &save);
      } while (i < 0);
#if ATOMIC_VENDOR
      v = ATOMIC_RLOAD(t->slots + i);
#else
      v = atomic_load_explicit(t->slots + i, memory_order_relaxed);
#endif
    } while (!queue_mpop_commit(q, save));
#endif

    if (!v) {
      t->result = sum;
      return 0;
    }
    sum += v;
  }
}

int main(void) {
  printf("Using %d pthreads threads, C11 atomics\n", NTHR);

  _Atomic uint32_t q = 0;
  pthread_t thr[NTHR];
  struct task tasks[NTHR];
#if NTHR > 1
  _Atomic
#endif
      uint64_t slots[1 << QEXP];

  for (int n = 0; n < NTHR; n++) {
    tasks[n].q = &q;
    tasks[n].slots = slots;
    pthread_create(thr + n, 0, worker, tasks + n);
  }

  uint64_t sum = 0;
  for (int n = 0; n < NVALS; n++) {
    uint64_t x = -n - 1;
    x *= 1111111111111111111U;
    x ^= x >> 32;
    x *= 1111111111111111111U;
    x ^= x >> 32;
    int i;
    do {
      i = queue_push(&q, QEXP);
    } while (i < 0);
    sum += x;
#if NTHR == 1
    slots[i] = x;
#elif ATOMIC_VENDOR
    ATOMIC_STORE(slots + i, x);
#else
    atomic_store_explicit(slots + i, x, memory_order_relaxed);
#endif
    queue_push_commit(&q);
  }
  printf("%016llx\n", (unsigned long long)sum);

  for (int n = 0; n < NTHR; n++) {
    int i;
    do {
      i = queue_push(&q, QEXP);
    } while (i < 0);
    slots[i] = 0;
    queue_push_commit(&q);
  }

  sum = 0;
  for (int n = 0; n < NTHR; n++) {
    pthread_join(thr[n], 0);
    sum += tasks[n].result;
  }
  printf("%016llx\n", (unsigned long long)sum);
}