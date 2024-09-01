; Some hand-assembled Humus closures. They conform to the assembly language
; calling conventions.

.import
    dev: "https://ufork.org/lib/dev.asm"
    hum: "https://ufork.org/lib/hum.asm"
    std: "https://ufork.org/lib/std.asm"

;
; The 'double_sum' function adds its four arguments together, calling out to
; the 'sum' function.
;

; DEF sum(a, b) AS add(a, b)

sum:                        ; args=(a . b) k
    roll 2                  ; k args
    part 1                  ; k b a
    alu add                 ; k rv=a+b
    roll 2                  ; rv k
    return

; DEF double_sum(a, b, c, d) AS sum(sum(a, b), sum(c, d))

double_sum:                 ; args=(a, b, c, d) k
    roll -2                 ; k args
    part 3                  ; k d c b a
    roll 4                  ; k c b a d
    roll 4                  ; k b a d c
    pair 1                  ; k b a args=(c . d)
    call sum                ; k b a c+d
    roll -3                 ; k c+d b a
    pair 1                  ; k c+d args=(a . b)
    call sum                ; k c+d a+b
    pair 1                  ; k args=(a+b . c+d)
    call sum                ; k rv=a+b+c+d
    roll 2                  ; rv k
    return

;
; The 'ifact' function is the iterative factorial. It demonstrates the tail call
; optimization.
;

; DEF ifact(n, a) AS CASE greater(n, 1) OF
;     TRUE : ifact(sub(n, 1), mul(n, a))
;     _ : a
; END

ifact:                      ; args=(n . a) k
    roll 2                  ; k args
    part 1                  ; k a n
    dup 1                   ; k a n n
    push 1                  ; k a n n 1
    cmp gt                  ; k a n n>1
    if recurse              ; k a n
    drop 1                  ; k a
    roll 2                  ; a k
    return
recurse:                    ; k a n
    pick 1                  ; k a n n
    pick 3                  ; k a n n a
    alu mul                 ; k a n n*a
    pick 2                  ; k a n n*a n
    push 1                  ; k a n n*a n 1
    alu sub                 ; k a n n*a n-1
    pair 1                  ; k a n args=(n-1 . n*a)
    roll -4                 ; args k a n
    drop 2                  ; args k
    ref ifact

;
; The 'hof3' function returns a function that returns a function that returns a
; list containing all of the arguments that have been closed over.
; It demonstrates the dynamic creation of closures.
;

; DEF hof3 AS \a.\(b, c).\d.(a, b, c, d)

hof3:                       ; a k
    push bc_code            ; a k bc_code
    push #nil               ; a k bc_code ()
    pick 4                  ; a k bc_code () a
    pair 1                  ; a k bc_code env=(a)
    call hum.make_closure   ; a k rv=bc_closure
    roll 3                  ; k rv a
    drop 1                  ; k rv
    roll 2                  ; rv k
    return
bc_code:                    ; args=(b . c) k env=(a)
    push d_code             ; (b . c) k env d_code
    pick 2                  ; (b . c) k env d_code env
    pick 5                  ; (b . c) k env d_code env (b . c)
    pair 1                  ; (b . c) k env d_code env'=((b . c) a)
    call hum.make_closure   ; (b . c) k env rv=d_closure
    roll 4                  ; k env rv (b . c)
    drop 1                  ; k env rv
    roll 2                  ; k rv env
    drop 1                  ; k rv
    roll 2                  ; rv k
    return
d_code:                     ; args=d k env=((b . c) a)
    pick 3                  ; d k env d
    pick 2                  ; d k env d env
    nth 1                   ; d k env d (b . c)
    nth -1                  ; d k env d c
    pick 3                  ; d k env d c env
    nth 1                   ; d k env d c (b . c)
    nth 1                   ; d k env d c b
    pick 4                  ; d k env d c b env
    nth 2                   ; d k env d c b a
    pair 3                  ; d k env rv=(a b c . d)
    roll 2                  ; d k rv env
    drop 1                  ; d k rv
    roll 3                  ; k rv d
    drop 1                  ; k rv
    roll 2                  ; rv k
    return

; Test suite

demo:                       ; k

; Call the innermost lambda in hof3, obtaining 4 fixnums.

    push 1                  ; k a=1
    call hof3               ; k bc_closure
    push 3                  ; k bc_closure c=3
    push 2                  ; k bc_closure c b=2
    pair 1                  ; k bc_closure args=(b . c)
    push k_bc               ; k bc_closure args k_bc
    roll 3                  ; k args k_bc bc_closure
    jump                    ; k args k_bc
k_bc:                       ; k d_closure
    push 4                  ; k d_closure d=4
    push k_d                ; k d_closure args=d k_s
    roll 3                  ; k args k_s d_closure
    jump
k_d:                        ; k args=(a b c . d)

; Use 'double_sum' to sum the 4 fixnums.

    call double_sum         ; k a+b+c+d

; Return the factorial of the sum.

    push 1                  ; k a+b+c+d acc=1
    roll 2                  ; k acc n=a+b+c+d
    pair 1                  ; k args=(n . acc)
    call ifact              ; k rv=n!
    roll 2                  ; rv k
    return

boot:                       ; () <- {caps}
    call demo               ; rv
    msg 0                   ; rv {caps}
    push dev.debug_key      ; rv {caps} debug_key
    dict get                ; rv debug
    ref std.send_msg

test:                       ; (verdict) <- {caps}
    call demo               ; actual
    push 3628800            ; actual expect=(1+2+3+4)!
    cmp eq                  ; actual==expect?
    state 1                 ; actual==expect? verdict
    ref std.send_msg

.export
    boot
    test
