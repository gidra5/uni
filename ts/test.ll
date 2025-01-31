@.str = constant [4 x i8] c"%i\0A\00"

%closure_type = type { i64 }
%fn_type = type i64 (i64)*
%closure_fn_type = type { i64 (%closure_type, %fn_type)*, %closure_type* }

define i32 @main() {
entry:
  %closure_fn_ptr = alloca %closure_fn_type
  call void @createClosure(ptr %closure_fn_ptr, i64 2)
  %var_0 = load %closure_fn_type, ptr %closure_fn_ptr
  %closure_value_ptr = extractvalue %closure_fn_type %var_0, 1
  %closure_value = load %closure_type, ptr %closure_value_ptr
  %closure_fn = extractvalue %closure_fn_type %var_0, 0
  %var_1 = call i64 %closure_fn(%closure_type %closure_value, %fn_type @fn)
  call void @printf([4 x i8]* @.str, i64 %var_1)
  ret i32 0
}

define void @createClosure(ptr sret(%closure_fn_type) %closure_fn_ptr, i64) {
  entry:
    %closure_fn = load %closure_fn_type, ptr %closure_fn_ptr
    %closure_value_ptr = call ptr @malloc(i64 8)
    %closure_value = load %closure_type, ptr %closure_value_ptr
    %closure_value1 = insertvalue %closure_type %closure_value, i64 %0, 0
    store %closure_type %closure_value1, ptr %closure_value_ptr
    %closure_fn1 = insertvalue %closure_fn_type %closure_fn, ptr %closure_value_ptr, 1
    %closure_fn2 = insertvalue %closure_fn_type %closure_fn1, ptr @closure, 0
    store %closure_fn_type %closure_fn2, ptr %closure_fn_ptr
    ret void
}

define i64 @closure(%closure_type, %fn_type) {
entry:
  %var_0 = extractvalue %closure_type %0, 0
  %var_1 = call i64 %1(i64 %var_0)
  ret i64 %var_1
}

define i64 @fn(i64) {
entry:
  ret i64 %0
}

declare i32 @printf(i8*, ...)
declare ptr @malloc(i64)