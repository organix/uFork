; Demonstrates the blob device.

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

boot:                       ; _ <- {caps}
    push 8                  ; size=8
    msg 0                   ; size {caps}
    push dev.debug_key      ; size {caps} debug_key
    dict get                ; size debug_dev
    push write_beh          ; size debug_dev write_beh
    actor create            ; size cust=write_beh.debug_dev
    pair 1                  ; (cust . size)
    msg 0                   ; (cust . size) {caps}
    push dev.blob_key       ; (cust . size) {caps} blob_key
    dict get                ; (cust . size) blob_dev
    ref std.send_msg

write_beh:                  ; debug_dev <- blob
    push 42                 ; value=42
    push 1                  ; value offset=1
    state 0                 ; value offset debug_dev
    msg 0                   ; value offset debug_dev blob
    pair 1                  ; value offset (blob . debug_dev)
    push read_beh           ; value offset (blob . debug_dev) read_beh
    actor create            ; value offset cust=read_beh.(blob . debug_dev)
    pair 2                  ; (cust offset . value)
    msg 0                   ; (cust offset . value) blob
    actor send              ; --
    push #?                 ; #? // size request
    state 0                 ; #? debug_dev
    pair 1                  ; (debug_dev . #?)
    msg 0                   ; (debug_dev . #?) blob
    ref std.send_msg

read_beh:                   ; (blob . debug_dev) <- ok
    msg 0                   ; ok
    assert #t               ; --
    push 1                  ; offset=1
    state -1                ; offset debug_dev
    push check_beh          ; offset debug_dev check_beh
    actor create            ; offset cust=check_beh.debug_dev
    pair 1                  ; (cust . offset)
    state 1                 ; (cust . offset) blob
    ref std.send_msg

check_beh:                  ; debug_dev <- value
    msg 0                   ; value
    assert 42               ; --
    push 1729               ; 1729
    state 0                 ; 1729 debug_dev
    ref std.send_msg

.export
    boot
