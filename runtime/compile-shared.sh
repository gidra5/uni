SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
SRC_DIR=$SCRIPT_DIR/src
BUILD_DIR=$SCRIPT_DIR/build
HANDLER_DIR=$SRC_DIR/handlers
LIB_QUEUE=$SCRIPT_DIR/queue/queue.c

mkdir -p $BUILD_DIR
clang-18 $SRC_DIR/c-runtime.c -o $BUILD_DIR/c-runtime.ll -emit-llvm -S
clang-18 $SRC_DIR/c-runtime.c -o $BUILD_DIR/c-runtime-o3.ll -emit-llvm -S -O3

clang-18 -O3 \
  -shared $SRC_DIR/c-runtime.c \
    $HANDLER_DIR/libhandler.c \
    $HANDLER_DIR/asm/setjmp_amd64.s \
    $LIB_QUEUE \
  -o $BUILD_DIR/c-runtime.so -fPIC
# clang-18 -shared $SRC_DIR/nv-runtime.cu -o $BUILD_DIR/nv-runtime.so --cuda-gpu-arch=sm_75 \
#   -L/usr/local/cuda/lib64 \
#   -lcudart_static \
#   -ldl \
#   -lrt \
#   -lpthread \
#   -fPIC \
#   -Wno-unknown-cuda-version