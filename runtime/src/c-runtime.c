#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

#define assert_msg(x, msg) \
  printf(msg);             \
  assert(x);

#define unreachable(x) assert_msg(false, "\n\nUNREACHABLE: " x "\n")
#define _assert(x, msg) assert_msg(false, "\n\nASSERTION FAILED: " x "\n")
#define max(a, b) ((a) > (b) ? (a) : (b))

enum type_t {
  TYPE_INT = 1,
  TYPE_FLOAT = 2,
  TYPE_STRING = 3,
  TYPE_SYMBOL = 4,
  TYPE_BOOLEAN = 5,
  TYPE_TUPLE = 6,
  TYPE_POINTER = 7,
  // TYPE_FUNCTION,
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
  struct type_metadata_t* types;
};

struct pointer_type_metadata_t {
  struct type_metadata_t* type;
};

// struct function_type_metadata_t {
//   struct type_metadata_t* ret;

//   int args_count;
//   struct type_metadata_t* args;

//   int closure_count;
//   struct type_metadata_t* closure;
// };

struct type_metadata_t {
  enum type_t type;
  union {
    struct int_type_metadata_t _int;
    struct float_type_metadata_t _float;
    struct string_type_metadata_t string;
    struct tuple_type_metadata_t tuple;
    struct pointer_type_metadata_t pointer;
    // struct function_type_metadata_t function;
  } metadata;
};

// struct type_metadata_t function_closure_type(
//   struct function_type_metadata_t type
// ) {
//   struct type_metadata_t closure_type = {
//     .type = TUPLE,
//     .metadata.tuple.count = type.closure_count,
//     .metadata.tuple.types = type.closure
//   };
//   return closure_type;
// }

int type_alignment(struct type_metadata_t type);
int max_alignment(int count, struct type_metadata_t* types) {
  int alignment = 0;
  for (int i = 0; i < count; i++) {
    alignment = max(alignment, type_alignment(types[i]));
  }
  return alignment;
}

int type_alignment(struct type_metadata_t type) {
  switch (type.type) {
    case TYPE_INT:
      return type.metadata._int.size;
    case TYPE_FLOAT:
      return type.metadata._float.size;
    case TYPE_STRING:
      return 8;
    case TYPE_BOOLEAN:
      return 1;
    case TYPE_TUPLE: {
      return max_alignment(
        type.metadata.tuple.count, type.metadata.tuple.types
      );
    }
    case TYPE_POINTER:
      return 8;
    // case TYPE_FUNCTION:
    //   struct type_metadata_t closure = {
    //     .type = TUPLE,
    //     .metadata.tuple.count = type.metadata.function.closure_count,
    //     .metadata.tuple.types = type.metadata.function.closure
    //   };
    //   return type_size(closure) + 8;
    default:
      unreachable("cant compute type size");
  }
}

int type_size(struct type_metadata_t type) {
  switch (type.type) {
    case TYPE_INT:
      return type.metadata._int.size;
    case TYPE_FLOAT:
      return type.metadata._float.size;
    case TYPE_STRING:
      return 8;
    case TYPE_BOOLEAN:
      return 1;
    case TYPE_TUPLE: {
      int size = 0;
      int prev_alignment = type_alignment(type.metadata.tuple.types[0]);
      for (int i = 0; i < type.metadata.tuple.count; i++) {
        int alignment = type_alignment(type.metadata.tuple.types[i]);

        if (alignment > prev_alignment) {
          int padding = alignment - (size % alignment);
          size += padding + type_size(type.metadata.tuple.types[i]);
        } else {
          size += type_size(type.metadata.tuple.types[i]);
        }

        prev_alignment = alignment;
      }
      return size;
    }
    case TYPE_POINTER:
      return 8;
    // case TYPE_FUNCTION:
    //   struct type_metadata_t closure = {
    //     .type = TUPLE,
    //     .metadata.tuple.count = type.metadata.function.closure_count,
    //     .metadata.tuple.types = type.metadata.function.closure
    //   };
    //   return type_size(closure) + 8;
    default:
      unreachable("cant compute type size");
  }
}

void* get_element_ptr(
  void* x,
  int index,
  int count,
  struct type_metadata_t* types
) {
  assert(index < count);

  int size = 0;
  int alignment = type_alignment(types[0]);
  for (int i = 0; i < count; i++) {
    if (i == index)
      return (char*)x + size;

    size += type_size(types[i]);

    int next_alignment = type_alignment(types[i + 1]);
    if (next_alignment > alignment)
      size += next_alignment - (size % next_alignment);

    alignment = next_alignment;
  }

  unreachable("cant get element ptr");
}

struct symbol_metadata_t {
  char* name;
};

extern struct symbol_metadata_t* symbols_metadata;

void print_int(int x) {
  printf("%i", x);
}

void print_float(float x) {
  printf("%f", x);
}

void print_string(char* x) {
  printf("%s", x);
}

void print_symbol(uint64_t x) {
  struct symbol_metadata_t sym = symbols_metadata[x];
  printf("Symbol(%s)", sym.name);
}

void print_bool(bool x) {
  printf("%s", x ? "true" : "false");
}

// void print_function(void* x, struct function_type_metadata_t type) {
//   int closure_size = type_size(function_closure_type(type));

//   void* fn = x;
//   x = (void*)((char*)x + 8);

//   printf("Function[");

//   if (type.closure_count > 0) {
//     print_by_type(x, type.closure[0]);
//     x = (char*)x + type_size(type.closure[0]);
//   }

//   for (int i = 1; i < type.closure_count; i++) {
//     printf(", ");
//     print_by_type(x, type.closure[i]);
//     x = (char*)x + type_size(type.closure[i]);
//   }

//   printf("](%p)\n", *(void**)x);
// }

void print_by_type(void* x, struct type_metadata_t type);

void print_tuple(void* x, int count, struct type_metadata_t* types) {
  printf("Tuple(");

  for (int i = 0; i < count; i++) {
    if (i > 0)
      printf(", ");

    void* element_ptr = get_element_ptr(x, i, count, types);
    print_by_type(element_ptr, types[i]);
  }

  printf(")");
}

void print_by_type(void* x, struct type_metadata_t type) {
  switch (type.type) {
    case TYPE_INT:
      print_int(*(int*)x);
      break;
    case TYPE_FLOAT:
      print_float(*(float*)x);
      break;
    case TYPE_STRING:
      print_string(*(char**)x);
      break;
    case TYPE_BOOLEAN:
      print_bool(*(bool*)x);
      break;
    case TYPE_SYMBOL:
      print_symbol(*(uint64_t*)x);
      break;
    case TYPE_TUPLE:
      print_tuple(x, type.metadata.tuple.count, type.metadata.tuple.types);
      break;
    case TYPE_POINTER:
      printf("Pointer(%p)", x);
      break;
    // case TYPE_FUNCTION:
    //   print_function(x, type.metadata.function);
    //   break;
    default:
      unreachable("cant print by type");
  }
}