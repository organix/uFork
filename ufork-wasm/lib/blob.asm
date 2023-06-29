;
; Demonstrate features of the "blob" device
;

.import
    std: "./std.asm"
    dev: "./dev.asm"

do_3:                   ; (debug_dev io_dev) <- blob
    msg 0               ; blob
    state 2             ; blob io_dev
    send -1             ; --
    state 1             ; debug_dev
    msg 0               ; debug_dev blob
    send 1              ; --
    ref std.commit

do_13:                  ; (debug_dev io_dev) <- blob
    msg 0               ; blob
    state 2             ; blob io_dev
    send -1             ; --
    msg 0               ; blob
    state 1             ; blob debug_dev
    push write_13       ; blob debug_dev write_13
    beh 2               ; --
    push 42             ; 42
    push 7              ; 42 7
    my self             ; 42 7 SELF
    msg 0               ; 42 7 SELF blob
    send 3              ; --
    ref std.commit
write_13:               ; (debug_dev blob) <- #unit
    state 0             ; (debug_dev blob)
    push read_13        ; (debug_dev blob) read_13
    beh -1              ; --
    push 7              ; 7
    my self             ; 7 SELF
    state 2             ; 7 SELF blob
    send 2              ; --
    msg 0               ; msg
    is_eq #unit         ; --
    ref std.commit
read_13:                ; (debug_dev blob) <- byte
    msg 0               ; byte
    state 1             ; byte debug_dev
    ref std.send_msg

boot:                   ; () <- {caps}
    push 13             ; 13
    msg 0               ; 13 {caps}
    push dev.io_key     ; 13 {caps} io_key
    dict get            ; 13 io_dev
    msg 0               ; 13 io_dev {caps}
    push dev.debug_key  ; 13 io_dev {caps} debug_key
    dict get            ; 13 io_dev debug_dev
    push do_13          ; 13 io_dev debug_dev do_13
    new 2               ; 13 do_13.(debug_dev io_dev)
    msg 0               ; 13 do_13 {caps}
    push dev.blob_key   ; 13 do_13 {caps} blob_key
    dict get            ; 13 do_13 blob_dev
    send 2              ; --

    push 3              ; 3
    msg 0               ; 3 {caps}
    push dev.io_key     ; 3 {caps} io_key
    dict get            ; 3 io_dev
    msg 0               ; 3 io_dev {caps}
    push dev.debug_key  ; 3 io_dev {caps} debug_key
    dict get            ; 3 io_dev debug_dev
    push do_3           ; 3 io_dev debug_dev do_3
    new 2               ; 3 do_3.(debug_dev io_dev)
    msg 0               ; 3 do_3 {caps}
    push dev.blob_key   ; 3 do_3 {caps} blob_key
    dict get            ; 3 do_3 blob_dev
    send 2              ; --

    ref std.commit

.export
    boot
