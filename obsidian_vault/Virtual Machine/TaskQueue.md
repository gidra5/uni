Task queue works with 2 concepts - a task and a channel.
Task is a unit of work. 
Channel is a primitive for communication between tasks.

There are 4 kinds of tasks, depending on how they use channels:
1. Pure tasks - do not send or receive data through channels.
2. Consume tasks - only receive data through some channel
3. Produce tasks - only send data through some channel
4. Transform tasks - receives data and then sends new data through some channels

Task may be ready or blocked depending on whether receiving channel has data currently or not.
Channels itself are no more than unique id, such that existence of an entry for the channel id in channel table corresponds to channel having data ready.

Tasks sorted into two arrays - the task queue and blocked array.

The main execution loop works as follows:
1. Generate tasks from the AST
2. Check if blocked tasks unblocked.
3. While task queue is not empty:
   1. Take next task in queue
   2. If task is not ready: 
      1. move it into blocked array
      2. go to the start of the loop.
   3. If task does not receive data:
      1. Execute task
      2. put the result into task's output channel, if there is one.
      3. if the result is `void` value - cancel all downstream tasks
      4. Go to the start of the loop.
   4. Take value from the channel and execute the task.
   5. Put the result into task's output channel, if there is one
   6. if the result is `void` value - cancel all downstream tasks
   7. Go to the start of the loop.

The task generator will return channel that will store the result of computation after main loop is done.
The important part is that tasks are always finite, that is they don't enter infinite loops inside, which helps not to block the main loop.

