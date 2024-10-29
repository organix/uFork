; The "thru" requestor produces its input value.

.import
    std: "../std.asm"
    dev: "../dev.asm"
    unwrap_result: "./unwrap_result.asm"

beh:
thru_beh:                   ; _ <- request=(to_cancel callback . value)
    msg -2                  ; value
    push #t                 ; value ok=#t
    pair 1                  ; result=(ok . value)
    msg 2                   ; result callback
    ref std.send_msg

; Test suite

boot:                       ; _ <- {caps}
    push 42                 ; 42
    msg 0                   ; 42 {caps}
    push dev.debug_key      ; 42 {caps} debug_key
    dict get                ; 42 debug_dev
    ref suite

test:                       ; judge <- {caps}
    push #t                 ; value=#t
    state 0                 ; value judge
    push unwrap_result.beh  ; value judge unwrap_result_beh
    actor create            ; value callback=unwrap_result_beh.judge
suite:
    push #?                 ; value callback to_cancel=#?
    pair 2                  ; request=(to_cancel callback . value)
    push #?                 ; request #?
    push thru_beh           ; request #? thru_beh
    actor create            ; request thru=thru_beh.#?
    ref std.send_msg

.export
    beh
    boot
    test
