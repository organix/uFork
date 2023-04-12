; Boot into the test suite.

; Expects to receive a dictionary containing capabilities, like
; {2: BLOB_DEV, 3: CLOCK_DEV, 4: IO_DEV}.

.import
    std: "./std.asm"
    fib: "./fib.asm"

n:
    ref 6

IO_DEV_KEY:
    ref 4

boot:                   ; {caps}
    push n              ; n
    msg 0               ; n {caps}
    push IO_DEV_KEY     ; n {caps} IO_DEV_KEY
    dict get            ; n IO_DEV
    pair 2              ; (IO_DEV n)
    push fib.beh        ; (IO_DEV n) beh
    new 0               ; (IO_DEV n) actor
    ref std.send_0      ;

.export
    boot
