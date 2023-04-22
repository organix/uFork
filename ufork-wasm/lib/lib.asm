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

;;  (define future-beh
;;      (lambda (rcap wcap)
;;          (BEH (tag . arg)
;;              (cond
;;                  ((eq? tag rcap)
;;                      (BECOME (wait-beh rcap wcap (list arg))))
;;                  ((eq? tag wcap)
;;                      (BECOME (value-beh rcap arg))) ))))
future_beh:             ; rcap wcap
    msg 1               ; rcap wcap tag
    pick 3              ; rcap wcap tag rcap
    cmp eq              ; rcap wcap tag==rcap
    if_not future_1     ; rcap wcap
future_0:
    push #nil           ; rcap wcap ()
    msg -1              ; rcap wcap () arg
    pair 1              ; rcap wcap (arg)
    push wait_beh       ; rcap wcap (arg) wait-beh
    beh 3               ; wait-beh[rcap wcap (arg)]
    ref std.commit
future_1:
    msg 1               ; rcap wcap tag
    pick 2              ; rcap wcap tag wcap
    cmp eq              ; rcap wcap tag==wcap
    if_not std.abort    ; rcap wcap
future_2:
    drop 1              ; rcap
    msg -1              ; rcap value=arg
    push value_beh      ; rcap value=arg value-beh
    beh 2               ; value-beh[rcap value]
    ref std.commit

;;  (define wait-beh
;;      (lambda (rcap wcap waiting)
;;          (BEH (tag . arg)
;;              (cond
;;                  ((eq? tag rcap)
;;                      (BECOME (wait-beh rcap wcap (cons arg waiting))))
;;                  ((eq? tag wcap)
;;                      (send-to-all waiting arg)
;;                      (BECOME (value-beh rcap arg))) ))))
wait_beh:               ; rcap wcap waiting
    msg 1               ; rcap wcap waiting tag
    pick 4              ; rcap wcap waiting tag rcap
    cmp eq              ; rcap wcap waiting tag==rcap
    if_not wait_1       ; rcap wcap waiting
wait_0:
    msg -1              ; rcap wcap waiting arg
    pair 1              ; rcap wcap (arg . waiting)
    push wait_beh       ; rcap wcap (arg . waiting) wait-beh
    beh 3               ; wait-beh[rcap wcap (arg . waiting)]
    ref std.commit
wait_1:
    msg 1               ; rcap wcap waiting tag
    pick 3              ; rcap wcap waiting tag wcap
    cmp eq              ; rcap wcap waiting tag==wcap
    if_not std.abort    ; rcap wcap waiting
wait_2:
    dup 1               ; rcap wcap waiting waiting
    typeq #pair_t       ; rcap wcap waiting is_pair(waiting)
    if_not wait_4       ; rcap wcap waiting
wait_3:
    part 1              ; rcap wcap rest first
    msg -1              ; rcap wcap rest first value=arg
    roll 2              ; rcap wcap rest value=arg first
    send 0              ; rcap wcap rest
    ref wait_2
wait_4:
    drop 2              ; rcap
    msg -1              ; rcap value=arg
    push value_beh      ; rcap value=arg value-beh
    beh 2               ; value-beh[rcap value]
    ref std.commit

;;  (define value-beh
;;      (lambda (rcap value)
;;          (BEH (tag . arg)
;;              (cond
;;                  ((eq? tag rcap)
;;                      (SEND arg value))) )))
value_beh:              ; rcap value
    msg 1               ; rcap value tag
    pick 3              ; rcap value tag rcap
    cmp eq              ; rcap value tag==rcap
    if_not std.commit   ; rcap value
    pick 1              ; rcap value value
    msg -1              ; rcap value value cust=arg
    ref std.send_0

