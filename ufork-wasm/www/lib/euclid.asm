;;;
;;; Euclidean Division
;;;
;;; https://en.wikipedia.org/wiki/Division_algorithm#Division_by_repeated_subtraction
;;;

;
; These functions expect a continuation address (`k`) on the stack.
;
;   stack picture: k n d -- q=n/d r=n%d
;

divmod:                 ; k n d
    dup 1               ; k n d d
    push 0              ; k n d d 0
    cmp gt              ; k n d d>0
    if d_gt_0           ; k n d

    dup 1               ; k n d d
    eq 0                ; k n d d==0
    if d_eq_0           ; k n d

    ; (d < 0)
    push 0              ; k n d 0
    roll 2              ; k n 0 d
    alu sub             ; k n -d
    push neg_q          ; k n -d neg_q
    roll -3             ; k neg_q n -d
    push divmod         ; k neg_q n -d divmod
    jump                ; k neg_q n -d

neg_q:                  ; k q r
    push 0              ; k q r 0
    roll 3              ; k r 0 q
    alu sub             ; k r -q
    roll 2              ; k -q r
    roll 3              ; -q r k
    jump                ; -q r

d_eq_0:                 ; k n d
    drop 2              ; k
    push #?             ; k #?
    push #?             ; k #? #?
    roll 3              ; #? #? k
    jump                ; #? #? -- division by zero is undefined

d_gt_0:                 ; k n d
    pick 2              ; k n d n
    push 0              ; k n d n 0
    cmp ge              ; k n d n>=0
    if udivmod          ; k n d

    ; (n < 0)
    push neg_n          ; k n d neg_n
    push 0              ; k n d neg_n 0
    pick 4              ; k n d neg_n 0 n
    alu sub             ; k n d neg_n -n
    pick 3              ; k n d neg_n -n d
    push divmod         ; k n d neg_n -n d divmod
    jump

neg_n:                  ; k n d q r
    ; fix-up results for (n < 0)
    dup 1               ; k n d q r r
    eq 0                ; k n d q r r==0
    if r_eq_0           ; k n d q r

    push 0              ; k n d q r 0
    roll 3              ; k n d r 0 q
    alu sub             ; k n d r -q
    push 1              ; k n d r -q 1
    alu sub             ; k n d r q'=-q-1
    roll -3             ; k n q' d r
    alu sub             ; k n q' r'=d-r
    roll 3              ; k q' r' n
    drop 1              ; k q' r'
    roll 3              ; q' r' k
    jump

r_eq_0:                 ; k n d q 0
    roll 2              ; k n d 0 q
    alu sub             ; k n d -q
    roll -4             ; -q k n d
    drop 2              ; -q k
    push 0              ; -q k r=0
    roll -2             ; -q r k
    jump

udivmod:                ; k n d
    ; requires (n >= 0) && (d > 0)
    push 0              ; k n d q=0
    pick 3              ; k n d q r=n

chk_rd:                 ; k n d q r
    dup 1               ; k n d q r r
    pick 4              ; k n d q r r d
    cmp lt              ; k n d q r r<d
    if rtn_qr           ; k n d q r

    pick 3              ; k n d q r d
    alu sub             ; k n d q r'=r-d
    roll 2              ; k n d r' q
    push 1              ; k n d r' q 1
    alu add             ; k n d r' q'=q+1
    roll 2              ; k n d q' r'
    ref chk_rd

rtn_qr:                 ; k n d q r
    roll -5             ; r k n d q
    roll -5             ; q r k n d
    drop 2              ; q r k
    jump                ; q r

boot:
    ; 1 0 -- #? #?
    push expect_undef   ; k=expect_undef
    push 1              ; k n=1
    push 0              ; k n d=0
    push divmod         ; k n d divmod
    jump

expect_undef:           ; q r
    assert #?           ; q -- assert(r==#?)
    assert #?           ; -- assert(q==#?)

    ; 7 3 -- 2 1
    push expect2and1    ; k=expect2and1
    push 7              ; k n=7
    push 3              ; k n d=3
    push divmod         ; k n d divmod
    jump

expect2and1:            ; q r
    assert 1            ; q -- assert(r==1)
    assert 2            ; -- assert(q==2)

    ; 7 -3 -- -2 1
    push expect-2and1   ; k=expect-2and1
    push 7              ; k n=7
    push -3             ; k n d=-3
    push divmod         ; k n d divmod
    jump

expect-2and1:           ; q r
    assert 1            ; q -- assert(r==1)
    assert -2           ; -- assert(q==-2)

    ; -7 3 -- -3 2
    push expect-3and2   ; k=expect-3and2
    push -7             ; k n=-7
    push 3              ; k n d=3
    push divmod         ; k n d divmod
    jump

expect-3and2:           ; q r
    assert 2            ; q -- assert(r==2)
    assert -3           ; -- assert(q==-3)

    ; -7 -3 -- 3 2
    push expect3and2    ; k=expect3and2
    push -7             ; k n=-7
    push -3             ; k n d=-3
    push divmod         ; k n d divmod
    jump

expect3and2:            ; q r
    assert 2            ; q -- assert(r==2)
    assert 3            ; -- assert(q==3)

    ; -6 3 -- -2 0
    push expect-2and0   ; k=expect-2and0
    push -6             ; k n=-6
    push 3              ; k n d=3
    push divmod         ; k n d divmod
    jump

expect-2and0:           ; q r
    assert 0            ; q -- assert(r==0)
    assert -2           ; -- assert(q==-2)

done:
;    end stop            ; force halt
    end commit

.export
    divmod
    udivmod
    boot
