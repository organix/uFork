;;;
;;; one-at-a-time request handler (serializer)
;;;
;;; (c.f.: http://www.dalnefre.com/wp/2020/08/serializers-revisited/)
;;;

.import
    std:  "./std.asm"
    lib:  "./lib.asm"
    cell: "./cell.asm"
    dev:  "./dev.asm"

once_tag_beh:
    ref lib.once_tag_beh

;;  (define serial-beh
;;      (lambda (svc)
;;          (BEH (cust . req)
;;              (define tag (CREATE (once-tag-beh SELF)))
;;              (SEND svc (tag . req))
;;              (BECOME (busy-beh (deque-new) tag cust svc)) )))
beh:
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

    state 4             ; ... svc
    push serial_beh     ; ... svc serial-beh
    beh 1               ; ... --
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
    roll -4             ; svc cust1 tag1 pending1

busy_3:
    push busy_beh       ; svc cust tag pending busy-beh
    beh 4               ; --
    ref std.commit

;;  LET counter_init(value) = \msg.[
;;      CREATE cell WITH cell_beh(value)
;;      CREATE svc WITH counter_svc(cell)
;;      BECOME serial_beh(svc)
;;      SEND msg TO SELF
;;  ]
counter_init:           ; (value) <- msg
    state 1             ; value
    push cell.beh       ; value cell_beh
    new 1               ; cell=cell_beh.(value)

    push counter_svc    ; cell counter_svc
    new 1               ; svc=counter_svc.(cell)

    push serial_beh     ; svc serial_beh
    beh 1               ; --

    msg 0               ; msg
    my self             ; msg SELF
    ref std.send_msg

;;  # WARNING! `counter_svc` must be protected by a serializer!
;;  LET counter_svc(cell) = \(cust, change).[
;;      SEND (SELF, #read) TO cell
;;      BECOME \count.[
;;          LET count' = $add(count, change)
;;          SEND (SELF, #write, count') TO cell
;;          BECOME \$cell.[
;;              SEND count' TO cust
;;              BECOME counter_svc(cell)
;;          ]
;;      ]
;;  ]
counter_svc:            ; (cell) <- (cust change)
    my self             ; SELF
    push cell.read_tag  ; SELF #read
    state 1             ; SELF #read cell
    send 2              ; --

    msg 0               ; (cust change)
    state 1             ; (cust change) cell
    pair 1              ; (cell cust change)
    push counter_k1     ; (cell cust change) counter_k1
    beh -1              ; --
    ref std.commit

counter_k1:             ; (cell cust change) <- count
    msg 0               ; count
    state 3             ; change
    alu add             ; count'=count+change

    dup 1               ; count' count'
    my self             ; count' count' SELF
    push cell.write_tag ; count' count' SELF #write
    state 1             ; count' count' SELF #write cell
    send 3              ; count'

    state 2             ; count' cust
    push counter_k2     ; count' cust counter_k2
    beh 2               ; --
    ref std.commit

counter_k2:             ; (cust count') <- cell
    my state            ; count' cust
    send -1             ; --

    msg 0               ; cell
    push counter_svc    ; cell counter_svc
    beh 1               ; --
    ref std.commit

; unit test suite
;;  CREATE counter WITH counter_init(0)
;;  SEND (println, 7) TO counter
;;  SEND (println, 70) TO counter
;;  SEND (println, 700) TO counter
boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.debug_key  ; {caps} dev.debug_key
    dict get            ; debug_dev

    push 0              ; debug_dev 0
    push counter_init   ; debug_dev 0 counter_init
    new 1               ; debug_dev counter=counter_init.(0)

    dup 2               ; debug_dev counter debug_dev counter
    push 7              ; debug_dev counter debug_dev counter 7
    roll -3             ; debug_dev counter 7 debug_dev counter
    send 2              ; debug_dev counter

    push 70             ; debug_dev counter 70
    pick 3              ; debug_dev counter 70 debug_dev
    pick 3              ; debug_dev counter 70 debug_dev counter
    send 2              ; debug_dev counter

    push 700            ; debug_dev counter 700
    roll -3             ; 700 debug_dev counter
    send 2              ; --

    ref std.commit

.export
    beh
    boot
