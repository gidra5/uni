
@str = constant [4 x i8] c"%i\0A\00"
@const_37 = constant [7 x i8] c"atom_a\00"
@const_38 = constant [7 x i8] c"atom_b\00"
@const_39 = constant [9 x i8] c"symbol_1\00"
@const_1 = constant [6 x i8] c"log 1\00"
@const_2 = constant [6 x i8] c"log 2\00"
@const_3 = constant [6 x i8] c"log 3\00"
@const_4 = constant [6 x i8] c"log 4\00"
@const_5 = constant [6 x i8] c"log 5\00"
@const_6 = constant [6 x i8] c"log 6\00"
@const_7 = constant [6 x i8] c"log 7\00"
@const_8 = constant [6 x i8] c"log 8\00"
@symbols_metadata_array = constant [3 x { i8* }] [{ i8* } { i8* @const_37 }, { i8* } { i8* @const_38 }, { i8* } { i8* @const_39 }]
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

@const_00 = constant i64 0
@const_20 = constant i64 2
@action_a = constant { i64*, i64 } { i64* @const_00, i64 0 }
@handler_actions = constant [2 x { i32, { i64*, i64 }*, i64 (ptr, i64, i64)* }] [
  { i32, { i64*, i64 }*, i64 (ptr, i64, i64)* } { i32 7, { i64*, i64 }* @action_a, i64 (ptr, i64, i64)* @handle_a }, 
  { i32, { i64*, i64 }*, i64 (ptr, i64, i64)* } zeroinitializer]
@action_b = constant { i64*, i64 } { i64* @const_20, i64 0 }
@handler_actions2 = constant [2 x { i32, { i64*, i64 }*, i64 (ptr, i64, i64)* }] [
  { i32, { i64*, i64 }*, i64 (ptr, i64, i64)* } { i32 7, { i64*, i64 }* @action_b, i64 (ptr, i64, i64)* @handle_b }, 
  { i32, { i64*, i64 }*, i64 (ptr, i64, i64)* } zeroinitializer]

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
  ; %result = tail call i64 @lh_call_resume(ptr noundef %cont, i64 noundef %local, i64 noundef 2)
  ; call void @puts(ptr @const_4)
  %result2 = tail call i64 @lh_release_resume(ptr noundef %cont, i64 noundef %local, i64 noundef 2)
  call void @puts(ptr @const_5)
  ret i64 %result2
}

declare ptr @malloc(i64) nounwind
declare void @free(ptr) nounwind

define i64 @handleable_deep() {
entry:
  %action_a = alloca %struct.lh_optag_
  %action_a_effect = getelementptr inbounds %struct.lh_optag_, %struct.lh_optag_* %action_a, i32 0, i32 0
  store ptr @const_00, ptr %action_a_effect
  %action_a_op = getelementptr inbounds %struct.lh_optag_, %struct.lh_optag_* %action_a, i32 0, i32 1
  store i32 0, ptr %action_a_op
  %handled1 = tail call i64 @lh_yield(ptr noundef nonnull %action_a, i64 noundef 0)
  call void @printf(ptr noundef nonnull @str, i64 %handled1)
  %handled2 = tail call i64 @lh_yield(ptr noundef nonnull @action_b, i64 noundef 0)
  call void @printf(ptr noundef nonnull @str, i64 %handled2)
  %sum = add i64 %handled1, %handled2
  ret i64 %sum
}

