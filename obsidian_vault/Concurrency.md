Concurrency model is based on tasks.

Task - synchronous unit of work. Can create more tasks during its lifetime. Tasks may depend on result of execution of other tasks (child tasks). Tasks may be pinned to exact thread. Tasks may be triggered by some condition becoming true.

Tasks may fail or succeed.

Child tasks that have failed also fail their parent task.

Tasks are executed by threads, which can be more than one.

Threads are spawned in a thread-pool, to reuse existing threads and to create additional threads on demand.
Thread-pool takes tasks from task-queue.

When program starts it creates main task, which then can spawn more dependent of indenendent tasks.

Tasks can be created by:
1. multiple pure function calls.
2. async call to any function.
3. Method calls.
4. Pushing a value into iterator.
5. Manual via std.

All concurrent method calls on the same instance are pinned to the same thread and executed synchronously in order.

Any function can be pinned to some thread to guarantee that it will always be executed on the same thread.

Also there are concurrency primitives such as atomics, mutexes and semaphores.

https://stackoverflow.com/questions/980999/what-does-multicore-assembly-language-look-like

https://openjdk.org/jeps/453 - structured concurrency.
In structured concurrency all tasks have hierarchy.
If task is cancelled, all its child tasks are cancelled as well
A group of tasks may adhere to some execution policy.
Execution policy may differently handle success or failure of individual tasks.
For example:
1. upon failure of any one task cancel siblings and return error.
2. upon success of any one task cancel siblings and return result.
