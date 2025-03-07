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

;;  (define serial-beh
;;      (lambda (svc)
;;          (BEH (cust . req)
;;              (define tag (CREATE (once-tag-beh SELF)))   ; FIXME: REPLACE WITH HUMUS DEFINITIONS
;;              (SEND svc (tag . req))
;;              (BECOME (busy-beh (deque-new) tag cust svc)) )))
beh:
serial_beh:                 ; svc <- cust,req
    actor self              ; SELF
    push lib.once_tag_beh   ; SELF once-tag-beh
    actor create            ; tag=once-tag.SELF

    msg -1                  ; tag req
    pick 2                  ; tag req tag
    pair 1                  ; tag tag,req
    state 0                 ; tag tag,req svc
    actor send              ; tag

    state 0                 ; tag svc
    msg 1                   ; tag svc cust
    roll 3                  ; svc cust tag
    deque new               ; svc cust tag pending
    pair 3                  ; pending,tag,cust,svc
    push busy_beh           ; pending,tag,cust,svc busy-beh
    actor become            ; --
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
busy_beh:                   ; pending,tag,cust,svc <- cust0,req0
    msg 1                   ; cust0
    state 2                 ; cust0 tag
    cmp eq                  ; cust0==tag
    if busy_1               ; --

    state 0                 ; pending,tag,cust,svc
    part 3                  ; svc cust tag pending
    msg 0                   ; svc cust tag pending cust0,req0
    deque put               ; svc cust tag pending1
    ref busy_3

busy_1:
    msg -1                  ; req0
    state 3                 ; req0 cust
    actor send              ; --

    state 1                 ; pending
    deque pop               ; pending1 next
    dup 1                   ; pending1 next next
    eq #?                   ; pending1 next next==#?
    if_not busy_2           ; pending1 next

    state -3                ; ... svc
    push serial_beh         ; ... svc serial-beh
    actor become            ; ... --
    ref std.commit

busy_2:
    part 1                  ; pending1 req1 cust1
    actor self              ; pending1 req1 cust1 SELF
    push lib.once_tag_beh   ; pending1 req1 cust1 SELF once-tag-beh
    actor create            ; pending1 req1 cust1 tag1=once-tag.SELF

    roll 3                  ; pending1 cust1 tag1 req1
    pick 2                  ; pending1 cust1 tag1 req1 tag1
    pair 1                  ; pending1 cust1 tag1 tag1,req1
    state -3                ; pending1 cust1 tag1 tag1,req1 svc
    actor send              ; pending1 cust1 tag1

    roll 3                  ; cust1 tag1 pending1
    state -3                ; cust1 tag1 pending1 svc
    roll -4                 ; svc cust1 tag1 pending1

busy_3:
    pair 3                  ; pending,tag,cust,svc
    push busy_beh           ; pending,tag,cust,svc busy-beh
    actor become            ; --
    ref std.commit

;;  LET counter_init(value) = \msg.[
;;      CREATE cell WITH cell_beh(value)
;;      CREATE svc WITH counter_svc(cell)
;;      BECOME serial_beh(svc)
;;      SEND msg TO SELF
;;  ]
counter_init:               ; value <- msg
    state 0                 ; value
    push cell.beh           ; value cell_beh
    actor create            ; cell=cell_beh.value

    push counter_svc        ; cell counter_svc
    actor create            ; svc=counter_svc.cell

    push serial_beh         ; svc serial_beh
    actor become            ; --

    msg 0                   ; msg
    actor self              ; msg SELF
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
counter_svc:                ; cell <- cust,change
    push #?                 ; #?
    actor self              ; #? SELF
    push cell.read_op       ; #? SELF #read
    pair 2                  ; #read,SELF,#?
    state 0                 ; #read,SELF,#? cell
    actor send              ; --

    msg 0                   ; cust,change
    state 0                 ; cust,change cell
    pair 1                  ; cell,cust,change
    push counter_k1         ; cell,cust,change counter_k1
    actor become            ; --
    ref std.commit

counter_k1:                 ; cell,cust,change <- count
    msg 0                   ; count
    state -2                ; count change
    alu add                 ; count'=count+change

    dup 1                   ; count' count'
    actor self              ; count' count' SELF
    push cell.write_op      ; count' count' SELF #write
    pair 2                  ; count' #write,SELF,count'
    state 1                 ; count' #write,SELF,count' cell
    actor send              ; count'

    state 2                 ; count' cust
    pair 1                  ; cust,count'
    push counter_k2         ; cust,count' counter_k2
    actor become            ; --
    ref std.commit

counter_k2:                 ; cust,count' <- cell
    state -1                ; count'
    state 1                 ; count' cust
    actor send              ; --

    msg 0                   ; cell
    push counter_svc        ; cell counter_svc
    actor become            ; --
    ref std.commit

; unit test suite (should eventually print +777)
;;  CREATE counter WITH counter_init(0)
;;  SEND (println, 7) TO counter
;;  SEND (println, 70) TO counter
;;  SEND (println, 700) TO counter
boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} dev.debug_key
    dict get                ; debug_dev

    push 0                  ; debug_dev 0
    push counter_init       ; debug_dev 0 counter_init
    actor create            ; debug_dev counter=counter_init.0

    push 7                  ; debug_dev counter 7
    pick 3                  ; debug_dev counter 7 debug_dev
    pair 1                  ; debug_dev counter debug_dev,7
    pick 2                  ; debug_dev counter debug_dev,7 counter
    actor send              ; debug_dev counter

    push 70                 ; debug_dev counter 70
    pick 3                  ; debug_dev counter 70 debug_dev
    pair 1                  ; debug_dev counter debug_dev,70
    pick 2                  ; debug_dev counter debug_dev,70 counter
    actor send              ; debug_dev counter

    push 700                ; debug_dev counter 700
    pick 3                  ; debug_dev counter 700 debug_dev
    pair 1                  ; debug_dev counter debug_dev,700
    pick 2                  ; debug_dev counter debug_dev,700 counter
    actor send              ; debug_dev counter
    ref std.commit

.export
    beh
    boot
