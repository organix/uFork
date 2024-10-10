;
; (fib 9) ==> 34
;

(import dev "https://ufork.org/lib/dev.asm")

(define fib                 ; O(n!) performance?
    (lambda (n)             ; msg: (cust n)
        (if (< n 2)
            n
            (+ (fib (- n 1)) (fib (- n 2))) )))

(fib 9)
;(SEND (DEVICE dev.debug_key) (fib 6))
