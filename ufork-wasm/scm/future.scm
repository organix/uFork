;
; single-assignement data-flow variable
;

;(import dev "../lib/dev.asm")

(define future-beh
    (lambda (waiting)  ; initially ()
        (BEH (op arg)  ; ('read cust) | ('write value)
            (cond
                ((eq? op 'read)
                    (BECOME (future-beh (cons arg waiting))))
                ((eq? op 'write)
                    (BECOME (value-beh arg))
                    (send-to-all waiting arg)) ))))

(define value-beh
    (lambda (value)
        (BEH (op arg)
            (if (eq? op 'read)
                (SEND arg value)
                #unit))))

(define send-to-all
    (lambda (waiting value)
        (cond
            ((pair? waiting)
                (SEND (car waiting) value)
                (send-to-all (cdr waiting) value)) )))

(define start
    (lambda (cust future)
        (SEND future (list 'read cust))
        (SEND future (list 'write 420))
        (SEND future (list 'read cust))
        (SEND future (list 'write -42))
        (SEND future (list 'read cust))
        (SEND future (list 'read cust)) ))

(start (DEVICE scm.debug_key) (CREATE (future-beh '())))

(define beh future-beh)  ; module default alias
(export beh future-beh)
