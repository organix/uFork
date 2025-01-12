; Some hand-assembled Scheme that uses the jump instruction to model function
; calls, rather than using message sends. This strategy was used to implement
; the Humus compiler, humus.js.

.import
    dev: "https://ufork.org/lib/dev.asm"
    scm: "https://ufork.org/lib/scm.asm"
    std: "https://ufork.org/lib/std.asm"

;
; Calling conventions.
;

; A closure_t's code expects a stack like

;   ... k args env

; The top 3 elements constitute the frame:

;   k
;       The continuation, that is, the instruction to jump to after producing
;       the return value.
;   args
;       The arguments as a single value.
;   env
;       The environment of the closure.

call:                       ; ... k args closure
    quad -3                 ; ... k args env code #closure_t
    drop 1                  ; ... k args env code
    jump

; A closure_t's code leaves behind the return value on top of the frame

;   ... k args env rv

; and returns.

; The continuation, 'k', expects the return value on top of the last known
; stack:

;   ... rv

return:                     ; ... k args env rv
    roll -4                 ; ... rv k args env
    drop 2                  ; ... rv k
    jump

; The tail call optimization works by modifying the current frame. Its arguments
; are replaced, yet the continuation is left unchanged.

tail:                       ; ... k args env args' closure
    roll -4                 ; ... k closure args env args'
    roll -4                 ; ... k args' closure args env
    drop 2                  ; ... k args' closure
    ref call

;
; The 'double_sum' function adds its four arguments together, calling out to
; the 'sum' function.
;

; (define sum
;     (lambda (a b)
;         (+ a b)))

sum_code:                   ; k args=a,b,#nil env=#nil
    pick 2                  ; k args env |1| args
    nth 1                   ; k args env |1| a
    pick 3                  ; k args env |2| a args
    nth 2                   ; k args env |2| a b
    alu add                 ; k args env |1| rv=a+b
    ref return

sum:
    quad_3 scm.closure_t sum_code #nil

; (define double_sum
;     (lambda (a b c d)
;         (+ (sum a b) (sum c d))))

double_sum_code:            ; k args=a,b,c,d,#nil env=#nil
    push k1                 ; k args env |1| k1
    push #nil               ; k args env |2| k1 #nil
    pick 4                  ; k args env |3| k1 #nil args
    nth 2                   ; k args env |3| k1 #nil b
    pick 5                  ; k args env |4| k1 #nil b args
    nth 1                   ; k args env |4| k1 #nil b a
    pair 2                  ; k args env |2| k1 args'=a,b,#nil
    push sum                ; k args env |3| k1 args' sum
    ref call
k1:                         ; k args env |1| a+b
    push k2                 ; k args env |2| a+b k2
    push #nil               ; k args env |3| a+b k2 #nil
    pick 5                  ; k args env |4| a+b k2 #nil args
    nth 4                   ; k args env |4| a+b k2 #nil d
    pick 6                  ; k args env |5| a+b k2 #nil d args
    nth 3                   ; k args env |5| a+b k2 #nil d c
    pair 2                  ; k args env |3| a+b k2 args'=c,d,#nil
    push sum                ; k args env |4| a+b k2 args' sum
    ref call
k2:                         ; k args env |2| a+b c+d
    alu add                 ; k args env |1| rv=a+b+c+d
    ref return

double_sum:
    quad_3 scm.closure_t double_sum_code #nil

;
; The 'ifact' function is the iterative factorial. It demonstrates the tail call
; optimization.
;

; (define ifact  ; fact(n) == ifact(n 1)
;     (lambda (n a)
;         (if (> n 1)
;             (ifact (- n 1) (* a n))
;             a)))

ifact_code:                 ; k args=n,a,#nil env=#nil
    pick 2                  ; k args env |1| args
    nth 1                   ; k args env |1| n
    push 1                  ; k args env |2| n 1
    cmp gt                  ; k args env |1| n>1
    if recurse              ; k args env |0|
    pick 2                  ; k args env |1| args
    nth 2                   ; k args env |1| a
    ref return
