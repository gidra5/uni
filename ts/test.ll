; ModuleID = '<stdin>'
source_filename = "<stdin>"
target datalayout = "e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128"
target triple = "x86_64-pc-linux-gnu"

@const_0 = constant [7 x i8] c"tuple(\00"
@const_1 = constant [3 x i8] c"%s\00"
@const_2 = constant [3 x i8] c"%i\00"
@const_3 = constant [3 x i8] c", \00"
@const_4 = constant [2 x i8] c")\00"
@const_5 = local_unnamed_addr constant i64 16
@const_6 = constant i64 0
@const_7 = local_unnamed_addr constant i64 1
@const_8 = constant i64 2
@const_9 = constant { i64, i64 } { i64 0, i64 0 }
@const_10 = constant [2 x { i32, ptr, ptr }] [{ i32, ptr, ptr } { i32 7, ptr @const_9, ptr @handler_a }, { i32, ptr, ptr } zeroinitializer]
@const_11 = local_unnamed_addr constant i64 40
@const_12 = local_unnamed_addr constant i64 128
@const_13 = constant { i64, i64 } { i64 2, i64 0 }
@const_14 = constant [2 x { i32, ptr, ptr }] [{ i32, ptr, ptr } { i32 7, ptr @const_13, ptr @handler_b }, { i32, ptr, ptr } zeroinitializer]
@const_15 = constant [10 x i8] c"handler_a\00"
@const_16 = constant [5 x i8] c"unit\00"
@const_17 = constant [10 x i8] c"handler_b\00"
@symbols_metadata_array = constant [3 x { ptr }] [{ ptr } { ptr @const_15 }, { ptr } { ptr @const_16 }, { ptr } { ptr @const_17 }]
@symbols_metadata = local_unnamed_addr constant ptr @symbols_metadata_array

declare void @puts(ptr)

@str1 = private unnamed_addr constant [2 x i8] c"1\00"
@str2 = private unnamed_addr constant [6 x i8] c"2 %p\0A\00"

define noundef i32 @main() local_unnamed_addr {
main:
  %var_14 = tail call dereferenceable_or_null(40) ptr @malloc(i64 40)
  %v = load ptr, ptr @const_8
  store ptr %v, ptr %var_14, align 8
  %var_14.repack1 = getelementptr inbounds { ptr, ptr, ptr, ptr, ptr }, ptr %var_14, i64 0, i32 1
  %var_14.repack3 = getelementptr inbounds { ptr, ptr, ptr, ptr, ptr }, ptr %var_14, i64 0, i32 3
  tail call void @llvm.memset.p0.i64(ptr noundef nonnull align 8 dereferenceable(16) %var_14.repack1, i8 0, i64 16, i1 false)
  store ptr @identity_ret_handler, ptr %var_14.repack3, align 8
  %var_14.repack4 = getelementptr inbounds { ptr, ptr, ptr, ptr, ptr }, ptr %var_14, i64 0, i32 4
  store ptr @const_14, ptr %var_14.repack4, align 8
  %var_16 = tail call dereferenceable_or_null(128) ptr @malloc(i64 128)
  %var_17 = ptrtoint ptr %var_16 to i64

  tail call void @lh_handle(ptr nonnull %var_14, i64 0, ptr nonnull @handleable_72, i64 %var_17)

  %var_18.unpack = load i64, ptr %var_16, align 4
  %var_18.elt5 = getelementptr inbounds { i64, i64 }, ptr %var_16, i64 0, i32 1
  %var_18.unpack6 = load i64, ptr %var_18.elt5, align 4

  tail call void @free(ptr nonnull %var_16)
  tail call void @free(ptr nonnull %var_14)
  tail call void @printf(ptr nonnull @const_1, ptr nonnull @const_0)
  tail call void @printf(ptr nonnull @const_2, i64 %var_18.unpack)
  tail call void @printf(ptr nonnull @const_1, ptr nonnull @const_3)
  tail call void @printf(ptr nonnull @const_2, i64 %var_18.unpack6)
  tail call void @printf(ptr nonnull @const_1, ptr nonnull @const_4)
  ret i32 0
}

define void @"generated_print_(i64, i64)"(ptr nocapture writeonly sret({ i64, i64 }) %arg_0, {} %arg_1, { i64, i64 } %arg_2) local_unnamed_addr {
entry_0:
  tail call void @printf(ptr nonnull @const_1, ptr nonnull @const_0)
  %var_0 = extractvalue { i64, i64 } %arg_2, 0
  tail call void @printf(ptr nonnull @const_2, i64 %var_0)
  tail call void @printf(ptr nonnull @const_1, ptr nonnull @const_3)
  %var_11 = extractvalue { i64, i64 } %arg_2, 1
  tail call void @printf(ptr nonnull @const_2, i64 %var_11)
  tail call void @printf(ptr nonnull @const_1, ptr nonnull @const_4)
  store i64 %var_0, ptr %arg_0, align 8
  %arg_0.repack1 = getelementptr inbounds { i64, i64 }, ptr %arg_0, i64 0, i32 1
  store i64 %var_11, ptr %arg_0.repack1, align 8
  ret void
}

