;
; (fib 6) ==> 8
;

(define fib                 ; O(n!) performance?
    (lambda (n)             ; msg: (cust n)
        (if (< n 2)
            n
            (+ (fib (- n 1)) (fib (- n 2))) )))

(fib 6)
