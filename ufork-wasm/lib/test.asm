; Boot into the test suite.

; Expects to receive a dictionary containing capabilities, like
; {2: DEBUG_DEV, 3: CLOCK_DEV, 4: IO_DEV, 5: BLOB_DEV, 6: BLOB_DEV}.

.import
    std: "./std.asm"
    fib: "./fib.asm"

n:
    ref 6

DEBUG_DEV_KEY:
    ref 2

boot:                   ; {caps}
    push n              ; n
    msg 0               ; n {caps}
    push DEBUG_DEV_KEY  ; n {caps} DEBUG_DEV_KEY
    dict get            ; n DEBUG_DEV
    push fib.beh        ; n DEBUG_DEV beh
    new 0               ; n DEBUG_DEV actor
    send 2 std.commit

.export
    boot
