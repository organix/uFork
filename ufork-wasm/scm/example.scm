;
; example Scheme source code
;

(define hof
    (lambda (x)
        (lambda (y)
            (lambda (z)
                (list 'x x 'y y 'z z) ))))

(hof 'a '(b c) '(d . e))
