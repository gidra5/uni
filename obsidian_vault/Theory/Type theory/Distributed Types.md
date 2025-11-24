These are types that describe properties of a distributed system.

Given some topology of a system, it can be typed by assigning types to each node and edge.
Since edges and nodes are duals, it is enough to describe types for only one of them.
We may also say that types are polarized - they describe either properties of incoming messages (fan-in) or outgoing messages (fan-out).

Type captures:
1. Capability (security, privileges). What the process is allowed to send 
2. reliability (availability, failure rate, accuracy). What the process promises about its outgoing messages
3. Timing (latency, throughput). Describe the process’s messages own timing behavior
4. Causality (ordering of outgoing messages).
5. Protocol (expected communication pattern for sequences of in/out messages)

By duality, all these properties are applicable to edges as well as nodes. Or in polarization terms, they are applicable to constraints and guarantees on either incoming or outgoing messages.

Note that we also would benefit from a composition of types, which makes the most sense when talking about channels. We can pipe messages from one channel to another, and that would be a sequential composition of these channels. Or we can have a union of two channels, which would be a parallel composition.

For sequential composition each characteristic composes as follows:
1. capabilities = intersection. We can guarantee only what is guaranteed by both channels.
2. reliability = min. We can guarantee at least what is guaranteed by both channels.
3. timing = sum. We can guarantee that the sum of latencies is guaranteed.
4. ordering = weaker. We can only guarantee the weaker of the two orderings.
5. protocol = in general needs some kind of mediator that would compose sequences of messages, which may create an arbitrary overall session type?

For parallel composition some of them become dual:
1. capabilities = intersection. We can guarantee only what is guaranteed by both channels.
2. reliability = min. We can guarantee at least what is guaranteed by both channels.
3. timing = max. We can guarantee that the max of latencies is guaranteed.
4. ordering = weaker. We can guarantee only the weaker of the two orderings.
5. protocol = synchronization or interleaving

In case of parallel composition the exact type of the resulting channel depends on the mediator that would receive..