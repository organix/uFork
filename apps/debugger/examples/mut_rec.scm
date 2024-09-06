;
; mutual-recursion example
;

(import dev "https://ufork.org/lib/dev.asm")

(define odd                 ; `#t` if `n` is odd, otherwise `#f`
    (lambda (n)
        (if (= n 0)
            #f
            (even (- n 1)) )))
(define even                 ; `#t` if `n` is even, otherwise `#f`
    (lambda (n)
        (if (= n 0)
            #t
            (odd (- n 1)) )))

(SEND
    (DEVICE dev.debug_key)
    (list (odd 3) (even 3)))  ; ==> (#t #f)
