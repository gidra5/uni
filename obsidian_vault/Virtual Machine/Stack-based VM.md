VMs, which operate on a stack internally.

Values are pushed onto a stack and consumed by operations, that will write back their result on top of the stack.

Easy to implement, but poorly maps to actual hardware, which is better modelled by [[Register-based VM]]s