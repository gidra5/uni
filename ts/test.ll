@symbols_metadata_array = global [0 x { i8* }] []
@symbols_metadata = global ptr @symbols_metadata_array

; enum type_t {
;   TYPE_INT = 1,
;   TYPE_FLOAT = 2,
;   TYPE_STRING = 3,
;   TYPE_SYMBOL = 4,
;   TYPE_BOOLEAN = 5,
;   TYPE_TUPLE = 6,
;   TYPE_POINTER = 7,
;   // TYPE_FUNCTION,
; };

%struct.type_metadata_t = type { i32, %union.anon }
%union.anon = type { %struct.tuple_type_metadata_t }
%struct.tuple_type_metadata_t = type { i32, ptr }
%struct.int_type_metadata_t = type { i32 }
%struct.int_type_metadata_t_padded = type { i32, [8 x i8] }
%struct.float_type_metadata_t = type { i32 }
%struct.float_type_metadata_t_padded = type { i32, [8 x i8] }
%struct.string_type_metadata_t = type { i32 }
%struct.string_type_metadata_t_padded = type { i32, [8 x i8] }
%struct.symbol_metadata_t = type { ptr }

%tuple_type = type { i32, i1, i1, ptr, i32, { i1, ptr } }
@string = global [4 x i8] c"abc\00"
@tuple = global %tuple_type { i32 1, i1 0, i1 1, ptr @string, i32 2, { i1, ptr } { i1 0, ptr @string } }
; @tuple = global { i32, ptr } { i32 1, ptr @string }
@newline = global [2 x i8] c"\0A\00"
@pointer_fmt = global [4 x i8] c"%p\0A\00"

declare void @print_tuple(ptr, i32, ptr)
declare i32 @printf(ptr, ...)

define i32 @main() {
entry:
  %b_ptr = alloca [2 x %struct.type_metadata_t]
  %b1_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %b_ptr, i64 0, i32 0
  %b2_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %b_ptr, i64 1, i32 0
  %b2_metadata_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 1, i32 1, i32 0
  store i32 5, ptr %b1_ptr
  store i32 3, ptr %b2_ptr
  store i32 4, ptr %b2_metadata_ptr

  %a_ptr = alloca [6 x %struct.type_metadata_t]
  %a1_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 0, i32 0
  %a2_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 1, i32 0
  %a3_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 2, i32 0
  %a4_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 3, i32 0
  %a5_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 4, i32 0
  %a6_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 5, i32 0
  %a1_metadata_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 0, i32 1, i32 0
  %a3_metadata_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 2, i32 1, i32 0
  %a4_metadata_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 3, i32 1, i32 0
  %a5_metadata_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 4, i32 1, i32 0
  %a6_metadata_count_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 5, i32 1, i32 0
  %a6_metadata_types_ptr = getelementptr inbounds %struct.type_metadata_t, ptr %a_ptr, i64 5, i32 1, i32 0, i32 1
  store i32 1, ptr %a1_ptr
  store i32 5, ptr %a2_ptr
  store i32 5, ptr %a3_ptr
  store i32 3, ptr %a4_ptr
  store i32 1, ptr %a5_ptr
  store i32 6, ptr %a6_ptr
  store i32 4, ptr %a1_metadata_ptr
  store i32 4, ptr %a3_metadata_ptr
  store i32 4, ptr %a4_metadata_ptr
  store i32 4, ptr %a5_metadata_ptr
  store i32 2, ptr %a6_metadata_count_ptr
  store ptr %b_ptr, ptr %a6_metadata_types_ptr

  call void @print_tuple(ptr @tuple, i32 6, ptr %a_ptr)
  call void @printf(ptr @newline)
  ret i32 0
}