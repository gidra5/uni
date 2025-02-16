#include <stdio.h>
#include <stdint.h>

struct symbol_metadata_t
{
  char *name;
};

extern struct symbol_metadata_t *symbols_metadata;

int print_int(int x)
{
  printf("%i\n", x);
  return x;
}

float print_float(float x)
{
  printf("%f\n", x);
  return x;
}

char *print_string(char *x)
{
  printf("%s\n", x);
  return x;
}

void *print_symbol(void *x)
{
  struct symbol_metadata_t sym = symbols_metadata[(uint64_t)x];
  printf("Symbol(%s)\n", sym.name);
  return x;
}