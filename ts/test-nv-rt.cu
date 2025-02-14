#include <stdio.h>

__global__ void cuda_hello_kernel()
{
  printf("Hello World from GPU!\n");
}

extern "C" int cuda_hello()
{
  cuda_hello_kernel<<<1, 1>>>();
  cudaDeviceSynchronize();
  return 0;
}

// int main()
// {
//   return cuda_hello();
// }