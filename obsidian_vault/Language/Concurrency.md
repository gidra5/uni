Concurrency usually operates over some acyclic graph of tasks, one task depending on result of other tasks.
Task is a chunk of logic to be executed, that produces some result to be used later.

Concurrency may be indirect or direct.

Direct concurrency works with hardware capabilities directly - waking up other cores on processor and handing them the code to execute. It requires user to manually orchestrate concurrency in presence of hardware constraints, but allows for maximum control of available resources. All tasks are explicitly initiated and need to be handled appropriately. Usually implies more or less fixed task graph, for which it is built.

Indirect concurrency add layer of abstraction that allows for practically unlimited amount of simultaneous executing code. Usually handles distribution of tasks onto processors for you, as well as handling results or failure of their execution. Allows for greater flexibility in code, because task graph may change dynamically, which simplifies development and maintenance. 

Indirect concurrency may be implemented in different ways, but ultimately it requires a scheduler at runtime, that will handle incoming tasks. Usually follows architecture with queue of tasks where processors take them to execute, until the queue is empty and all processors are done.

Go implements them as set of queues of continuations (aka "rest of the computation/task"), one per each core in the processor, where processors may "steal" others work if they are idle.

Other languages implement runtime as a state machine or simple queue of tasks.

There are concurrency primitives such as atomics, mutexes and semaphores, that allow to guarantee certain order of events, usually used in direct concurrency to handle access to shared resources.
# Structured concurrency

In structured concurrency all tasks have hierarchy.
If task is cancelled, all of its children tasks are cancelled as well
A group of tasks may adhere to some execution policy.
Execution policy may differently handle success or failure of individual tasks.
For example:
1. upon failure of any one task cancel siblings and return error.
2. upon success of any one task cancel siblings and return result.
Core to the idea of structured concurrency is lifetime of tasks - siblings may never outlive its parent.
Main characteristics are:
1. possibility for building up hierarchy of processes, that preserve the condition above - children may not outlive its parent. That means outside of parent, its impossible to see the concurrent behavior, it does not have "side-effect" of creating new tasks.
2. that implies parents are responsible for handling cancelling and failure of all of its children. They must be able to handle failures and cancelling of any dangling processes that are not handled explicitly.

While it adds hierarchy, it doesn't mean it needs to become a proper tree. Children may form another acyclic graph, the only thing required is that parent waits for all of its children to be done before reporting that it itself is done.

Java rfc 453 example of structured concurrency:
```
Response handle() throws ExecutionException, InterruptedException {
    try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
        Supplier<String>  user  = scope.fork(() -> findUser());
        Supplier<Integer> order = scope.fork(() -> fetchOrder());

        scope.join()            // Join both subtasks
             .throwIfFailed();  // ... and propagate errors

        // Here, both subtasks have succeeded, so compose their results
        return new Response(user.get(), order.get());
    }
}
```

simplify to:
```
handle := fn {
	policy cancel_on_error {
		user := async find_user();
		order := async order();

		throw_if_failed();

		await user, await order
	}
}
```

notably:
1. `scope` is now implicit under `policy` block

Java rfc 453 example 2 of structured concurrency:
```
<T> T race(List<Callable<T>> tasks, Instant deadline) 
        throws InterruptedException, ExecutionException, TimeoutException {
    try (var scope = new StructuredTaskScope.ShutdownOnSuccess<T>()) {
        for (var task : tasks) {
            scope.fork(task);
        }
        return scope.joinUntil(deadline)
                    .result();  // Throws if none of the subtasks completed successfully
    }
}
```

simplify to:
```
handle := fn {
	policy cancel_on_error {
		user := async find_user();
		order := async order();

		throw_if_failed();

		await user, await order
	}
}
```

https://stackoverflow.com/questions/980999/what-does-multicore-assembly-language-look-like
https://openjdk.org/jeps/453 - structured concurrency.
https://vorpus.org/blog/notes-on-structured-concurrency-or-go-statement-considered-harmful/#go-statement-considered-harmful
[] concurrency in go book