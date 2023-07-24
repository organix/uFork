.import
    dev: "../../lib/dev.asm"
    std: "../../lib/std.asm"

store:
    ref 0

boot:                       ; () <- {caps}
    push #nil               ; #nil
    push greeter_beh        ; #nil greeter_beh
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

greeter_beh:                ; {pledges} <- (to_cancel callback petname pledge)
    msg 3                   ; petname
    typeq #fixnum_t         ; fixnum?
    is_eq #t                ; --
    msg 4                   ; pledge
    part 1                  ; new_donor deposit
    state 0                 ; new_donor deposit {pledges}
    pick 2                  ; new_donor deposit {pledges} deposit
    dict get                ; new_donor deposit donor
    dup 1                   ; new_donor deposit donor donor
    eq #?                   ; new_donor deposit donor donor==#?
    if_not grant            ; new_donor deposit donor
    drop 1                  ; new_donor deposit
    state 0                 ; new_donor deposit {pledges}
    roll 2                  ; new_donor {pledges} deposit
    roll 3                  ; {pledges} deposit new_donor
    dict set                ; {pledges'}
    ref save

grant:                      ; new_donor deposit donor
    pick 3                  ; new_donor deposit donor new_donor
    pick 2                  ; new_donor deposit donor new_donor donor
    cmp eq                  ; new_donor deposit donor new_donor==donor
    if std.commit
    roll 3                  ; deposit donor new_donor
    pick 3                  ; deposit donor new_donor deposit
    send 2                  ; deposit
    state 0                 ; deposit {pledges}
    roll 2                  ; {pledges} deposit
    dict del                ; {pledges'}
    ref save

save:                       ; ... {pledges'}
    my beh                  ; {pledges'} beh
    beh -1                  ; --
    ref std.commit

.export
    boot
