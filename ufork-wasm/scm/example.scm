;
; example Scheme source code
;

(define sink-beh (BEH _))
;sink_beh:               ; () <- _
;    ref std.sink_beh    ; re-export

(define memo-beh
    (lambda (value)
        (BEH (cust)
            (SEND cust value) )))
;memo_beh:               ; (value) <- (cust . _)
;    state 1             ; value
;    ref std.cust_send

(define fwd-beh
    (lambda (rcvr)
        (BEH msg
            (SEND rcvr msg) )))
;fwd_beh:                ; (rcvr) <- msg
;    msg 0               ; msg
;    state 1             ; msg rcvr
;    ref std.send_msg

(list () #? #nil #f #t #unit '(#pair_t . #actor_t))

;(SEND
;    (CREATE (memo-beh 42))
;    (list (CREATE sink-beh)))

(define f
    (lambda (x)
        (+ 1 (if x 42 69)) ))
(let (
        (x (seq (f -1) (f 0)))
        (y (f 1))
    )
    (list x y)
    (cons x y))
