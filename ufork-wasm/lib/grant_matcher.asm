; A uFork implementation of the Grant Matcher Puzzle, described at
; http://erights.org/elib/equality/grant-matcher/index.html.

; It tests several features of uFork's AWP device, including:
;   - capability marshalling
;   - 3-party introductions
;   - proxy equality

; A successful run concludes with Alice and Dana's addresses being sent to the
; debug device.

.import
    dev: "./dev.asm"
    fork: "./fork.asm"
    lib: "./lib.asm"
    std: "./std.asm"

GM_address:
    ref 1111
KEQD_address:
    ref 2222
alice_address:
    ref 3333
dana_address:
    ref 4444

; The Grant Matcher and KEQD start listening at well known addresses.

; In leiu of a uFork implementation of parseq, we wrap the listen operation
; in a service behavior and use fork/join to wait until both parties are
; listening. Requestor failures are not handled gracefully, instead resulting in
; a fault.

boot:                       ; () <- {caps}
    msg 0                   ; {caps}
    push dev.awp_key        ; {caps} awp_key
    dict get                ; awp_dev
    push listen_svc_beh     ; awp_dev listen_svc_beh
    new -1                  ; listen_svc
    dup 1                   ; listen_svc listen_svc
    msg 0                   ; listen_svc listen_svc {caps}
    push pledge_beh         ; listen_svc listen_svc {caps} pledge_beh
    new -1                  ; listen_svc listen_svc pledge
    push fork.beh           ; listen_svc listen_svc pledge fork_beh
    new 3                   ; fork
    push lib.broadcast_beh  ; fork broadcast_beh
    new 0                   ; fork deposit
    push KEQD_greeter_beh   ; fork deposit KEQD_greeter_beh
    new -1                  ; fork KEQD_greeter
    push KEQD_address       ; fork KEQD_greeter KEQD_address
    pair 1                  ; fork KEQD_req
    push #nil               ; fork KEQD_req #nil
    push GM_greeter_beh     ; fork KEQD_req #nil GM_greeter_beh
    new -1                  ; fork KEQD_req GM_greeter
    push GM_address         ; fork KEQD_req GM_greeter GM_address
    pair 1                  ; fork KEQD_req GM_req
    pair 1                  ; fork (GM_req . KEQD_req)
    roll 2                  ; (GM_req . KEQD_req) fork
    ref std.send_msg