; Function Attrs: nofree nounwind
declare noundef i32 @printf(ptr nocapture noundef readonly, ...) local_unnamed_addr #0

define void @generated_print_i64(ptr nocapture writeonly sret(i64) %arg_0, {} %arg_1, i64 %arg_2) local_unnamed_addr {
entry_0:
  tail call void @printf(ptr nonnull @const_2, i64 %arg_2)
  store i64 %arg_2, ptr %arg_0, align 8
  ret void
}

define void @handleable_72(ptr nocapture writeonly sret({ i64, i64 }) %arg_0) {
entry_0:
  %var_8 = tail call dereferenceable_or_null(40) ptr @malloc(i64 40)
  %v = load ptr, ptr @const_6
  store ptr %v, ptr %var_8, align 8
  %var_8.repack1 = getelementptr inbounds { ptr, ptr, ptr, ptr, ptr }, ptr %var_8, i64 0, i32 1
  %var_8.repack3 = getelementptr inbounds { ptr, ptr, ptr, ptr, ptr }, ptr %var_8, i64 0, i32 3
  tail call void @llvm.memset.p0.i64(ptr noundef nonnull align 8 dereferenceable(16) %var_8.repack1, i8 0, i64 16, i1 false)
  store ptr @identity_ret_handler, ptr %var_8.repack3, align 8
  %var_8.repack4 = getelementptr inbounds { ptr, ptr, ptr, ptr, ptr }, ptr %var_8, i64 0, i32 4
  store ptr @const_10, ptr %var_8.repack4, align 8
  %var_10 = tail call dereferenceable_or_null(128) ptr @malloc(i64 128)
  %var_11 = ptrtoint ptr %var_10 to i64
  
  call void @puts(ptr nonnull @str1)

  tail call void @lh_handle(ptr nonnull %var_8, i64 0, ptr nonnull @handleable_63, i64 %var_11)
  %0 = load <2 x i64>, ptr %var_10, align 4
  tail call void @free(ptr nonnull %var_10)
  tail call void @free(ptr nonnull %var_8)
  store <2 x i64> %0, ptr %arg_0, align 8
  ret void
}

define void @handleable_63(ptr nocapture writeonly sret({ i64, i64 }) %arg_0) {
entry_0:

  %calloc = tail call dereferenceable_or_null(16) ptr @calloc(i64 1, i64 16)
  ; call void @puts(ptr nonnull @str2)
  %f = getelementptr inbounds { i64, i64 }, ptr %calloc, i64 0, i32 0
  call void @printf(ptr nonnull @str2, ptr %f)
  %var_0.i5 = tail call i64 @lh_yield(ptr nonnull %calloc, i64 1)
  %var_0.i6 = tail call i8 @free(ptr nonnull %calloc)
  %var_0.i7 = tail call dereferenceable_or_null(16) ptr @malloc(i64 16)
  store i64 2, ptr %var_0.i7, align 4
  %var_55.repack2 = getelementptr inbounds { i64, i64 }, ptr %var_0.i7, i64 0, i32 1
  store i64 0, ptr %var_55.repack2, align 4
  %var_0.i8 = tail call i64 @lh_yield(ptr nonnull %var_0.i7, i64 1)
  store i64 %var_0.i5, ptr %arg_0, align 8
  %arg_0.repack3 = getelementptr inbounds { i64, i64 }, ptr %arg_0, i64 0, i32 1
  store i64 %var_0.i8, ptr %arg_0.repack3, align 8
  ret void
}

; Function Attrs: mustprogress nofree nounwind willreturn allockind("alloc,uninitialized") allocsize(0) memory(inaccessiblemem: readwrite)
declare noalias noundef ptr @malloc(i64 noundef) local_unnamed_addr #1

; Function Attrs: mustprogress nofree nounwind willreturn memory(argmem: write, inaccessiblemem: readwrite)
define void @malloc_wrap(ptr nocapture writeonly sret(ptr) %arg_0, {} %arg_1, i64 %arg_2) local_unnamed_addr #2 {
entry_0:
  %var_0 = tail call ptr @malloc(i64 %arg_2)
  store ptr %var_0, ptr %arg_0, align 8
  ret void
}

declare i64 @lh_yield(ptr, i64) local_unnamed_addr

