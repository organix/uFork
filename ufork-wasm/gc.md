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
 15     | alloc_limit       | event_limit       | instr_limit       | --                | Root Sponsor      | UNDEF
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
 15     | alloc_limit       | event_limit       | instr_limit       | --                | Root Sponsor      | UNDEF
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
 15     | alloc_limit       | event_limit       | instr_limit       | --                | Root Sponsor      | _18_
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
 15     | alloc_limit       | event_limit       | instr_limit       | --                | Root Sponsor      | _UNIT_
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
 15     | alloc_limit       | event_limit       | instr_limit       | --                | Root Sponsor      | UNIT
 16     | _Free_T_          | _UNDEF_           | _UNDEF_           | _17_              | _Free Cell_       | _UNDEF_
 17     | Free_T            | UNDEF             | UNDEF             | NIL               | Free Cell         | UNDEF
 18     | Actor_T           | code = boot_beh   | data = NIL        | effect = UNDEF    | Bootstrap Actor   | UNIT
 19     | sponsor = 15      | target = 18       | message = NIL     | next = NIL        | Bootstrap Event   | UNIT
 20     | ...               | ...               | ...               | ...               | Top of RAM        | UNDEF
