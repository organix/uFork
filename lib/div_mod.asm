; Euclidean division and remainder/modulus

.import
    std: "https://ufork.org/lib/std.asm"

; Euclidean division is a slow, but simple, algorithm.
; It solves the equations: <latex> n = dq + r </latex>,
;                     and <latex> 0 ≤ r < |d| </latex>.
; (reference -- https://en.wikipedia.org/wiki/Division_algorithm)

udivmod:                    ; ( n d -- q r )
    roll -3                 ; k n d
    ref div_pos             ; k n d

divmod:                     ; ( n d -- q r )
    roll -3                 ; k n d
    dup 1                   ; k n d d
    eq 0                    ; k n d d==0
    if div_err              ; k n d

    dup 1                   ; k n d d
    typeq #fixnum_t         ; k n d is_fix(d)
    if_not div_err          ; k n d

    pick 2                  ; k n d n
    typeq #fixnum_t         ; k n d is_fix(n)
    if_not div_err          ; k n d

    dup 1                   ; k n d d
    push 0                  ; k n d d 0
    cmp lt                  ; k n d d<0
    if div_neg_d            ; k n d

    pick 2                  ; k n d n
    push 0                  ; k n d n 0
    cmp lt                  ; k n d n<0
    if div_neg_n            ; k n d

; function divide_unsigned(N, D)
;   Q := 0; R := N
;   while R ≥ D do
;     Q := Q + 1
;     R := R − D
;   end
;   return (Q, R)
; end

div_pos:                    ; k n d
    push 0                  ; k n d q=0
    pick 3                  ; k n d q r=n
div_loop:                   ; k n d q r
    dup 1                   ; k n d q r r
    pick 4                  ; k n d q r r d
    cmp lt                  ; k n d q r r<d
    if div_done             ; k n d q r

    roll 2                  ; k n d r q
    push 1                  ; k n d r q 1
    alu add                 ; k n d r q'=q+1
    roll 2                  ; k n d q' r
    pick 3                  ; k n d q' r d
    alu sub                 ; k n d q' r'=r-d
    ref div_loop

div_done:                   ; k n d q r
    roll 3                  ; k n q r d
    roll 4                  ; k q r d n
    drop 2                  ; k q r
    ref return_2

div_neg_d:                  ; k n d
    push 0                  ; k n d 0
    roll 2                  ; k n 0 d
    alu sub                 ; k n -d
    call divmod             ; k q r
    push 0                  ; k q r 0
    roll 3                  ; k r 0 q
    alu sub                 ; k r -q
    roll 2                  ; k -q r
    ref return_2

div_neg_n:                  ; k n d
    push 0                  ; k n d 0
    roll 3                  ; k d 0 n
    alu sub                 ; k d -n
    pick 2                  ; k d -n d
    call divmod             ; k d q r
    dup 1                   ; k d q r r
    eq 0                    ; k d q r r==0
    if div_r_0              ; k d q r

    roll 3                  ; k q r d
    roll 2                  ; k q d r
    alu sub                 ; k q d-r
    push -1                 ; k q d-r -1
    roll 3                  ; k d-r -1 q
    alu sub                 ; k d-r -q-1
    roll 2                  ; k -q-1 d-r
    ref return_2

div_r_0:                    ; k d q r=0
    roll 3                  ; k q r d
    drop 1                  ; k q r
    push 0                  ; k q r 0
    roll 3                  ; k r 0 q
    alu sub                 ; k r -q
    roll 2                  ; k -q r=0
    ref return_2

div_err:                    ; k n d
    drop 2                  ; k
    push #?                 ; k q=#?
    push #?                 ; k q r=#?
return_2:                   ; k q r
    roll 3                  ; q r k
    return

; function divide(N, D)
;   if D = 0 then error(DivisionByZero) end
;   if D < 0 then (Q, R) := divide(N, −D); return (−Q, R) end
;   if N < 0 then
;     (Q,R) := divide(−N, D)
;     if R = 0 then return (−Q, 0)
;     else return (−Q − 1, D − R) end
;   end
;   -- At this point, N ≥ 0 and D > 0
;   return divide_unsigned(N, D)
; end

test_udiv:                  ; ( -- )
    push 17                 ; k n=17
    push 5                  ; k n d=5
    call divmod             ; k q=3 r=2
    assert 2                ; k q
    assert 3                ; k

    push 12                 ; k n=12
    push 3                  ; k n d=3
    call divmod             ; k q=4 r=0
    assert 0                ; k q
    assert 4                ; k

    push 0                  ; k n=0
    push 7                  ; k n d=7
    call divmod             ; k q=0 r=0
    assert 0                ; k q
    assert 0                ; k

    push 1                  ; k n=1
    push 0                  ; k n d=0
    call divmod             ; k q=#? r=#?
    assert #?               ; k q
    assert #?               ; k
    return

test_div:                   ; ( -- )
    push -17                ; k n=-17
    push 5                  ; k n d=5
    call divmod             ; k q=-4 r=3
    assert 3                ; k q
    assert -4               ; k

    push 17                 ; k n=17
    push -5                 ; k n d=-5
    call divmod             ; k q=-3 r=2
    assert 2                ; k q
    assert -3               ; k

    push -17                ; k n=-17
    push -5                 ; k n d=-5
    call divmod             ; k q=4 r=3
    assert 3                ; k q
    assert 4                ; k

    push -12                ; k n=-12
    push 4                  ; k n d=4
    call divmod             ; k q=-3 r=0
    assert 0                ; k q
    assert -3               ; k
    return

test:                       ; judge <- {caps}
    call test_udiv          ; --
    call test_div           ; --
    push #t                 ; verdict=#t
    state 0                 ; verdict judge
    actor send              ; --
    ref std.commit

.export
    divmod
    udivmod
    test
