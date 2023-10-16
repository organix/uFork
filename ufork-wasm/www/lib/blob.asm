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
    assert #unit        ; --
    ref std.commit
read_13:                ; (debug_dev blob) <- byte
    msg 0               ; byte
    state 1             ; byte debug_dev
    ref std.send_msg

boot_0:                 ; () <- {caps}
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

boot:                   ; () <- {caps}
    dup 0               ; no-op
;    ref boot_0          ; redirect to `boot_0` behavior

step_0:
    msg 0               ; {caps}
    push dev.debug_key  ; {caps} debug_key
    dict get            ; debug_dev
    msg 0               ; debug_dev {caps}
    push dev.blob_key   ; debug_dev {caps} blob_key
    dict get            ; debug_dev blob_dev
    push step_1         ; debug_dev blob_dev step_1
    new 2               ; step_1.(blob_dev debug_dev)
    send 0              ; --
    ref std.commit

step_1:                 ; (blob_dev debug_dev) <- ()
    push 7              ; 7
    my self             ; 7 SELF
    state 1             ; 7 SELF blob_dev
    send 2              ; --
    my state            ; debug_dev blob_dev
    push step_2         ; debug_dev blob_dev step_2
    beh 2               ; --
    ref std.commit

step_2:                 ; (blob_dev debug_dev) <- blob_1
    push 5              ; 5
    my self             ; 5 SELF
    state 1             ; 5 SELF blob_dev
    send 2              ; --
    msg 0               ; blob_1
    my state            ; blob_1 debug_dev blob_dev
    push step_3         ; blob_1 debug_dev blob_dev step_3
    beh 3               ; --
    ref std.commit

step_3:                 ; (blob_dev debug_dev blob_1) <- blob_2
    push 3              ; 3
    my self             ; 3 SELF
    state 1             ; 3 SELF blob_dev
    send 2              ; --
    msg 0               ; blob_2
    my state            ; blob_2 blob_1 debug_dev blob_dev
    push step_4         ; blob_2 blob_1 debug_dev blob_dev step_4
    beh 4               ; --
    ref std.commit

step_4:                 ; (blob_dev debug_dev blob_1 blob_2) <- blob_3
    my state            ; blob_2 blob_1 debug_dev blob_dev
    roll 4              ; blob_1 debug_dev blob_dev blob_2  --- release blob_2 first
;    roll 3              ; blob_2 debug_dev blob_dev blob_1  --- release blob_1 first
    drop 1              ; blob_1 debug_dev blob_dev
    msg 0               ; blob_1 debug_dev blob_dev blob_3
    roll -4             ; blob_3 blob_1 debug_dev blob_dev
    push step_5         ; blob_3 blob_1 debug_dev blob_dev step_5
    beh 4               ; --
    my self             ; SELF
    send 0              ; --
    ref std.commit

step_5:                 ; (blob_dev debug_dev blob_1 blob_3) <- ()
    my state            ; blob_3 blob_1 debug_dev blob_dev
    roll 3              ; blob_3 debug_dev blob_dev blob_1
    drop 1              ; blob_3 debug_dev blob_dev
    push step_6         ; blob_3 debug_dev blob_dev step_6
    beh 3               ; --
    my self             ; SELF
    send 0              ; --
    ref std.commit

step_6:                 ; (blob_dev debug_dev blob_3) <- ()
    my state            ; blob_3 debug_dev blob_dev
    roll 3              ; debug_dev blob_dev blob_3
    drop 1              ; debug_dev blob_dev
    push step_7         ; debug_dev blob_dev step_7
    beh 2               ; --
    my self             ; SELF
    send 0              ; --
    ref std.commit

step_7:                 ; (blob_dev debug_dev) <- ()
    ref std.commit

.export
    boot
