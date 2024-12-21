; Exercises the blob device.

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

size:
    ref 8

source_beh:                 ; referee <- blob
    msg 0                   ; blob
    typeq #actor_t          ; is_actor(blob)
    assert #t               ; --
    state 0                 ; referee
    push size_beh           ; referee size_beh
    actor create            ; cust=size_beh.referee
    push 10                 ; cust length=10
    push 2                  ; cust length base=2
    pair 2                  ; source_req=(base length . cust)
    msg 0                   ; source_req blob
    ref std.send_msg

size_beh:                   ; referee <- (base len . blob)
    msg 1                   ; base
    assert 2                ; --
    msg 2                   ; len
    assert 6                ; --
    state 0                 ; referee
    msg -2                  ; referee blob
    pair 1                  ; (blob . referee)
    push write_beh          ; (blob . referee) write_beh
    actor create            ; cust=write_beh.(blob . referee)
    msg -2                  ; cust blob // size request
    ref std.send_msg

write_beh:                  ; (blob . referee) <- size
    msg 0                   ; size
    assert size             ; --
    push 42                 ; value=42
    push 1                  ; value offset=1
    state 0                 ; value offset (blob . referee)
    push read_beh           ; value offset (blob . referee) read_beh
    actor create            ; value offset cust=read_beh.(blob . referee)
    pair 2                  ; (cust offset . value)
    state 1                 ; (cust offset . value) blob
    ref std.send_msg

read_beh:                   ; (blob . referee) <- ok
    msg 0                   ; ok
    assert #t               ; --
    push 1                  ; offset=1
    state -1                ; offset referee
    push check_beh          ; offset referee check_beh
    actor create            ; offset cust=check_beh.referee
    pair 1                  ; (cust . offset)
    state 1                 ; (cust . offset) blob
    ref std.send_msg

check_beh:                  ; referee <- value
    msg 0                   ; value
    assert 42               ; --
    push #t                 ; verdict=#t
    state 0                 ; verdict referee
    ref std.send_msg

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; referee=debug_dev
    ref suite
test:                       ; judge <- {caps}
    state 0                 ; referee=judge
suite:                      ; referee
    push source_beh         ; referee source_beh
    actor create            ; cust=source_beh.referee
    push size               ; cust size
    roll 2                  ; size cust
    pair 1                  ; alloc_req=(cust . size)
    msg 0                   ; alloc_req {caps}
    push dev.blob_key       ; alloc_req {caps} blob_key
    dict get                ; alloc_req blob_dev
    ref std.send_msg

.export
    boot
    test
