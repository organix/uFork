;;;
;;; library of actor idioms
;;;

.import
    std: "./std.asm"

;;  DEF sink_beh AS \_.[]
sink_beh:                   ; _ <- _
    ref std.sink_beh        ; re-export

;;  DEF const_beh(value) AS \(cust, _).[
;;      SEND value TO cust
;;  ]
const_beh:                  ; value <- (cust . _)
    state 0                 ; value
    ref std.cust_send

;;  DEF fwd_beh(rcvr) AS \msg.[
;;      SEND msg TO rcvr
;;  ]
fwd_beh:                    ; rcvr <- msg
    msg 0                   ; msg
    state 0                 ; msg rcvr
    ref std.send_msg

;;  DEF init_fwd_beh AS \rcvr.[
;;      BECOME fwd_beh(rcvr)
;;  ]
init_fwd_beh:               ; _ <- rcvr
    msg 0                   ; rcvr
    push fwd_beh            ; rcvr fwd_beh
    actor become            ; --
    ref std.commit

;;  DEF once_beh(rcvr) AS \msg.[
;;      BECOME sink_beh
;;      SEND msg TO rcvr
;;  ]
once_beh:                   ; rcvr <- msg
    push #?                 ; #?
    push sink_beh           ; #? sink_beh
    actor become            ; --
    ref fwd_beh

;;  DEF label_beh(rcvr, label) AS \msg.[
;;      SEND (label, msg) TO rcvr
;;  ]
label_beh:                  ; (rcvr . label) <- msg
    msg 0                   ; msg
    state -1                ; msg label
    pair 1                  ; (label . msg)
    state 1                 ; (label . msg) rcvr
    ref std.send_msg

;;  DEF tag_beh(rcvr) AS \msg.[
;;      SEND (SELF, msg) TO rcvr
;;  ]
tag_beh:                    ; rcvr <- msg
    msg 0                   ; msg
    my self                 ; msg label=SELF
    pair 1                  ; (label . msg)
    state 0                 ; (label . msg) rcvr
    ref std.send_msg

;;  DEF once_tag_beh(rcvr) AS \msg.[
;;      BECOME sink_beh
;;      SEND (SELF, msg) TO rcvr
;;  ]
once_tag_beh:               ; rcvr <- msg
    push #?                 ; #?
    push sink_beh           ; #? sink_beh
    actor become            ; --
    ref tag_beh

;;  DEF relay_beh(rcvr, msg) AS \_.[
;;      SEND msg TO rcvr
;;  ]
relay_beh:                  ; (rcvr . msg) <- _
    state -1                ; msg
    state 1                 ; msg rcvr
;    state 0                 ; (rcvr . msg)
;    part 1                  ; msg rcvr
    ref std.send_msg

;;  DEF tee_beh(rcvr1, rcvr2) AS \msg.[
;;      SEND msg TO rcvr1
;;      SEND msg TO rcvr2
;;  ]
tee_beh:                    ; (rcvr1 . rcvr2) <- msg
    msg 0                   ; msg
    state 1                 ; msg rcvr1
    actor send              ; --
    msg 0                   ; msg
    state -1                ; msg rcvr2
    ref std.send_msg

;;  DEF broadcast_beh(value) AS \actors.[
;;      CASE actors OF
;;      (first, rest) : [
;;          SEND value TO first
;;          SEND rest TO SELF
;;      ]
;;      END
;;  ]
broadcast_beh:              ; value <- actors
    msg 0                   ; actors
    typeq #pair_t           ; is_pair(actors)
    if_not std.commit       ; --
    msg 0                   ; actors
    part 1                  ; rest first
    state 0                 ; rest first value
    roll 2                  ; rest value first
    actor send              ; rest
    my self                 ; rest SELF
    ref std.send_msg

.export
    sink_beh
    const_beh
    fwd_beh
    init_fwd_beh
    once_beh
    label_beh
    tag_beh
    once_tag_beh
;    call_beh                ; semantically `label_beh` with swapped parameters
    relay_beh
    tee_beh
    broadcast_beh
