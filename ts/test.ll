
@str = constant [4 x i8] c"%i\0A\00"
@const_37 = constant [7 x i8] c"atom_a\00"
@const_38 = constant [7 x i8] c"atom_b\00"
@const_1 = constant [6 x i8] c"log 1\00"
@const_2 = constant [6 x i8] c"log 2\00"
@const_3 = constant [6 x i8] c"log 3\00"
@const_4 = constant [6 x i8] c"log 4\00"
@const_5 = constant [6 x i8] c"log 5\00"
@const_6 = constant [6 x i8] c"log 6\00"
@const_7 = constant [6 x i8] c"log 7\00"
@const_8 = constant [6 x i8] c"log 8\00"
@symbols_metadata_array = constant [2 x { i8* }] [{ i8* } { i8* @const_37 }, { i8* } { i8* @const_38 }]
@symbols_metadata = global ptr @symbols_metadata_array

declare i32 @puts(ptr)
declare i32 @printf(ptr, ...)
declare i64 @lh_yield(ptr noundef, i64 noundef)
declare i64 @lh_handle(ptr noundef, i64 noundef, ptr noundef, i64 noundef) 
declare i64 @lh_call_resume(ptr noundef, i64 noundef, i64 noundef) 
declare i64 @lh_release_resume(ptr noundef, i64 noundef, i64 noundef)

%struct.lh_optag_ = type { ptr, i64 }
%struct._lh_handlerdef = type { ptr, ptr, ptr, ptr, ptr }
%struct._lh_operation = type { i32, ptr, ptr }

@placeholder = private unnamed_addr constant [1 x i8] c"\00"
@lh_names_effect_handlers = dso_local global [1 x ptr] [ptr null]
@action_a = constant %struct.lh_optag_ { ptr @lh_names_effect_handlers, i64 0 }, align 8
@action_b = constant %struct.lh_optag_ { ptr @lh_names_effect_handlers, i64 1 }, align 8
@handler_actions = internal constant [3 x %struct._lh_operation] [
  %struct._lh_operation { i32 7, ptr @action_a, ptr @handle_a }, 
  %struct._lh_operation { i32 7, ptr @action_b, ptr @handle_b }, 
  %struct._lh_operation zeroinitializer
], align 16
@handlers = internal constant %struct._lh_handlerdef { 
  ptr @lh_names_effect_handlers, 
  ptr null, 
  ptr null, 
  ptr @return_handler, 
  ptr @handler_actions 
}, align 8

define internal noundef i64 @return_handler(i64 %local, i64 noundef %arg) {
  call void @puts(ptr @const_8)
  ret i64 %arg
}

define internal noundef i64 @handle_a(ptr noundef %cont, i64 noundef %local, i64 %arg) {
  call void @puts(ptr @const_1)
  %result = tail call i64 @lh_release_resume(ptr noundef %cont, i64 noundef %local, i64 noundef 1)
  call void @puts(ptr @const_2)
  ret i64 %result
}
define internal noundef i64 @handle_b(ptr noundef %cont, i64 noundef %local, i64 %arg) {
  call void @puts(ptr @const_3)
  %result = tail call i64 @lh_call_resume(ptr noundef %cont, i64 noundef %local, i64 noundef 2)
  call void @puts(ptr @const_4)
  %result2 = tail call i64 @lh_release_resume(ptr noundef %cont, i64 noundef %local, i64 noundef 3)
  call void @puts(ptr @const_5)
  ret i64 %result2
}

define i64 @handleable_deep() {
entry:
  %handled1 = tail call i64 @lh_yield(ptr noundef nonnull @action_a, i64 noundef 0)
  call void @printf(ptr noundef nonnull @str, i64 %handled1)
  %handled2 = tail call i64 @lh_yield(ptr noundef nonnull @action_b, i64 noundef 0)
  call void @printf(ptr noundef nonnull @str, i64 %handled2)
  %sum = add i64 %handled1, %handled2
  ret i64 %sum
}

define i64 @handleable(i64 %0) {
entry:
  %v = tail call i64 @handleable_deep()
  call void @printf(ptr noundef nonnull @str, i64 %v)
  %handled2 = tail call i64 @lh_yield(ptr noundef nonnull @action_b, i64 noundef 0)
  call void @printf(ptr noundef nonnull @str, i64 %handled2)
  %sum = mul i64 %v, %handled2
  ret i64 %sum
}

define i32 @main() {
entry:
  %handled = tail call i64 @lh_handle(
    ptr noundef nonnull @handlers, 
    i64 noundef 0, 
    ptr noundef nonnull @handleable, 
    i64 noundef 0
  )
  call void @printf(ptr noundef nonnull @str, i64 %handled)
  ret i32 0
}