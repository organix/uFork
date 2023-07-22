; A uFork implementation of the Grant Matcher Puzzle, described at
; http://erights.org/elib/equality/grant-matcher/index.html.

; It tests several aspects of uFork's AWP device, including:
;   - capability marshalling
;   - 3-party introductions
;   - proxy equality

; A successful run concludes with Alice and Dana's store numbers being sent to
; the debug device.

.import
    dev: "./dev.asm"
    fork: "./fork.asm"
    lib: "./lib.asm"
    std: "./std.asm"

alice_store:
    ref 0
GM_store:
    ref 1
KEQD_store:
    ref 2
dana_store:
    ref 3
GM_petname:
    ref 1
KEQD_petname:
    ref 2

; The Grant Matcher and KEQD start listening.

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
    push KEQD_store         ; fork KEQD_greeter KEQD_store
    pair 1                  ; fork KEQD_req
    push #nil               ; fork KEQD_req #nil
    push GM_greeter_beh     ; fork KEQD_req #nil GM_greeter_beh
    new -1                  ; fork KEQD_req GM_greeter
    push GM_store           ; fork KEQD_req GM_greeter GM_store
    pair 1                  ; fork KEQD_req GM_req
    pair 1                  ; fork (GM_req . KEQD_req)
    roll 2                  ; (GM_req . KEQD_req) fork
    ref std.send_msg

listen_svc_beh:             ; awp_dev <- (cust store . greeter)
    msg -2                  ; greeter
    msg 2                   ; greeter store
    msg 1                   ; greeter store cust
    push listen_cb_beh      ; greeter store cust listen_cb_beh
    new -1                  ; greeter store listen_cb
    push #?                 ; greeter store listen_cb #?
    push dev.listen_tag     ; greeter store listen_cb #? #listen
    state 0                 ; greeter store listen_cb #? #listen awp_dev
    send 5                  ; --
    ref std.commit

listen_cb_beh:              ; cust <- (stop . error)
    msg -1                  ; error
    is_eq #nil              ; --
    msg 1                   ; stop
    typeq #actor_t          ; actor?(stop)
    is_eq #t                ; --
    msg 1                   ; stop
    state 0                 ; stop cust
    ref std.send_msg

; Each donor introduces themself to KEQD, acquiring KEQD's "deposit" capability,
; which both uniquely identifies KEQD and provides a way to send KEQD money.
; Each donor also fabricates a "withdraw" capability, which simply sends the
; donor's store number to the debug device.

pledge_beh:                 ; {caps} <- (GM_stop . KEQD_stop)
    state 0                 ; {caps}
    push donor_beh          ; {caps} donor_beh
    new -1                  ; donor
    push alice_store        ; donor &alice
    pick 2                  ; donor &alice donor
    send -1                 ; donor
    push dana_store         ; donor &dana
    roll 2                  ; &dana donor
    ref std.send_msg

donor_beh:                  ; {caps} <- store
    msg 0                   ; store
    state 0                 ; store {caps}
    push dev.awp_key        ; store {caps} awp_key
    dict get                ; store awp_dev
    push intro_svc_beh      ; store awp_dev intro_svc_beh
    new 2                   ; intro_svc
    msg 0                   ; intro_svc store
    state 0                 ; intro_svc store {caps}
    push dev.debug_key      ; intro_svc store {caps} debug_key
    dict get                ; intro_svc store debug_dev
    push lib.label_beh      ; intro_svc store debug_dev label_beh
    new 2                   ; intro_svc withdraw
    pick 2                  ; intro_svc withdraw intro_svc
    push donor_k_beh        ; intro_svc withdraw intro_svc donor_k_beh
    new 2                   ; intro_svc donor_k
    push KEQD_petname       ; intro_svc donor_k @KEQD
    roll 2                  ; intro_svc @KEQD donor_k
    roll 3                  ; @KEQD donor_k intro_svc
    send 2                  ; --
    ref std.commit

intro_svc_beh:              ; (awp_dev store) <- (cust petname hello)
    msg 3                   ; hello
    msg 2                   ; hello petname
    state 2                 ; hello petname store
    msg 1                   ; hello petname store cust
    push intro_cb_beh       ; hello petname store cust intro_cb_beh
    new -1                  ; hello petname store intro_cb
    push #?                 ; hello petname store intro_cb #?
    push dev.intro_tag      ; hello petname store intro_cb #? #intro
    state 1                 ; hello petname store intro_cb #? #intro awp_dev
    send 6                  ; --
    ref std.commit

KEQD_greeter_beh:           ; deposit <- (to_cancel callback petname)
    msg 3                   ; petname
    typeq #fixnum_t         ; fixnum?
    is_eq #t                ; --
    state 0                 ; deposit
    msg 2                   ; deposit callback
    send 1                  ; --
    ref std.commit

intro_cb_beh:               ; cust <- (greeting . error)
    msg -1                  ; error
    is_eq #nil              ; --
    msg 1                   ; greeting
    state 0                 ; greeting cust
    ref std.send_msg

; Each donor sends KEQD's "deposit" capability plus their own "withdraw"
; capability to the Grant Matcher, as part of an introduction request.
; The Grant Matcher's greeting is ignored.

donor_k_beh:                ; (intro_svc withdraw) <- deposit
    state 2                 ; withdraw
    msg 0                   ; withdraw deposit
    pair 1                  ; (deposit . withdraw)
    push GM_petname         ; (deposit . withdraw) @GM
    push lib.sink_beh       ; (deposit . withdraw) @GM sink_beh
    new 0                   ; (deposit . withdraw) @GM sink
    state 1                 ; (deposit . withdraw) @GM sink intro_svc
    send 3                  ; --
    ref std.commit

; The grant matching is done by the Grant Matcher's greeter. Its state is a
; dictionary of pledges, where each key is a "deposit" capability representing
; the charity, and each value is a "withdraw" capability representing a donor.
; When a second pledge to a particular charity arrives, the charity is sent a
; list of donors.

GM_greeter_beh:             ; {pledges} <- (to_cancel callback petname pledge)
    msg 4                   ; pledge
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
    ref GM_save

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
    ref GM_save

GM_save:                    ; ... {pledges'}
    my beh                  ; {pledges'} beh
    beh -1                  ; --
    ref std.commit

.export
    boot
