; A single-core uFork implementation of the Grant Matcher Puzzle, described at
; http://erights.org/elib/equality/grant-matcher/index.html.

; It tests several aspects of uFork's AWP device, including:
;   - capability marshalling
;   - 3-party introductions
;   - proxy equality

; A successful run concludes with Alice and Dana's store numbers being sent to
; the debug device.

; This is the local application that was split up into donor.asm, gm.asm, etc.
; to form the distributed application.

.import
    dev: "https://ufork.org/lib/dev.asm"
    fork: "https://ufork.org/lib/fork.asm"
    lib: "https://ufork.org/lib/lib.asm"
    std: "https://ufork.org/lib/std.asm"

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
    pair 2                  ; (pledge listen_svc . listen_svc)
    push fork.beh           ; (pledge listen_svc . listen_svc) fork_beh
    new -1                  ; fork=fork_beh.(pledge listen_svc . listen_svc)
    push #?                 ; fork #?
    push lib.broadcast_beh  ; fork #? broadcast_beh
    new -1                  ; fork deposit=broadcast_beh.#?
    push KEQD_greeter_beh   ; fork deposit KEQD_greeter_beh
    new -1                  ; fork KEQD_greeter
    push KEQD_store         ; fork KEQD_greeter KEQD_store
    pair 1                  ; fork KEQD_req
    push #nil               ; fork KEQD_req {}
    push GM_greeter_beh     ; fork KEQD_req {} GM_greeter_beh
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
    push #?                 ; greeter store listen_cb to_cancel=#?
    push dev.listen_tag     ; greeter store listen_cb to_cancel #listen
    pair 4                  ; listen_request=(#listen to_cancel listen_cb store . greeter)
    state 0                 ; listen_request awp_dev
    send -1                 ; --
    ref std.commit

listen_cb_beh:              ; cust <- (ok . stop/error)
    msg 1                   ; ok
    assert #t               ; --
    msg -1                  ; stop
    dup 1                   ; stop stop
    typeq #actor_t          ; stop actor?(stop)
    assert #t               ; stop
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
    pair 1                  ; (awp_dev . store)
    push intro_svc_beh      ; (awp_dev . store) intro_svc_beh
    new -1                  ; intro_svc
    msg 0                   ; intro_svc store
    state 0                 ; intro_svc store {caps}
    push dev.debug_key      ; intro_svc store {caps} debug_key
    dict get                ; intro_svc store debug_dev
    pair 1                  ; intro_svc (debug_dev . store)
    push lib.label_beh      ; intro_svc (debug_dev . store) label_beh
    new -1                  ; intro_svc withdraw=label_beh.(debug_dev . store)
    pick 2                  ; intro_svc withdraw intro_svc
    pair 1                  ; intro_svc (intro_svc . withdraw)
    push donor_k_beh        ; intro_svc (intro_svc . withdraw) donor_k_beh
    new -1                  ; intro_svc donor_k
    push #?                 ; intro_svc donor_k hello=#?
    push KEQD_petname       ; intro_svc donor_k hello @KEQD
    roll 3                  ; intro_svc hello @KEQD donor_k
    pair 2                  ; intro_svc (donor_k @KEQD . hello)
    roll 2                  ; (donor_k @KEQD . hello) intro_svc
    send -1                 ; --
    ref std.commit

intro_svc_beh:              ; (awp_dev . store) <- (cust petname . hello)
    msg -1                  ; (petname . hello)
    state -1                ; (petname . hello) store
    msg 1                   ; (petname . hello) store cust
    push intro_cb_beh       ; (petname . hello) store cust intro_cb_beh
    new -1                  ; (petname . hello) store intro_cb
    push #?                 ; (petname . hello) store intro_cb to_cancel=#?
    push dev.intro_tag      ; (petname . hello) store intro_cb to_cancel #intro
    pair 4                  ; intro_request=(#intro to_cancel intro_cb store petname . hello)
    state 1                 ; intro_request awp_dev
    send -1                 ; --
    ref std.commit

KEQD_greeter_beh:           ; deposit <- (to_cancel callback petname . _)
    msg 3                   ; petname
    typeq #fixnum_t         ; fixnum?
    assert #t               ; --
    state 0                 ; deposit
    push #t                 ; deposit ok=#t
    pair 1                  ; result=(ok . deposit)
    msg 2                   ; result callback
    send -1                 ; --
    ref std.commit

intro_cb_beh:               ; cust <- (ok . greeting/error)
    msg 1                   ; ok
    assert #t               ; --
    msg -1                  ; greeting
    state 0                 ; greeting cust
    ref std.send_msg

; Each donor sends KEQD's "deposit" capability plus their own "withdraw"
; capability to the Grant Matcher, as part of an introduction request.
; The Grant Matcher's greeting is ignored.

donor_k_beh:                ; (intro_svc . withdraw) <- deposit
    state -1                ; withdraw
    msg 0                   ; withdraw deposit
    pair 1                  ; (deposit . withdraw)
    push GM_petname         ; (deposit . withdraw) @GM
    push #?                 ; (deposit . withdraw) @GM #?
    push lib.sink_beh       ; (deposit . withdraw) @GM #? sink_beh
    new -1                  ; (deposit . withdraw) @GM sink=sink_beh.#?
    pair 2                  ; intro_request=(sink @GM deposit . withdraw)
    state 1                 ; intro_request intro_svc
    send -1                 ; --
    ref std.commit

; The grant matching is done by the Grant Matcher's greeter. Its state is a
; dictionary of pledges, where each key is a "deposit" capability representing
; the charity, and each value is a "withdraw" capability representing a donor.
; When a second pledge to a particular charity arrives, the charity is sent a
; list of donors.

GM_greeter_beh:             ; {pledges} <- (to_cancel callback petname deposit . withdraw)
    state 0                 ; {pledges}
    msg 4                   ; {pledges} deposit
    dict get                ; donor
    dup 1                   ; donor donor
    eq #?                   ; donor donor==#?
    if_not GM_grant         ; donor
    drop 1                  ;
    state 0                 ; {pledges}
    msg 4                   ; {pledges} deposit
    msg -4                  ; {pledges} deposit withdraw
    dict set                ; {pledges'}
GM_save:
    push GM_greeter_beh     ; {pledges'} GM_greeter_beh
    beh -1                  ; --
    ref std.commit

GM_grant:                   ; donor
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
    ref GM_save

.export
    boot
