;
; example Scheme source code
;

(import dev "../lib/dev.asm")

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

(define start
    (lambda (debug-dev)
        (SEND
            (CREATE (memo-beh 42))
;            (list (CREATE sink-beh))
            (list debug-dev)
        )))

;(list () #? #nil #f #t #unit '(#pair_t . #actor_t))

;((lambda (x) x) (list 1 2 3))

;(define add3
;    (let ((x 3))  ; requires full interpreter in compiler
;        (lambda (y) (+ x y))))
;(add3 5)                  ; ⇒ 8

;(define f
;    (lambda (x)
;        (+ 1 (if x 42 69)) ))
;(define g f)
;(let ((x (seq (g -1) (f 0)))
;      (y (f 1)))
;    (list x y)
;    (cons x y))

(start (DEVICE dev.debug_key))
