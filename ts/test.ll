@.str = constant [4 x i8] c"%i\0A\00"

%closure_type = type { i64, i64, i64, i64 }
%closure_fn_type = type { %closure_type, i64 (%closure_type, i64)* }

define i32 @main() {
entry:
  %closure_fn_ptr = alloca %closure_fn_type
  call void @createClosure(ptr %closure_fn_ptr, i64 1, i64 2, i64 3, i64 4)
  %var_0 = load %closure_fn_type, ptr %closure_fn_ptr
  %closure_value = extractvalue %closure_fn_type %var_0, 0
  %closure_fn = extractvalue %closure_fn_type %var_0, 1
  %var_1 = call i64 %closure_fn(%closure_type %closure_value, i64 2)
  call void @printf([4 x i8]* @.str, i64 %var_1)
  ret i32 0
}

define void @createClosure(ptr sret(%closure_fn_type) %closure_fn_ptr, i64, i64, i64, i64) {
  entry:
    %closure_fn = load %closure_fn_type, ptr %closure_fn_ptr
    %closure_value = extractvalue %closure_fn_type %closure_fn, 0
    %closure_value1 = insertvalue %closure_type %closure_value, i64 %0, 0
    %closure_value2 = insertvalue %closure_type %closure_value1, i64 %1, 1
    %closure_value3 = insertvalue %closure_type %closure_value2, i64 %2, 2
    %closure_value4 = insertvalue %closure_type %closure_value3, i64 %3, 3
    %closure_fn1 = insertvalue %closure_fn_type %closure_fn, %closure_type %closure_value4, 0
    %closure_fn2 = insertvalue %closure_fn_type %closure_fn1, ptr @closure, 1
    store %closure_fn_type %closure_fn2, ptr %closure_fn_ptr
    ret void
}

define i64 @closure(%closure_type, i64) {
entry:
  %var_0 = extractvalue %closure_type %0, 0
  %var_1 = extractvalue %closure_type %0, 1
  %var_2 = extractvalue %closure_type %0, 2
  %var_3 = extractvalue %closure_type %0, 3
  %var_4 = mul i64 %var_0, %var_1
  %var_5 = mul i64 %var_2, %var_3
  %var_6 = add i64 %var_4, %var_5
  %var_7 = mul i64 %var_6, %1
  ret i64 %var_7
}

declare i32 @printf(i8*, ...)