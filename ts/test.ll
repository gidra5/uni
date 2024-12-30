@.str = constant [4 x i8] c"%i\0A\00"

define i32 @main() {
entry:
  call void @printf([4 x i8]* @.str, i32 3)
  ret i32 0
}

declare i32 @printf(i8*, ...)