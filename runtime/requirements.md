Needs CUDA runtime to be installed, as well as LLVM toolchain.
Current script assumes gpu architecture is sm_75, which is RTX 30xx series.

also inside `/runtime` clone and compile [`libhandler`](https://github.com/koka-lang/libhandler/tree/master) with 
```
git clone git@github.com:koka-lang/libhandler.git
cd libhandler
./configure --cc=clang-18
make depend VARIANT=release
make VARIANT=release
```

run `compile-shared.sh` to build shared libraries.