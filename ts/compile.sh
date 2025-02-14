clang-18 test-rt.c test-nv-rt.cu test.ll -o test --cuda-gpu-arch=sm_75 \
  -L/usr/local/cuda/lib64 \
  -lcudart_static \
  -ldl \
  -lrt \
  -lpthread \
  -Wno-unknown-cuda-version \
  -Wno-override-module