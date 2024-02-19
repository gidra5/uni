Produces a buffer containing static data and function instructions.
First compiles into intermediate representations, that targets stack-based vms.
Then converts IR to a target platform, usually register-based vm.

Conversion from stack to register-based is done by treading registers set as a caching layer, whose state is tracked by compiler during translation.

Convertor tracks register state using the following data:
* what it references - cell in static data section, concrete stack slot, or nothing
* is data that is stores stale - current data's origin is not from referenced source.
* is register strongly holds to reference or not - if not, the it can be overwritten when new register is need for computation.

Operations such as:
* pushing data to the stack
* mutating some slot inside stack
* loading reference to cell in static data section
will modify tracked registers state and generate corresponding instructions, using minimal read-write commands to memory.