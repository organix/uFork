; device test suite.

; Expects to receive a dictionary containing capabilities, like
; {2: DEBUG_DEV, 3: CLOCK_DEV, 4: IO_DEV, 5: BLOB_DEV, 6: BLOB_DEV}.

.import
    std: "./std.asm"

DEBUG_DEV_KEY:
    ref 2
CLOCK_DEV_KEY:
    ref 3
IO_DEV_KEY:
    ref 4
BLOB_DEV_KEY:
    ref 5
MEMO_DEV_KEY:
    ref 6

boot:
    msg 0               ; {caps}
    push IO_DEV_KEY     ; {caps} IO_DEV_KEY
    dict get            ; IO_DEV
    msg 0               ; IO_DEV {caps}
    push BLOB_DEV_KEY   ; IO_DEV {caps} BLOB_DEV_KEY
    dict get            ; IO_DEV BLOB_DEV

    dup 2               ; IO_DEV BLOB_DEV IO_DEV BLOB_DEV
    push 13             ; IO_DEV BLOB_DEV IO_DEV BLOB_DEV 13
    roll -3             ; IO_DEV BLOB_DEV 13 IO_DEV BLOB_DEV
    send 2              ; IO_DEV BLOB_DEV

    push 3              ; IO_DEV BLOB_DEV 3
    roll -3             ; 3 IO_DEV BLOB_DEV
    send 2              ; --

    push 5              ; 5
    push count          ; 5 count
    new 0               ; 5 counter
    send 0              ; --

    push 42             ; msg=42
;    push #nil           ; ()
;    push -3             ; () -3
;    push -2             ; () -3 -2
;    push -1             ; () -3 -2 -1
;    pair 3              ; msg=(-1 -2 -3)
    msg 0               ; msg {caps}
    push DEBUG_DEV_KEY  ; msg {caps} DEBUG_DEV_KEY
    dict get            ; msg DEBUG_DEV
    send 0              ; --

    ref std.commit

count:
    msg 0               ; n
    dup 1               ; n n
    eq 0                ; n n==0
    if std.abort        ; n

    push 1              ; n 1
    alu sub             ; n-1
    my self             ; n-1 self

    ref std.send_0

.export
    boot
