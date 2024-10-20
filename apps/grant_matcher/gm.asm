.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

store:
    ref 0

boot:                       ; () <- {caps}
    push #nil               ; {}
    push greeter_beh        ; {} greeter_beh
    new -1                  ; greeter
    push store              ; greeter store
    push #?                 ; greeter store #?
    push listen_cb_beh      ; greeter store #? listen_cb_beh
    new -1                  ; greeter store listen_cb
    push #?                 ; greeter store listen_cb to_cancel=#?
    push dev.listen_tag     ; greeter store listen_cb to_cancel #listen
    pair 4                  ; listen_request=(#listen to_cancel listen_cb store . greeter)
    msg 0                   ; listen_request {caps}
    push dev.awp_key        ; listen_request {caps} awp_key
    dict get                ; listen_request awp_dev
    send -1                 ; --
    ref std.commit

listen_cb_beh:              ; _ <- (ok . result/error)
    msg 1                   ; ok
    assert #t               ; --
    ref std.commit

greeter_beh:                ; {pledges} <- (to_cancel callback petname deposit . withdraw)
    msg 3                   ; petname
    typeq #fixnum_t         ; fixnum?
    assert #t               ; --
    state 0                 ; {pledges}
    msg 4                   ; {pledges} deposit
    dict get                ; donor
    dup 1                   ; donor donor
    eq #?                   ; donor donor==#?
    if_not grant            ; donor
    drop 1                  ;
    state 0                 ; {pledges}
    msg 4                   ; {pledges} deposit
    msg -4                  ; {pledges} deposit withdraw
    dict set                ; {pledges'}
save:
    push greeter_beh        ; {pledges'} greeter_beh
    beh -1                  ; --
    ref std.commit

grant:                      ; donor
    dup 1                   ; donor donor
    msg -4                  ; donor donor withdraw
    cmp eq                  ; donor donor==withdraw
    if std.commit           ; donor
    push #nil               ; donor ()
    roll 2                  ; () donor
    msg -4                  ; () donor withdraw
    pair 2                  ; (withdraw donor)
    msg 4                   ; (withdraw donor) deposit
    send -1                 ; --
    state 0                 ; {pledges}
    msg 4                   ; {pledges} deposit
    dict del                ; {pledges'}
    ref save

.export
    boot
