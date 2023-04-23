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
    ref std.commit

.export
    serial_beh
    boot
