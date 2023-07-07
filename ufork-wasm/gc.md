# Garbage Collection

Mutable quad-memory (RAM) is subject to machine-level garbage collection.
The garbage-collected _heap_ ranges from `RAM_BASE` up to (not including) `RAM_TOP`.
The floor (currently `RAM_BASE`) may be moved upward to include additional "reserved" cells.
The ceiling (held in the variable `RAM_TOP`) is extended upward
to expand the pool of available memory,
up to a limit of `RAM_MAX`.

## GC Private Memory

The garbage collector maintains storage
sufficient to hold a memory reference (tagged Raw value)
for each quad-memory cell in RAM.
That storage is private to the garbage collector,
and is not visible to any executing programs.

## GC Algorithm

The current garbage-collection algorithm
is a fairly traditional [mark-and-sweep](https://en.wikipedia.org/wiki/Tracing_garbage_collection) style.
It is a no-motion collector,
so the address of an allocated object
never changes over its lifetime.
It is an incremental (concurrent) collector,
so additional allocation and mutation can occur
while the garbage collector is running.
Actions performed by the garbage collector
are interleaved with instruction execution.

## GC Memory Evolution

When a GC cycle starts
the GC queue is initialized to empty,
Reserved RAM is set to UNIT
(marked "black"),
and the rest of GC memory is set to UNDEF
(marked "white").

 Offset | Quad.T            | Quad.X            | Quad.Y            | Quad.Z            | Description       | GC queue
--------|-------------------|-------------------|-------------------|-------------------|-------------------|---------------
 0      | ram_top = 20      | next_free = 17    | free_cnt = 1      | gc_root = NIL     | RAM Descriptor    | gc_first = NIL
 1      | event_first = 19  | event_last = 19   | cont_first = NIL  | cont_last = NIL   | Double-Deque      | gc_last = NIL
 2 - 14 | ...               | ...               | ...               | ...               | Reserved RAM      | UNIT
 15     | alloc_limit       | event_limit       | cycle_limit       | --                | Root Sponsor      | UNDEF
 16     | Pair_T            | car = 42          | cdr = NIL         | UNDEF             | Cons Cell         | UNDEF
 17     | Free_T            | UNDEF             | UNDEF             | NIL               | Free Cell         | UNDEF
 18     | Actor_T           | code = boot_beh   | data = NIL        | effect = UNDEF    | Bootstrap Actor   | UNDEF
 19     | sponsor = 15      | target = 18       | message = NIL     | next = NIL        | Bootstrap Event   | UNDEF
 20     | ...               | ...               | ...               | ...               | Top of RAM        | UNDEF

Reserved RAM is scanned
(starting with the Double-Deque),
adding any referenced cells to the GC queue
(marked "grey").

 Offset | Quad.T            | Quad.X            | Quad.Y            | Quad.Z            | Description       | GC queue
--------|-------------------|-------------------|-------------------|-------------------|-------------------|---------------
 0      | ram_top = 20      | next_free = 17    | free_cnt = 1      | gc_root = NIL     | RAM Descriptor    | gc_first = _19_
 1      | event_first = 19  | event_last = 19   | cont_first = NIL  | cont_last = NIL   | Double-Deque      | gc_last = _19_
 2 - 14 | ...               | ...               | ...               | ...               | Reserved RAM      | UNIT
 15     | alloc_limit       | event_limit       | cycle_limit       | --                | Root Sponsor      | UNDEF
 16     | Pair_T            | car = 42          | cdr = NIL         | UNDEF             | Cons Cell         | UNDEF
 17     | Free_T            | UNDEF             | UNDEF             | NIL               | Free Cell         | UNDEF
 18     | Actor_T           | code = boot_beh   | data = NIL        | effect = UNDEF    | Bootstrap Actor   | UNDEF
 19     | sponsor = 15      | target = 18       | message = NIL     | next = NIL        | Bootstrap Event   | _NIL_
 20     | ...               | ...               | ...               | ...               | Top of RAM        | UNDEF

The first item in the GC queue is scanned,
adding any referenced cells to the GC queue.
The first item is removed from the GC queue
(marked "black").

 Offset | Quad.T            | Quad.X            | Quad.Y            | Quad.Z            | Description       | GC queue
--------|-------------------|-------------------|-------------------|-------------------|-------------------|---------------
 0      | ram_top = 20      | next_free = 17    | free_cnt = 1      | gc_root = NIL     | RAM Descriptor    | gc_first = _15_
 1      | event_first = 19  | event_last = 19   | cont_first = NIL  | cont_last = NIL   | Double-Deque      | gc_last = _18_
 2 - 14 | ...               | ...               | ...               | ...               | Reserved RAM      | UNIT
 15     | alloc_limit       | event_limit       | cycle_limit       | --                | Root Sponsor      | _18_
 16     | Pair_T            | car = 42          | cdr = NIL         | UNDEF             | Cons Cell         | UNDEF
 17     | Free_T            | UNDEF             | UNDEF             | NIL               | Free Cell         | UNDEF
 18     | Actor_T           | code = boot_beh   | data = NIL        | effect = UNDEF    | Bootstrap Actor   | _NIL_
 19     | sponsor = 15      | target = 18       | message = NIL     | next = NIL        | Bootstrap Event   | _UNIT_
 20     | ...               | ...               | ...               | ...               | Top of RAM        | UNDEF

This process is repeated until the GC queue is empty.

 Offset | Quad.T            | Quad.X            | Quad.Y            | Quad.Z            | Description       | GC queue
--------|-------------------|-------------------|-------------------|-------------------|-------------------|---------------
 0      | ram_top = 20      | next_free = 17    | free_cnt = 1      | gc_root = NIL     | RAM Descriptor    | gc_first = _NIL_
 1      | event_first = 19  | event_last = 19   | cont_first = NIL  | cont_last = NIL   | Double-Deque      | gc_last = _NIL_
 2 - 14 | ...               | ...               | ...               | ...               | Reserved RAM      | UNIT
 15     | alloc_limit       | event_limit       | cycle_limit       | --                | Root Sponsor      | _UNIT_
 16     | Pair_T            | car = 42          | cdr = NIL         | UNDEF             | Cons Cell         | UNDEF
 17     | Free_T            | UNDEF             | UNDEF             | NIL               | Free Cell         | UNDEF
 18     | Actor_T           | code = boot_beh   | data = NIL        | effect = UNDEF    | Bootstrap Actor   | _UNIT_
 19     | sponsor = 15      | target = 18       | message = NIL     | next = NIL        | Bootstrap Event   | UNIT
 20     | ...               | ...               | ...               | ...               | Top of RAM        | UNDEF

Cells that are still set to UNDEF
(marked "white") are swept into the free-list,
from the Top of RAM down to Reserved RAM.

 Offset | Quad.T            | Quad.X            | Quad.Y            | Quad.Z            | Description       | GC queue
--------|-------------------|-------------------|-------------------|-------------------|-------------------|---------------
 0      | ram_top = 20      | next_free = _16_  | free_cnt = _2_    | gc_root = NIL     | RAM Descriptor    | gc_first = NIL
 1      | event_first = 19  | event_last = 19   | cont_first = NIL  | cont_last = NIL   | Double-Deque      | gc_last = NIL
 2 - 14 | ...               | ...               | ...               | ...               | Reserved RAM      | UNIT
 15     | alloc_limit       | event_limit       | cycle_limit       | --                | Root Sponsor      | UNIT
 16     | _Free_T_          | _UNDEF_           | _UNDEF_           | _17_              | _Free Cell_       | _UNDEF_
 17     | Free_T            | UNDEF             | UNDEF             | NIL               | Free Cell         | UNDEF
 18     | Actor_T           | code = boot_beh   | data = NIL        | effect = UNDEF    | Bootstrap Actor   | UNIT
 19     | sponsor = 15      | target = 18       | message = NIL     | next = NIL        | Bootstrap Event   | UNIT
 20     | ...               | ...               | ...               | ...               | Top of RAM        | UNDEF

## Concurrent/Incremental GC

The initial implementation of this GC algorithm
runs in a stop-the-world fashion,
usually triggered by completely exhausting available RAM.
This creates a "pause" between instructions
that occurs at unpredictable times.
It is desirable to perform garbage collection
in an incremental fashion,
concurrent (or interleaved) with normal mutation
resulting from executing instructions.

### GC Phase Descriptions

There are three phases to the current GC algorithm:

  1. Preparation
  2. Scanning
  3. Sweeping

In _preparation_ the _GC scan-queue_ is empty
and all non-reserved RAM quad-cells are marked "white".
The reserved cells are scanned
starting with the double-queue structure
and the _GC root_ pointer (if in RAM) is marked "grey".
This marks "grey" the first and last entries
of both the _event queue_ and the _continuation queue_.

In _scanning_ entries are removed from the GC scan-queue and marked "black".
Each field of the designated quad is scanned,
adding any "white" RAM reference to the GC scan-queue,
thus marking them "grey".
This process continues until the GC scan-queue is empty,
at which point all cells should be
either "white" (unreachable) or "black" (reachable).

In _sweeping_ a linear-address sweep considers
all non-reserved RAM starting at the top of memory.
Any "white" cells that are not already in the free-list
are added to the free list.
Any "black" cells are marked "white"
in preparation for the next GC pass.

### Mutation During Collection

Mutation interacts with garbage-collection
via the _reserve_ (allocate) and _release_ (free) primitives.
When a cell is released,
it is added to the free-list
and the cell is marked "white".
If the cell was in the GC scan-queue
(marked "grey"),
which can only occur during _scanning_,
it is removed from the queue.

When a cell is reserved,
it is assumed to be reachable
until a future GC pass finds otherwise.
During _preparation_ the cell is marked "white"
because that's the initial condition for all cells.
During _scanning_,
if the cell is still "white"
(or "black"?)
it is added to the GC scan-queue (marked "grey").
During _sweeping_,
if the cell is above the sweep address
(the sweep has already passed it)
it is marked "white",
otherwise it is marked "black"
and thus protected from collection.

#### A Fatal Flaw

The preceeding algorithm for handling mutation has a **fatal flaw**!
During _scanning_ it is possible
for an object not-yet-marked as "black" (reachable)
to be unlinked from one cell
and relinked into another that has already been scanned.
If the original parent is then released,
the relinked child may never appear in the GC scan-queue
and thus may remain "white",
causing it to be collected into the free-list during _sweeping_.
Until a more robust mechanism is developed
for detecting this kind of migration,
the incremental GC cannot be trusted
and the stop-the-world GC must be used instead.
