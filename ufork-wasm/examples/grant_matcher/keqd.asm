.import
    dev: "../../lib/dev.asm"
    lib: "../../lib/lib.asm"
    std: "../../lib/std.asm"

store:
    ref 0

boot:                       ; () <- {caps}
    push lib.broadcast_beh  ; broadcast_beh
    new 0                   ; deposit
    push greeter_beh        ; deposit greeter_beh
    new -1                  ; greeter
    push store              ; greeter store
    push listen_cb_beh      ; greeter store listen_cb_beh
    new 0                   ; greeter store listen_cb
    push #?                 ; greeter store listen_cb #?
    push dev.listen_tag     ; greeter store listen_cb #? #listen
    msg 0                   ; greeter store listen_cb #? #listen {caps}
    push dev.awp_key        ; greeter store listen_cb #? #listen {caps} awp_key
    dict get                ; greeter store listen_cb #? #listen awp_dev
    send 5                  ; --
    ref std.commit

listen_cb_beh:              ; () <- (result . error)
    msg -1                  ; error
    is_eq #nil              ; --
    ref std.commit

greeter_beh:                ; deposit <- (to_cancel callback petname)
    msg 3                   ; petname
    typeq #fixnum_t         ; fixnum?
    is_eq #t                ; --
    state 0                 ; deposit
    msg 2                   ; deposit callback
    send 1                  ; --
    ref std.commit

.export
    boot
