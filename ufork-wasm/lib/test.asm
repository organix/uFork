; Boot into the test suite.

; Expects to receive a dictionary containing capabilities.

.import
    std: "./std.asm"
    fib: "./fib.asm"
    dev: "./dev.asm"

n:
    ref 6

boot:                   ; () <- {caps}
    push n              ; n
    msg 0               ; n {caps}
    push dev.debug_key  ; n {caps} dev.debug_key
    dict get            ; n debug_dev
    push fib.beh        ; n debug_dev beh
    new 0               ; n debug_dev actor
    send 2 std.commit

.export
    boot