;;  (define serial-beh
;;      (lambda (svc)
;;          (BEH (cust . req)
;;              (define tag (CREATE (once-tag-beh SELF)))
;;              (SEND svc (tag . req))
;;              (BECOME (busy-beh svc cust tag (deque-new))) )))
serial_beh:             ; svc
    msg 1               ; svc cust
    my self             ; svc cust SELF
    push once_tag_beh   ; svc cust SELF once-tag-beh
    new 1               ; svc cust tag=once-tag-beh[SELF]
serial_0:
    msg -1              ; svc cust tag req
    pick 2              ; svc cust tag req tag
    pair 1              ; svc cust tag (tag . req)
    pick 4              ; svc cust tag (tag . req) svc
    send 0              ; svc cust tag
serial_1:
    deque new           ; svc cust tag pending
    push busy_beh       ; svc cust tag pending busy-beh
    beh 4               ; busy-beh[svc cust tag pending]
    ref std.commit

;;  (define busy-beh
;;      (lambda (svc cust tag pending)
;;          (BEH (cust0 . req0)
;;              (cond
;;                  ((eq? cust0 tag)
;;                      (SEND cust req0)
;;                      (define (next pending1) (deque-pop pending))
;;                      (cond
;;                          ((eq? next #?)
;;                              (BECOME (serial-beh svc)))  ; return to "ready" state
;;                          (#t
;;                              (define (cust1 . req1) next)
;;                              (define tag1 (CREATE (once-tag-beh SELF)))
;;                              (SEND svc (tag1 . req1))
;;                              (BECOME (busy-beh svc cust1 tag1 pending1)) )))
;;                  (#t
;;                      (define pending1 (deque-put pending (cons cust0 req0)))
;;                      (BECOME (busy-beh svc cust tag pending1))) ))))
;;              )))
busy_beh:               ; svc cust tag pending
    msg 1               ; svc cust tag pending cust0
    pick 3              ; svc cust tag pending cust0 tag
    cmp eq              ; svc cust tag pending cust0==tag
    if_not busy_4       ; svc cust tag pending
busy_0:
    msg -1              ; svc cust tag pending req0
    roll 4              ; svc tag pending req0 cust
    send 0              ; svc tag pending
    deque pop           ; svc tag pending1 next
    dup 1               ; svc tag pending1 next next
    eq #?               ; svc tag pending1 next next==#?
    if_not busy_2       ; svc tag pending1 next
busy_1:
    drop 3              ; svc
    push serial_beh     ; svc serial-beh
    beh 1               ; serial-beh[svc]
    ref std.commit
busy_2:
    part 1              ; svc tag pending1 req1 cust1
    my self             ; svc tag pending1 req1 cust1 SELF
    push once_tag_beh   ; svc tag pending1 req1 cust1 SELF once-tag-beh
    new 1               ; svc tag pending1 req1 cust1 tag1=once-tag-beh[SELF]
    roll 3              ; svc tag pending1 cust1 tag1 req1
    pick 2              ; svc tag pending1 cust1 tag1 req1 tag1
    pair 1              ; svc tag pending1 cust1 tag1 (tag1 . req1)
    pick 6              ; svc tag pending1 cust1 tag1 (tag1 . req1) svc
    send 0              ; svc tag pending1 cust1 tag1
    roll 5              ; tag pending1 cust1 tag1 svc
    roll -3             ; tag pending1 svc cust1 tag1
    roll 4              ; tag svc cust1 tag1 pending1
busy_3:
    push busy_beh       ; ... svc cust1 tag1 pending1 busy-beh
    beh 4               ; busy-beh[svc cust1 tag1 pending1]
    ref std.commit
busy_4:
    msg 0               ; svc cust tag pending (cust0 . req0)
    deque put           ; svc cust tag pending1
    ref busy_3

; unit test suite
boot:
    msg 0               ; {caps}
loop:
again:
    dup 0               ; {caps}
    ref loop            ; {caps}

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
    future_beh
    wait_beh
    value_beh
    serial_beh
    busy_beh
    boot
