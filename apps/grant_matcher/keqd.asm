.import
    dev: "https://ufork.org/lib/dev.asm"
    lib: "https://ufork.org/lib/lib.asm"
    std: "https://ufork.org/lib/std.asm"

store:
    ref 0

boot:                       ; () <- {caps}
    push #?                 ; #?
    push lib.broadcast_beh  ; #? broadcast_beh
    new -1                  ; deposit=broadcast_beh.#?
    push greeter_beh        ; deposit greeter_beh
    new -1                  ; greeter=greeter_beh.deposit
    push store              ; greeter store
    push listen_cb_beh      ; greeter store listen_cb_beh
    new 0                   ; greeter store listen_cb
    push #?                 ; greeter store listen_cb to_cancel=#?
    push dev.listen_tag     ; greeter store listen_cb to_cancel #listen
    msg 0                   ; greeter store listen_cb to_cancel #listen {caps}
    push dev.awp_key        ; greeter store listen_cb to_cancel #listen {caps} awp_key
    dict get                ; greeter store listen_cb to_cancel #listen awp_dev
    send 5                  ; --
    ref std.commit

listen_cb_beh:              ; () <- (ok . result/error)
    msg 1                   ; ok
    assert #t               ; --
    ref std.commit

greeter_beh:                ; deposit <- (to_cancel callback petname)
    msg 3                   ; petname
    typeq #fixnum_t         ; fixnum?
    assert #t               ; --
    state 0                 ; deposit
    push #t                 ; deposit ok=#t
    pair 1                  ; result=(ok . deposit)
    msg 2                   ; result callback
    send -1                 ; --
    ref std.commit

.export
    boot
