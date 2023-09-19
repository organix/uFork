;
; (fib 6) ==> 8
;

(import dev "../lib/dev.asm")

(define fib                 ; O(n!) performance?
    (lambda (n)             ; msg: (cust n)
        (if (< n 2)
            n
            (+ (fib (- n 1)) (fib (- n 2))) )))

;(fib 6)
(SEND (DEVICE dev.debug_key) (fib 6))
