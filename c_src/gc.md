# Garbage Collection

Cell memory (quads) are subject to machine-level garbage collection.
The garbage-collected _heap_ ranges from `START` up to (not including) `cell_top`.
The floor (currently `START`) may be moved upward to include additional "reserved" cells.
The ceiling (held in the variable `cell_top`) is extended upward
to expand the pool of available memory,
up to a limit of `CELL_MAX`.
The bootstrap image initially occupies cells up to `CELL_BASE`,
which determines the initial value of `cell_top`.

The garbage-collector maintains a _mark_ for each cell in the heap.
The mark can have one of four possible values:

  * `GC_GENX`: This cell is in use as of Generation X
  * `GC_GENY`: This cell is in use as of Generation Y
  * `GC_SCAN`: This cell is in use, but has not been scanned
  * `GC_FREE`: This cell is in the free-cell chain {t:Free_T}

The _current generation_ alternates between `GC_GENX` and `GC_GENY`.
Cells in the range \[`START`, `CELL_BASE`\) are initially marked `GC_GENX`.

## GC Algorithm

Garbage collection is concurrent with allocation and mutation.
An increment of the garbage collector algortihm runs between each instruction execution cycle.
The overall algorithm is roughly the following:

1. Swap generations (`GC_GENX` <--> `GC_GENY`)
2. Mark each cell in the root-set with `GC_SCAN`
    1. If a new cell is added to the root-set, mark it with `GC_SCAN`
3. Mark each newly-allocated cell with `GC_SCAN`
4. While there are cells marked `GC_SCAN`:
    1. Scan a cell, for each field of the cell:
        1. If it points to the heap, and is marked with the _previous_ generation, mark it `GC_SCAN`
    2. Mark the cell with the _current_ generation
5. For each cell marked with the _previous_ generation,
    1. Mark the cell `GC_FREE` and add it to the free-cell chain
