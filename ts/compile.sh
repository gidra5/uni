../runtime/compile-shared.sh

clang-18 -pipe ../runtime/build/c-runtime.so ../runtime/build/nv-runtime.so test.ll \
  -o test \
  -Wno-override-module 