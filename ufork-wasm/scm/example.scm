;
; example Scheme source code
;

(define hof
    (lambda (foo)
        (lambda (bar)
            (lambda (baz)
                (list 'foo foo 'bar bar 'baz baz) ))))

(hof 'a '(b c) '(d . e))
