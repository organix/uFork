; Bind the input value of a requestor to a constant value.

.import
    std: "../std.asm"
    dev: "../dev.asm"
    thru: "./thru.asm"
    unwrap_result: "./unwrap_result.asm"

beh:
bind_beh:                   ; input,requestor <- can,cb,_
    state 1                 ; input
    msg 2                   ; input cb
    msg 1                   ; input cb can
    pair 2                  ; can,cb,input
    state -1                ; can,cb,input requestor
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
    actor create            ; value cb=unwrap_result_beh.judge
suite:                      ; value cb
    push 1729               ; value cb 1729
    roll 2                  ; value 1729 cb
    push #?                 ; value 1729 cb can=#?
    pair 2                  ; value request=can,cb,1729
    push #?                 ; value request _
    push thru.beh           ; value request _ thru
    actor create            ; value request requestor=thru._
    roll 3                  ; request requestor input=value
    pair 1                  ; request input,requestor
    push bind_beh           ; request input,requestor bind_beh
    actor create            ; request requestor'=bind_beh.input,requestor
    ref std.send_msg

.export
    beh
    boot
    test