define void @lh_yield_wrap(ptr nocapture writeonly sret(i64) %arg_0, {} %arg_1, ptr %arg_2, i64 %arg_3) local_unnamed_addr {
entry_0:
  %var_0 = tail call i64 @lh_yield(ptr %arg_2, i64 %arg_3)
  store i64 %var_0, ptr %arg_0, align 8
  ret void
}

declare i8 @free(ptr) local_unnamed_addr

define void @free_wrap(ptr nocapture writeonly sret(i8) %arg_0, {} %arg_1, ptr %arg_2) local_unnamed_addr {
entry_0:
  %var_0 = tail call i8 @free(ptr %arg_2)
  store i8 %var_0, ptr %arg_0, align 1
  ret void
}

; Function Attrs: mustprogress nofree norecurse nosync nounwind willreturn memory(none)
define i64 @identity_ret_handler(i64 %arg_0, i64 returned %arg_1) #3 {
entry_0:
  ret i64 %arg_1
}

define i64 @handler_a(ptr %arg_0, i64 %arg_1, i64 %arg_2) {
entry_0:
  %var_0.i = tail call i64 @lh_release_resume(ptr %arg_0, i64 %arg_1, i64 1)
  ret i64 %var_0.i
}

declare i64 @lh_release_resume(ptr, i64, i64) local_unnamed_addr

define void @lh_release_resume_wrap(ptr nocapture writeonly sret(i64) %arg_0, {} %arg_1, ptr %arg_2, i64 %arg_3, i64 %arg_4) local_unnamed_addr {
entry_0:
  %var_0 = tail call i64 @lh_release_resume(ptr %arg_2, i64 %arg_3, i64 %arg_4)
  store i64 %var_0, ptr %arg_0, align 8
  ret void
}

define void @fn_76(ptr nocapture writeonly sret(i64) %arg_0, { { ptr, {} } } %arg_1, ptr %arg_2, i64 %arg_3, i64 %arg_4) local_unnamed_addr {
entry_0:
  %var_0 = extractvalue { { ptr, {} } } %arg_1, 0
  %var_2 = extractvalue { ptr, {} } %var_0, 0
  %var_4 = alloca i64, align 8
  call void %var_2(ptr nonnull %var_4, {} zeroinitializer, ptr %arg_2, i64 %arg_3, i64 1)
  %var_5 = load i64, ptr %var_4, align 8
  store i64 %var_5, ptr %arg_0, align 8
  ret void
}

declare i64 @lh_handle(ptr, i64, ptr, i64) local_unnamed_addr

define i64 @handler_b(ptr %arg_0, i64 %arg_1, i64 %arg_2) {
entry_0:
  %var_0.i = tail call i64 @lh_release_resume(ptr %arg_0, i64 %arg_1, i64 2)
  ret i64 %var_0.i
}

define void @fn_77(ptr nocapture writeonly sret(i64) %arg_0, { { ptr, {} } } %arg_1, ptr %arg_2, i64 %arg_3, i64 %arg_4) local_unnamed_addr {
entry_0:
  %var_0 = extractvalue { { ptr, {} } } %arg_1, 0
  %var_2 = extractvalue { ptr, {} } %var_0, 0
  %var_4 = alloca i64, align 8
  call void %var_2(ptr nonnull %var_4, {} zeroinitializer, ptr %arg_2, i64 %arg_3, i64 2)
  %var_5 = load i64, ptr %var_4, align 8
  store i64 %var_5, ptr %arg_0, align 8
  ret void
}

; Function Attrs: nocallback nofree nounwind willreturn memory(argmem: write)
declare void @llvm.memset.p0.i64(ptr nocapture writeonly, i8, i64, i1 immarg) #4

; Function Attrs: nofree nounwind willreturn allockind("alloc,zeroed") allocsize(0,1) memory(inaccessiblemem: readwrite)
declare noalias noundef ptr @calloc(i64 noundef, i64 noundef) local_unnamed_addr #5

attributes #0 = { nofree nounwind }
attributes #1 = { mustprogress nofree nounwind willreturn allockind("alloc,uninitialized") allocsize(0) memory(inaccessiblemem: readwrite) "alloc-family"="malloc" }
attributes #2 = { mustprogress nofree nounwind willreturn memory(argmem: write, inaccessiblemem: readwrite) }
attributes #3 = { mustprogress nofree norecurse nosync nounwind willreturn memory(none) }
attributes #4 = { nocallback nofree nounwind willreturn memory(argmem: write) }
attributes #5 = { nofree nounwind willreturn allockind("alloc,zeroed") allocsize(0,1) memory(inaccessiblemem: readwrite) "alloc-family"="malloc" }