listen_svc_beh:             ; awp_dev <- (cust address . greeter)
    msg -2                  ; greeter
    msg 2                   ; greeter address
    msg 1                   ; greeter address cust
    push listen_cb_beh      ; greeter address cust listen_cb_beh
    new -1                  ; greeter address listen_cb
    push #?                 ; greeter address listen_cb #?
    push dev.listen_tag     ; greeter address listen_cb #? #listen
    pair 4                  ; (#listen #? listen_cb address . greeter)
    state 0                 ; (#listen #? listen_cb address . greeter) awp_dev
    ref std.send_msg

listen_cb_beh:              ; cust <- (stop . reason)
    msg -1                  ; reason
    is_eq #?                ; --
    msg 1                   ; stop
    state 0                 ; stop cust
    ref std.send_msg

; Each donor introduces themself to KEQD, acquiring KEQD's "deposit" capability,
; which both uniquely identifies KEQD and provides a way to send KEQD money.
; Each donor also fabricates a "withdraw" capability, which simply sends the
; donor's address to the debug device.

pledge_beh:                 ; {caps} <- (GM_stop . KEQD_stop)
    state 0                 ; {caps}
    push donor_beh          ; {caps} donor_beh
    new -1                  ; donor
    push alice_address      ; donor @alice
    pick 2                  ; donor @alice donor
    send -1                 ; donor
    push dana_address       ; donor @dana
    roll 2                  ; @dana donor
    ref std.send_msg

donor_beh:                  ; {caps} <- address
    state 0                 ; {caps}
    push dev.awp_key        ; {caps} awp_key
    dict get                ; awp_dev
    push intro_svc_beh      ; awp_dev intro_svc_beh
    new -1                  ; intro_svc
    msg 0                   ; intro_svc address
    state 0                 ; intro_svc address {caps}
    push dev.debug_key      ; intro_svc address {caps} debug_key
    dict get                ; intro_svc address debug_dev
    push lib.label_beh      ; intro_svc address debug_dev label_beh
    new 2                   ; intro_svc withdraw
    msg 0                   ; intro_svc withdraw address
    pick 3                  ; intro_svc withdraw address intro_svc
    push donor_k_beh        ; intro_svc withdraw address intro_svc donor_k_beh
    new 3                   ; intro_svg donor_k
    push #?                 ; intro_svc donor_k #?
    msg 0                   ; intro_svc donor_k #? @donor
    push KEQD_address       ; intro_svc donor_k #? @donor @KEQD
    roll 4                  ; intro_svc #? @donor @KEQD donor_k
    roll 5                  ; #? @donor @KEQD donor_k intro_svc
    send 4                  ; --
    ref std.commit

intro_svc_beh:              ; awp_dev <- (cust @to @from hello)
    msg 4                   ; hello
    msg 3                   ; hello @from
    msg 2                   ; hello @from @to
    pair 1                  ; hello connect_info=(@from . @to)
    msg 1                   ; hello connect_info cust
    push intro_cb_beh       ; hello connect_info cust intro_cb_beh
    new -1                  ; hello connect_info intro_cb
    push #?                 ; hello connect_info intro_cb #?
    push dev.intro_tag      ; hello connect_info intro_cb #? #intro
    pair 4                  ; (#intro #? intro_cb connect_info . hello)
    state 0                 ; (#intro #? intro_cb connect_info . hello) awp_dev
    ref std.send_msg

KEQD_greeter_beh:           ; deposit <- (cancel_customer greeting_callback)
    push #?                 ; #?
    state 0                 ; #? deposit
    pair 1                  ; (deposit . #?)
    msg 2                   ; (deposit . #?) greeting_callback
    ref std.send_msg

intro_cb_beh:               ; cust <- (greeting . reason)
    msg -1                  ; reason
    is_eq #?                ; --
    msg 1                   ; greeting
    state 0                 ; greeting cust
    ref std.send_msg

; Each donor sends KEQD's "deposit" capability plus their own "withdraw"
; capability to the Grant Matcher, as part of an introduction request.
; The Grant Matcher's greeting is ignored.

donor_k_beh:                ; (intro_svc address withdraw) <- deposit
    state 3                 ; withdraw
    msg 0                   ; withdraw deposit
    pair 1                  ; (deposit . withdraw)
    state 2                 ; (deposit . withdraw) @donor
    push GM_address         ; (deposit . withdraw) @donor @GM
    push lib.sink_beh       ; (deposit . withdraw) @donor @GM sink_beh
    new 0                   ; (deposit . withdraw) @donor @GM sink
    state 1                 ; (deposit . withdraw) @donor @GM sink intro_svc
    send 4                  ; --
    ref std.commit

; The grant matching is done by the Grant Matcher's greeter. Its state is a
; dictionary of pledges, where each key is a "deposit" capability representing
; the charity, and each value is a "withdraw" capability representing a donor.
; When a second pledge to a particular charity arrives, the charity is sent a
; list of donors.

GM_greeter_beh:             ; {pledges} <- (cancel_cust cb info . pledge)
    msg -3                  ; pledge
    part 1                  ; new_donor deposit
    state 0                 ; new_donor deposit {pledges}
    pick 2                  ; new_donor deposit {pledges} deposit
    dict get                ; new_donor deposit donor
    dup 1                   ; new_donor deposit donor donor
    eq #?                   ; new_donor deposit donor donor==#?
    if_not GM_grant         ; new_donor deposit donor
    drop 1                  ; new_donor deposit
    state 0                 ; new_donor deposit {pledges}
    roll 2                  ; new_donor {pledges} deposit
    roll 3                  ; {pledges} deposit new_donor
    dict set                ; {pledges'}
    ref GM_store

GM_grant:                   ; new_donor deposit donor
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
    ref GM_store

GM_store:                   ; ... {pledges'}
    my beh                  ; {pledges'} beh
    beh -1                  ; --
    ref std.commit

.export
    boot
