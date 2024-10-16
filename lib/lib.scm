;;;
;;; Actor idioms in Scheme
;;;

(import dev "https://ufork.org/lib/dev.asm")  ; for testing...

(define sink-beh (BEH _))

(define self-beh
    (BEH (cust . _)
        (SEND cust SELF) ))

(define const-beh
    (lambda (value)
        (BEH (cust . _)
            (SEND cust value) )))

(define fwd-beh
    (lambda (rcvr)
        (BEH msg
            (SEND rcvr msg) )))

(define init-fwd-beh
    (lambda ()
        (BEH rcvr
            (BECOME (fwd-beh rcvr)) )))

(define once-beh
    (lambda (rcvr)
        (BEH msg
            (BECOME sink-beh)
            (SEND rcvr msg) )))

(define label-beh
    (lambda (rcvr label)
        (BEH msg
            (SEND rcvr (cons label msg)) )))

(define tag-beh
    (lambda (rcvr)
        (BEH msg
            (SEND rcvr (cons SELF msg)) )))

(define once-tag-beh
    (lambda (rcvr)
        (BEH msg
            (BECOME sink-beh)
            (SEND rcvr (cons SELF msg)) )))

(define start
    (lambda (debug clock)
        (let (
                (sink (CREATE sink-beh))
                ;(output debug)
                (output (CREATE (label-beh debug 1337)))
                ;(output (CREATE (once-beh debug)))
                ;(output (CREATE (tag-beh debug)))
                ;(output (CREATE (once-tag-beh debug)))
                ;(input (CREATE (const-beh 42)))
                (input (CREATE (fwd-beh (CREATE (const-beh 42)))))
                ;(input (CREATE (once-beh (CREATE (const-beh 42)))))
            )
            (SEND output -42)
            (SEND (CREATE (const-beh 420)) (list sink))
            (SEND input (list output))
            (SEND input (list output))
            (SEND clock output)
            #t )))
(start  ; run test-case/demonstration
    (DEVICE dev.debug_key)
    (DEVICE dev.clock_key))
