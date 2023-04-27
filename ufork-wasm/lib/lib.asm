;;;
;;; library of actor idioms
;;;

.import
    std: "./std.asm"

;;  (define sink-beh (BEH _))
sink_beh:
    ref std.sink_beh    ; re-export

;;  (define memo-beh
;;      (lambda (value)
;;          (BEH (cust . _)
;;              (SEND cust value) )))
memo_beh:               ; value
    dup 1               ; value value
    ref std.cust_send

;;  (define fwd-beh
;;      (lambda (rcvr)
;;          (BEH msg
;;              (SEND rcvr msg) )))
fwd_beh:                ; rcvr
    msg 0               ; rcvr msg
    pick 2              ; rcvr msg rcvr
    ref std.send_0

;;  (define once-beh
;;      (lambda (rcvr)
;;          (BEH msg
;;              (BECOME sink-beh)
;;              (SEND rcvr msg) )))
once_beh:               ; rcvr
    push sink_beh       ; rcvr sink-beh
    beh 0               ; rcvr
    ref fwd_beh

;;  (define label-beh
;;      (lambda (rcvr label)
;;          (BEH msg
;;              (SEND rcvr (cons label msg)) )))
label_beh:              ; rcvr label
    msg 0               ; rcvr label msg
    pick 2              ; rcvr label msg label
    pair 1              ; rcvr label (label . msg)
    pick 3              ; rcvr label (label . msg) rcvr
    ref std.send_0

;;  (define tag-beh
;;      (lambda (rcvr)
;;          (BEH msg
;;              (SEND rcvr (cons SELF msg)) )))
tag_beh:                ; rcvr
    my self             ; rcvr label=SELF
    ref label_beh

;;  (define once-tag-beh  ;; FIXME: find a better name for this?
;;      (lambda (rcvr)
;;          (BEH msg
;;              (BECOME sink-beh)
;;              (SEND rcvr (cons SELF msg)) )))
once_tag_beh:           ; rcvr
    push sink_beh       ; rcvr sink-beh
    beh 0               ; sink-beh[]
    ref tag_beh

;;  (define wrap-beh
;;      (lambda (rcvr)
;;          (BEH msg
;;              (SEND rcvr (list msg)) )))
wrap_beh:               ; rcvr
    msg 0               ; rcvr msg
    pick 2              ; rcvr msg rcvr
    send 1              ; rcvr
    ref std.commit

;;  (define unwrap-beh
;;      (lambda (rcvr)
;;          (BEH (msg)
;;              (SEND rcvr msg) )))
unwrap_beh:             ; rcvr
    msg 1               ; rcvr msg
    pick 2              ; rcvr msg rcvr
    ref std.send_0

; unit test suite
;boot:
;    msg 0               ; {caps}
;    ref std.commit

.export
    sink_beh
    memo_beh
    fwd_beh
    once_beh
    label_beh
    tag_beh
    once_tag_beh
    wrap_beh
    unwrap_beh
;    boot
