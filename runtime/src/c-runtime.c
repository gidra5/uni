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

typedef struct {
  void* function_ptr;
  uint8_t closure[0];
} closure_t;

enum type_t {
  TYPE_INT = 1,
  TYPE_FLOAT = 2,
  TYPE_STRING = 3,
  TYPE_SYMBOL = 4,
  TYPE_BOOLEAN = 5,
  TYPE_TUPLE = 6,
  TYPE_POINTER = 7,
  TYPE_FUNCTION = 8,
  TYPE_ARRAY = 9,
  TYPE_VOID = 10,
  TYPE_UNKNOWN = 11,
};

struct int_type_metadata_t {
  const int size;
};

struct float_type_metadata_t {
  const int size;
};

struct string_type_metadata_t {
  const int size;
};

struct tuple_type_metadata_t {
  const struct type_metadata_t* types;
  const int count;
};

struct pointer_type_metadata_t {
  const struct type_metadata_t* type;
};

// struct function_type_metadata_t {
//   struct type_metadata_t* ret;

//   int args_count;
//   struct type_metadata_t* args;

//   int closure_count;
//   struct type_metadata_t* closure;
// };

struct type_metadata_t {
  const enum type_t type;
  const union {
    struct int_type_metadata_t _int;
    struct float_type_metadata_t _float;
    struct string_type_metadata_t string;
    struct tuple_type_metadata_t tuple;
    struct pointer_type_metadata_t pointer;
    // struct function_type_metadata_t function;
  } metadata;
};

const struct type_metadata_t _bool = {
  .type = TYPE_BOOLEAN,
};
const struct type_metadata_t _int = {
  .type = TYPE_INT,
  .metadata._int.size = 32,
};
const struct type_metadata_t _float = {
  .type = TYPE_FLOAT,
  .metadata._float.size = 64,
};
const struct type_metadata_t _string = {
  .type = TYPE_STRING,
  .metadata.string.size = 8,
};
const struct type_metadata_t _tuple_types[2] = {
  {
    .type = TYPE_INT,
    .metadata._int.size = 32,
  },
  {
    .type = TYPE_STRING,
    .metadata.string.size = 8,
  },
};
const struct type_metadata_t _tuple = {
  .type = TYPE_TUPLE,
  .metadata.tuple.count = 2,
  .metadata.tuple.types = _tuple_types,
};
const struct type_metadata_t _pointer = {
  .type = TYPE_POINTER,
  .metadata.pointer.type = &_int,
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

int type_alignment(const struct type_metadata_t type);
int max_alignment(int count, const struct type_metadata_t* types) {
  int alignment = 0;
  for (int i = 0; i < count; i++) {
    alignment = max(alignment, type_alignment(types[i]));
  }
  return alignment;
}

int type_alignment(const struct type_metadata_t type) {
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

int type_size(const struct type_metadata_t type) {
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
  const struct type_metadata_t* types
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
  const char* name;
};

extern const struct symbol_metadata_t* symbols_metadata;

void print_symbol(uint64_t x) {
  struct symbol_metadata_t sym = symbols_metadata[x];
  printf("symbol(%s)", sym.name);
}