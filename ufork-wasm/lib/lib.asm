;;;
;;; library of actor idioms
;;;

.import
    std: "./std.asm"

;;  (define sink-beh (BEH _))
sink_beh:               ; () <- _
    ref std.sink_beh    ; re-export

;;  (define const-beh
;;      (lambda value
;;          (BEH (cust . _)
;;              (SEND cust value) )))
const_beh:              ; value <- (cust . _)
    state 0             ; value
    ref std.cust_send

;;  (define memo-beh
;;      (lambda (value . _)
;;          (BEH (cust . _)
;;              (SEND cust value) )))
memo_beh:               ; (value) <- (cust . _)
    state 1             ; value
    ref std.cust_send

;;  (define fwd-beh
;;      (lambda (rcvr)
;;          (BEH msg
;;              (SEND rcvr msg) )))
fwd_beh:                ; (rcvr) <- msg
    msg 0               ; msg
    state 1             ; msg rcvr
    ref std.send_msg

;;  (define init-fwd-beh
;;      (lambda ()
;;          (BEH rcvr
;;              (BECOME (fwd-beh rcvr)) )))
init_fwd_beh:           ; () <- rcvr
    msg 0               ; rcvr
    push fwd_beh        ; rcvr fwd_beh
    beh 1               ; --
    ref std.commit

;;  (define once-beh
;;      (lambda (rcvr)
;;          (BEH msg
;;              (BECOME sink-beh)
;;              (SEND rcvr msg) )))
once_beh:               ; (rcvr) <- msg
    push sink_beh       ; sink-beh
    beh 0               ; --
    ref fwd_beh

;;  (define label-beh
;;      (lambda (rcvr label)
;;          (BEH msg
;;              (SEND rcvr (cons label msg)) )))
label_beh:              ; (rcvr label) <- msg
    msg 0               ; msg
    state 2             ; msg label
    pair 1              ; (label . msg)
    state 1             ; (label . msg) rcvr
    ref std.send_msg

;;  (define tag-beh
;;      (lambda (rcvr)
;;          (BEH msg
;;              (SEND rcvr (cons SELF msg)) )))
tag_beh:                ; (rcvr) <- msg
    msg 0               ; msg
    my self             ; msg label=SELF
    pair 1              ; (label . msg)
    state 1             ; (label . msg) rcvr
    ref std.send_msg

;;  (define once-tag-beh
;;      (lambda (rcvr)
;;          (BEH msg
;;              (BECOME sink-beh)
;;              (SEND rcvr (cons SELF msg)) )))
once_tag_beh:           ; (rcvr) <- msg
    push sink_beh       ; sink-beh
    beh 0               ; --
    ref tag_beh

;;  (define wrap-beh
;;      (lambda (rcvr)
;;          (BEH msg
;;              (SEND rcvr (list msg)) )))
wrap_beh:               ; (rcvr) <- msg
    msg 0               ; msg
    state 1             ; msg rcvr
    send 1              ; --
    ref std.commit

;;  (define unwrap-beh
;;      (lambda (rcvr)
;;          (BEH (msg)
;;              (SEND rcvr msg) )))
unwrap_beh:             ; (rcvr) <- (msg)
    msg 1               ; msg
    state 1             ; msg rcvr
    ref std.send_msg

;;  (define call-beh
;;      (lambda (cust rcvr)
;;          (BEH msg
;;              (SEND rcvr (cons cust msg)) )))
call_beh:               ; (cust rcvr) <- msg
    msg 0               ; msg
    state 1             ; msg cust
    pair 1              ; (cust . msg)
    state 2             ; (cust . msg) rcvr
    ref std.send_msg

;;  (define relay-beh
;;      (lambda (rcvr msg)
;;          (BEH _
;;              (SEND rcvr msg) )))
relay_beh:              ; (rcvr msg) <- _
    my state            ; msg rcvr
    ref std.send_msg

;;  (define tee-beh
;;      (lambda (rcvr1 rcvr2)
;;          (BEH msg
;;              (SEND rcvr1 msg)
;;              (SEND rcvr2 msg) )))
tee_beh:                ; (rcvr1 rcvr2) <- msg
    msg 0               ; msg
    state 1             ; msg rcvr1
    send -1             ; --
    msg 0               ; msg
    state 2             ; msg rcvr2
    ref std.send_msg

;;  (define broadcast-beh
;;      (lambda (value)
;;          (BEH actors
;;              (if (pair? actors)
;;                  (seq
;;                      (SEND (car actors) value)
;;                      (SEND SELF (cdr actors))) ))))
broadcast_beh:          ; (value) <- actors
    msg 0               ; actors
    typeq #pair_t       ; is_pair(actors)
    if_not std.commit   ; --
    msg 0               ; actors
    part 1              ; rest first
    state 1             ; rest first value
    roll 2              ; rest value first
    send -1             ; rest
    my self             ; rest SELF
    ref std.send_msg

; unit test suite
boot:                   ; () <- {caps}
    msg 0               ; {caps}
    ref std.commit

.export
    sink_beh
    const_beh
    memo_beh
    fwd_beh
    init_fwd_beh
    once_beh
    label_beh
    tag_beh
    once_tag_beh
    wrap_beh
    unwrap_beh
    call_beh
    relay_beh
    tee_beh
    broadcast_beh
    boot
