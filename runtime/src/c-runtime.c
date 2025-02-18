#include <stdio.h>
#include <stdint.h>

enum type_t {
  INT,
  FLOAT,
  STRING,
  SYMBOL,
  TUPLE,
  POINTER,
  FUNCTION,
};

struct int_type_metadata_t {
  int size;
};

struct float_type_metadata_t {
  int size;
};

struct string_type_metadata_t {
  int size;
};

struct tuple_type_metadata_t {
  int count;
  enum type_t *types;
};

struct pointer_type_metadata_t {
  struct type_metadata_t *type;
};

struct function_type_metadata_t {
  struct type_metadata_t *ret;
  int args_count;
  struct type_metadata_t *args;
  int closure_count;
  struct type_metadata_t *closure;
};

struct type_metadata_t {
  enum type_t type;
  union {
    struct int_type_metadata_t _int;
    struct float_type_metadata_t _float;
    struct string_type_metadata_t string;
    struct tuple_type_metadata_t tuple;
    struct pointer_type_metadata_t pointer;
    struct function_type_metadata_t function;
  } metadata;
};

struct type_metadata_t function_closure_type(struct function_type_metadata_t type) {
  struct type_metadata_t closure_type = {
      .type = TUPLE,
      .metadata.tuple.count = type.closure_count,
      .metadata.tuple.types = type.closure};
  return closure_type;
}

int type_size(struct type_metadata_t type) {
  switch (type.type) {
    case INT:
      return type.metadata._int.size;
    case FLOAT:
      return type.metadata._float.size;
    case STRING:
      return type.metadata.string.size;
    case TUPLE:
      return type.metadata.tuple.count;
    case POINTER:
      return 8;
    case FUNCTION:
      struct type_metadata_t closure = {
          .type = TUPLE,
          .metadata.tuple.count = type.metadata.function.closure_count,
          .metadata.tuple.types = type.metadata.function.closure};
      return type_size(closure) + 8;
    default:
      unreachable("cant compute type size");
  }
}

struct symbol_metadata_t
{
  char *name;
};

extern struct symbol_metadata_t *symbols_metadata;

void print_int(int x) {
  printf("%i\n", x);
}

void print_float(float x) {
  printf("%f\n", x);
}

void print_string(char *x) {
  printf("%s\n", x);
}

void print_symbol(uint64_t x) {
  struct symbol_metadata_t sym = symbols_metadata[x];
  printf("Symbol(%s)\n", sym.name);
}

void print_function(void *x, struct function_type_metadata_t type) {
  int closure_size = type_size(
      function_closure_type(type));

  void *fn = x;
  x = (void *)((char *)x + 8);

  printf("Function[");

  if (type.closure_count > 0) {
    print_by_type(x, type.closure[0]);
    x += type_size(type.closure[0]);
  }

  for (int i = 1; i < type.closure_count; i++) {
    printf(", ");
    print_by_type(x, type.closure[i]);
    x += type_size(type.closure[i]);
  }

  printf("](%p)\n", *(void **)x);
}

void print_tuple(void *x, int count, struct type_metadata_t *types) {
  printf("Tuple(");

  for (int i = 0; i < count; i++) {
    if (i > 0) printf(", ");
    print_by_type(x, types[i]);
    x += type_size(types[i]);
  }

  printf(")\n");
}

void print_by_type(void *x, struct type_metadata_t type) {
  switch (type.type) {
    case INT:
      print_int(*(int *)x);
      break;
    case FLOAT:
      print_float(*(float *)x);
      break;
    case STRING:
      print_string(*(char **)x);
      break;
    case SYMBOL:
      print_symbol(*(uint64_t *)x);
      break;
    case TUPLE:
      print_tuple(x, type.metadata.tuple.count, type.metadata.tuple.types);
      break;
    case POINTER:
      printf("Pointer(%p)\n", x);
      break;
    case FUNCTION:
      print_function(x, type.metadata.function);
      break;
    default:
      unreachable("cant print by type");
  }
}