recurse:
    push #nil               ; k args env |1| #nil
    pick 3                  ; k args env |2| #nil args
    nth 2                   ; k args env |2| #nil a
    pick 4                  ; k args env |3| #nil a args
    nth 1                   ; k args env |3| #nil a n
    alu mul                 ; k args env |2| #nil a*n
    pick 4                  ; k args env |3| #nil a*n args
    nth 1                   ; k args env |3| #nil a*n n
    push 1                  ; k args env |4| #nil a*n n 1
    alu sub                 ; k args env |3| #nil a*n n-1
    pair 2                  ; k args env |1| args=n-1,a*n,#nil
    push ifact              ; k args env |2| args closure=ifact
    ref tail

ifact:
    quad_3 scm.closure_t ifact_code #nil

;
; The 'hof3' function returns a function that returns a function that returns a
; list containing all of the arguments that have been closed over.
; It demonstrates the dynamic creation of closures.
;

; (define hof3
;     (lambda (p)
;         (lambda (q r)
;             (lambda s
;                 (list p q r s) ))))

hof3_code:                  ; k args=p,#nil env=#nil
    pick 1                  ; k args env |1| env
    pick 3                  ; k args env |2| env args
    pair 1                  ; k args env |1| env'=args,env
    push qr_code            ; k args env |2| env' qr_code
    push scm.closure_t      ; k args env |3| env' qr_code #closure_t
    quad 3                  ; k args env |1| qr=[#closure_t, qr_code, env']
    ref return

qr_code:                    ; k args=qr,#nil env=(p,#nil),#nil
    pick 1                  ; k args env |1| env
    pick 3                  ; k args env |2| env args
    pair 1                  ; k args env |1| env'=args,env
    push s_code             ; k args env |2| env' s_code
    push scm.closure_t      ; k args env |3| env' s_code #closure_t
    quad 3                  ; k args env |1| yz=[#closure_t, s_code, env']
    ref return

s_code:                     ; k args=s env=(q,r,#nil),(p,#nil),#nil
    push #nil               ; k args env |1| #nil
    pick 3                  ; k args env |2| #nil s
    pick 3                  ; k args env |3| #nil s env
    nth 1                   ; k args env |3| #nil s q,r,#nil
    nth 2                   ; k args env |3| #nil s r
    pick 4                  ; k args env |4| #nil s r env
    nth 1                   ; k args env |4| #nil s r q,r,#nil
    nth 1                   ; k args env |4| #nil s r q
    pick 5                  ; k args env |5| #nil s r q env
    nth 2                   ; k args env |5| #nil s r q p,#nil
    nth 1                   ; k args env |5| #nil s r q p
    pair 4                  ; k args env |1| p,q,r,s,#nil
    ref return

hof3:
    quad_3 scm.closure_t hof3_code #nil

; Test suite

boot:                       ; _ <- {caps}

; Call the 'double_sum' closure and print its return value.

    ; push print_rv           ; k=print_rv
    ; push #nil               ; k #nil
    ; push 4                  ; k #nil d=4
    ; push 3                  ; k #nil d c=3
    ; push 2                  ; k #nil d c b=2
    ; push 1                  ; k #nil d c b a=1
    ; pair 4                  ; k args=a,b,c,d,#nil
    ; push double_sum         ; k args closure=double_sum
    ; ref call

; Print the factorial of 6.

    push print_rv           ; k=print_rv
    push #nil               ; k #nil
    push 1                  ; k #nil a=1
    push 6                  ; k #nil a n=6
    pair 2                  ; k args=n,a,#nil
    push ifact              ; k args closure=ifact
    ref call

; Call the innermost lambda in hof3 and print its return value.

;     push p_return           ; k=p_return
;     push #nil               ; k #nil
;     push 1                  ; k #nil p=1
;     pair 1                  ; k args=p,#nil
;     push hof3               ; k args closure=hof3
;     ref call
; p_return:                   ; qr
;     push qr_return          ; qr k=qr_return
;     push #nil               ; qr k #nil
;     push 3                  ; qr k #nil r=3
;     push 2                  ; qr k #nil r q=2
;     pair 2                  ; qr k args=q,r,#nil
;     roll 3                  ; k args closure=qr
;     ref call
; qr_return:                  ; s
;     push print_rv           ; s k=print_rv
;     push 4                  ; s k args=4
;     roll 3                  ; k args closure=s
;     ref call

print_rv:                   ; rv
    msg 0                   ; rv {caps}
    push dev.debug_key      ; rv {caps} debug_key
    dict get                ; rv debug
    ref std.send_msg

.export
    boot