define void @handleable2(ptr sret({ i64, i64 }) %0) {
entry:
  %action_a = call i8* @malloc(i64 16)
  %action_a_effect = getelementptr inbounds %struct.lh_optag_, %struct.lh_optag_* %action_a, i32 0, i32 0
  store ptr @const_00, ptr %action_a_effect
  %action_a_op = getelementptr inbounds %struct.lh_optag_, %struct.lh_optag_* %action_a, i32 0, i32 1
  store i32 0, ptr %action_a_op
  %handled1 = tail call i64 @lh_yield(ptr noundef nonnull %action_a, i64 noundef 0)
  call void @free(ptr %action_a)
  
  %action_b = call i8* @malloc(i64 16)
  %action_b_effect = getelementptr inbounds %struct.lh_optag_, %struct.lh_optag_* %action_b, i32 0, i32 0
  store ptr @const_20, ptr %action_b_effect
  %action_b_op = getelementptr inbounds %struct.lh_optag_, %struct.lh_optag_* %action_b, i32 0, i32 1
  store i32 0, ptr %action_b_op
  %handled2 = tail call i64 @lh_yield(ptr noundef nonnull %action_b, i64 noundef 0)

  %loaded = load { i64, i64 }, ptr %0
  %loaded1 = insertvalue { i64, i64 } %loaded, i64 %handled1, 0
  %loaded2 = insertvalue { i64, i64 } %loaded1, i64 %handled2, 1
  store { i64, i64 } %loaded2, ptr %0
  ret void
}

define void @handleable(ptr sret({ i64, i64 }) %0) {
entry:
  %var_8 = tail call dereferenceable_or_null(40) ptr @malloc(i64 40)
  store ptr @const_20, ptr %var_8, align 8
  %var_8.repack1 = getelementptr inbounds { ptr, ptr, ptr, ptr, ptr }, ptr %var_8, i64 0, i32 1
  %var_8.repack3 = getelementptr inbounds { ptr, ptr, ptr, ptr, ptr }, ptr %var_8, i64 0, i32 3
  tail call void @llvm.memset.p0.i64(ptr noundef nonnull align 8 dereferenceable(16) %var_8.repack1, i8 0, i64 16, i1 false)
  store ptr @return_handler, ptr %var_8.repack3, align 8
  %var_8.repack4 = getelementptr inbounds { ptr, ptr, ptr, ptr, ptr }, ptr %var_8, i64 0, i32 4
  store ptr @handler_actions2, ptr %var_8.repack4, align 8

  %var_17 = ptrtoint ptr %0 to i64
  %handled = tail call i64 @lh_handle(
    ptr noundef nonnull %var_8,
    i64 noundef 0, 
    ptr noundef nonnull @handleable2, 
    i64 noundef %var_17
  )
  call void @free(ptr %var_8)
  ret void
  ; ret i64 %handled
}

define i32 @main() {
entry:
  %var_8 = tail call dereferenceable_or_null(40) ptr @malloc(i64 40)
  store ptr @const_00, ptr %var_8, align 8
  %var_8.repack1 = getelementptr inbounds { ptr, ptr, ptr, ptr, ptr }, ptr %var_8, i64 0, i32 1
  %var_8.repack3 = getelementptr inbounds { ptr, ptr, ptr, ptr, ptr }, ptr %var_8, i64 0, i32 3
  tail call void @llvm.memset.p0.i64(ptr noundef nonnull align 8 dereferenceable(16) %var_8.repack1, i8 0, i64 16, i1 false)
  store ptr @return_handler, ptr %var_8.repack3, align 8
  %var_8.repack4 = getelementptr inbounds { ptr, ptr, ptr, ptr, ptr }, ptr %var_8, i64 0, i32 4
  store ptr @handler_actions, ptr %var_8.repack4, align 8
  %var_16 = alloca { i64, i64 }, align 8
  %var_17 = ptrtoint ptr %var_16 to i64
  %handled = tail call i64 @lh_handle(
    ptr noundef nonnull %var_8, 
    i64 noundef 0, 
    ptr noundef nonnull @handleable, 
    i64 noundef %var_17
  )
  %f = load { i64, i64 }, ptr %var_16
  %f1 = extractvalue { i64, i64 } %f, 0
  %f2 = extractvalue { i64, i64 } %f, 1
  call void @free(ptr %var_8)
  call void @printf(ptr noundef nonnull @str, i64 %f1)
  call void @printf(ptr noundef nonnull @str, i64 %f2)
  ret i32 0
}

declare void @llvm.memset.p0.i64(ptr nocapture writeonly, i8, i64, i1 immarg) #1