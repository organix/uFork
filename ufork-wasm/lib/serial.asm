;;;
;;; one-at-a-time request handler (serializer)
;;;

.import
    std: "./std.asm"
    lib: "./lib.asm"

once_tag_beh:
    ref lib.once_tag_beh

;;  (define serial-beh
;;      (lambda (svc)
;;          (BEH (cust . req)
;;              (define tag (CREATE (once-tag-beh SELF)))
;;              (SEND svc (tag . req))
;;              (BECOME (busy-beh (deque-new) tag cust svc)) )))
serial_beh:             ; (svc) <- (cust . req)
    my self             ; SELF
    push once_tag_beh   ; SELF once-tag-beh
    new 1               ; tag=once-tag.(SELF)

    msg -1              ; tag req
    pick 2              ; tag req tag
    pair 1              ; tag (tag . req)
    state 1             ; tag (tag . req) svc
    send -1             ; tag

    state 1             ; tag svc
    msg 1               ; tag svc cust
    roll 3              ; svc cust tag
    deque new           ; svc cust tag pending
    push busy_beh       ; svc cust tag pending busy-beh
    beh 4               ; --
    ref std.commit

;;  (define busy-beh
;;      (lambda (pending tag cust svc)
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
;;                              (BECOME (busy-beh pending1 tag1 cust1 svc)) )))
;;                  (#t
;;                      (define pending1 (deque-put pending (cons cust0 req0)))
;;                      (BECOME (busy-beh pending1 tag cust svc))) ))))
;;              )))
busy_beh:               ; (pending tag cust svc) <- (cust0 . req0)
    msg 1               ; cust0
    state 2             ; cust0 tag
    cmp eq              ; cust0==tag
    if busy_1           ; --

    my state            ; svc cust tag pending
    msg 0               ; svc cust tag pending (cust0 . req0)
    deque put           ; svc cust tag pending1
    ref busy_3

busy_1:
    msg -1              ; req0
    state 3             ; req0 cust
    send -1             ; --

    state 1             ; pending
    deque pop           ; pending1 next
    dup 1               ; pending1 next next
    eq #?               ; pending1 next next==#?
    if_not busy_2       ; pending1 next

    state 4             ; svc
    push serial_beh     ; svc serial-beh
    beh 1               ; --
    ref std.commit

busy_2:
    part 1              ; pending1 req1 cust1
    my self             ; pending1 req1 cust1 SELF
    push once_tag_beh   ; pending1 req1 cust1 SELF once-tag-beh
    new 1               ; pending1 req1 cust1 tag1=once-tag.(SELF)

    roll 3              ; pending1 cust1 tag1 req1
    pick 2              ; pending1 cust1 tag1 req1 tag1
    pair 1              ; pending1 cust1 tag1 (tag1 . req1)
    state 4             ; pending1 cust1 tag1 (tag1 . req1) svc
    send -1             ; pending1 cust1 tag1

    roll 3              ; cust1 tag1 pending1
    state 4             ; cust1 tag1 pending1 svc
    roll 4              ; svc cust1 tag1 pending1

busy_3:
    push busy_beh       ; svc cust tag pending busy-beh
    beh 4               ; --
    ref std.commit

; unit test suite
boot:                   ; () <- {caps}
    msg 0               ; {caps}
    ref std.commit

.export
    serial_beh
    boot
