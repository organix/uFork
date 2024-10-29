;;;
;;; Parsing Expression Grammar (PEG) library
;;;

; PEG actors expect a message like `(custs accum . in)`
; where `custs` is a pair of customers `(ok . fail)`
; the `accum` is the accumulated semantic value
; and `in` is the current position of the input stream.

; The input stream `in` is either `(token . next)`
; or `()` at the end of the stream.
; The `token` is the input data at the current position
; and `next` is the actor to ask for the next input.

; The `ok` customer will receive messages like `(accum . in)`.
; The `fail` customer will receive message like `in`.

.import
    std: "https://ufork.org/lib/std.asm"
    lib: "https://ufork.org/lib/lib.asm"
    assert_eq: "https://ufork.org/lib/testing/assert_eq.asm"
    dev: "https://ufork.org/lib/dev.asm"

;
; literal list input stream
;

s_list:                     ; list <- cust
    state 0                 ; list
    typeq #pair_t           ; is_pair(list)
    if_not s_eos            ; --

    state -1                ; rest
    push s_list             ; rest s_list
    actor create            ; next=s_list(rest)
    state 1                 ; next token=first
    pair 1                  ; (token . next)
    msg 0                   ; (token . next) cust
    ref std.send_msg

s_eos:
    push #nil               ; ()
    msg 0                   ; () cust
    ref std.send_msg

;
; primitive patterns
;

; always succeed, consume no input

empty:                      ; _ <- ((ok . fail) accum . in)
    msg -2                  ; in
    push #nil               ; in accum'=()
    pair 1                  ; (accum' . in)
    msg 1                   ; (accum' . in) custs=(ok . fail)
    nth 1                   ; (accum' . in) ok
    ref std.send_msg

; always fail, consume no input

fail:                       ; _ <- ((ok . fail) accum . in)
    msg -2                  ; in
    msg 1                   ; in custs=(ok . fail)
    nth -1                  ; in fail
    ref std.send_msg

; fail on end-of-stream, else succeed and consume token

any:                        ; _ <- ((ok . fail) accum . in)
    msg -2                  ; in
    eq #nil                 ; in==()
    if fail                 ; --

ok:                         ; --
    msg 3                   ; token
    msg 1                   ; token custs=(ok . fail)
    nth 1                   ; token ok
    pair 1                  ; (ok . token)
    push k_next             ; (ok . token) k_next
    actor create            ; k=k_next.(ok . token)
    msg -3                  ; k next
    ref std.send_msg

k_next:                     ; (ok . token) <- in
    msg 0                   ; in
    state -1                ; in accum=token
    pair 1                  ; (accum . in)
    state 1                 ; (accum . in) ok
    ref std.send_msg

; succeed and consume token if token matches expect

eq:                         ; expect <- ((ok . fail) accum . in)
    msg -2                  ; in
    eq #nil                 ; in==()
    if fail                 ; --

    msg 3                   ; token
    state 0                 ; token expect
    cmp eq                  ; token==expect
    if ok fail

; succeed and consume token if pred(token)

if:                         ; pred <- ((ok . fail) accum . in)
    msg -2                  ; in
    eq #nil                 ; in==()
    if fail                 ; --

    msg 3                   ; token
    msg 0                   ; token ((ok . fail) accum . in)
    push k_if               ; token ((ok . fail) accum . in) k_if
    actor create            ; token k=k_if.((ok . fail) accum . in)
    pair 1                  ; (k . token)
    state 0                 ; (k . token) pred
    ref std.send_msg

k_if:                       ; ((ok . fail) accum . in) <- bool
    msg 0                   ; bool
    if k_ok

    state -2                ; in
    state 1                 ; in custs=(ok . fail)
    nth -1                  ; in fail
    ref std.send_msg

k_ok:                       ; --
    state 3                 ; token
    state 1                 ; token custs=(ok . fail)
    nth 1                   ; token ok
    pair 1                  ; (ok . token)
    push k_next             ; (ok . token) k_next
    actor create            ; k=k_next.(ok . token)
    state -3                ; k next
    ref std.send_msg

; a predicate for matching an inclusive range [lo, hi]

in_range:                   ; (lo . hi) <- (cust . value)
    msg -1                  ; value
    state 1                 ; value lo
    cmp lt                  ; value<lo
    if std.rv_false
    msg -1                  ; value
    state -1                ; value hi
    cmp le                  ; value<=hi
    ref std.cust_send

; try matching `first`, if failed try `rest` at same position

or:                         ; (first . rest) <- ((ok . fail) accum . in)
    msg -1                  ; ctx=(accum . in)
    msg 0                   ; ctx msg=((ok . fail) accum . in)
    state -1                ; ctx msg rest
    pair 1                  ; ctx (rest . msg)
    push lib.relay_beh      ; ctx (rest . msg) relay_beh
    actor create            ; ctx fail'=relay_beh.(rest . msg)
    msg 1                   ; ctx fail' custs=(ok . fail)
    nth 1                   ; ctx fail' ok
    pair 1                  ; ctx (ok . fail')
    pair 1                  ; ((ok . fail') accum . in)
    state 1                 ; ((ok . fail') accum . in) first
    ref std.send_msg

; try matching `first` followed by `rest`

and:                        ; (first . rest) <- ((ok . fail) accum . in)
    msg -2                  ; in
    msg 1                   ; in custs=(ok . fail)
    nth -1                  ; in fail
    pair 1                  ; (fail . in)
    push lib.relay_beh      ; (fail . in) relay_beh
    actor create            ; fail'=relay_beh.(fail . in)

    dup 1                   ; fail' fail'
    msg 1                   ; fail' fail' custs=(ok . fail)
    nth 1                   ; fail' fail' ok
    state -1                ; fail' fail' ok rest
    pair 2                  ; fail' (rest ok . fail')
    push and_ok             ; fail' (rest ok . fail') and_ok
    actor create            ; fail' ok'=and_ok.(rest ok . fail')

    pair 1                  ; (ok' . fail')
    msg -1                  ; (ok' . fail') (accum . in)
    roll -2                 ; (accum . in) (ok' . fail')
    pair 1                  ; ((ok' . fail') accum . in)
    state 1                 ; ((ok . fail') accum . in) first
    ref std.send_msg

and_ok:                     ; (rest ok . fail') <- (accum' . in')
    msg 0                   ; (accum' . in')
    state -1                ; (accum' . in') fail'
    msg 1                   ; (accum' . in') fail' accum'
    state 2                 ; (accum' . in') fail' accum' ok
    pair 1                  ; (accum' . in') fail' (ok . accum')
    push and_pair           ; (accum' . in') fail' (ok . accum') and_pair
    actor create            ; (accum' . in') fail' ok'=and_pair.(ok . accum')

    pair 1                  ; (accum' . in') (ok' . fail')
    pair 1                  ; ((ok' . fail') accum . in)
    state 1                 ; ((ok' . fail') accum . in) rest
    ref std.send_msg

and_pair:                   ; (ok . accum') <- (accum'' . in'')
    msg 0                   ; (accum'' . in'')
    part 1                  ; in'' accum''
    state -1                ; in'' accum'' accum'
    pair 1                  ; in'' accum=(accum' . accum'')
    pair 1                  ; (accum . in'')
    state 1                 ; (accum . in'') ok
    ref std.send_msg

; succeed if `peg` fails, fail if it succeeds (look-ahead)

not:                        ; peg <- ((ok . fail) accum . in)
    msg 1                   ; custs=(ok . fail)
    part 1                  ; fail ok
    msg -2                  ; fail ok in
    push #nil               ; fail ok in ()
    pair 1                  ; fail ok (() . in)
    roll 2                  ; fail (() . in) ok
    pair 1                  ; fail (ok () . in)
    push lib.relay_beh      ; fail (ok () . in) relay_beh
    actor create            ; fail fail'=relay_beh.(ok () . in)

    msg -2                  ; fail fail' in
    roll 3                  ; fail' in fail
    pair 1                  ; fail' (fail . in)
    push lib.relay_beh      ; fail' (fail . in) relay_beh
    actor create            ; fail' ok'=relay_beh.(fail . in)

    pair 1                  ; (ok' . fail')
    msg -1                  ; (ok' . fail') (accum . in)
    roll -2                 ; (accum . in) (ok' . fail')
    pair 1                  ; ((ok' . fail') accum . in)
    state 0                 ; ((ok' . fail') accum . in) peg
    ref std.send_msg

; start parsing `source` according to `peg`

start:                      ; peg <- ((ok . fail) . source)
    msg 1                   ; custs=(ok . fail)
    state 0                 ; custs peg
    pair 1                  ; (peg . custs)
    push k_start            ; (peg . custs) k_start
    actor create            ; cust=k_start.(peg . custs)
    msg -1                  ; cust source
    ref std.send_msg

k_start:                    ; (peg . (ok . fail)) <- in
    msg 0                   ; in
    push #?                 ; in accum=#?
    state -1                ; in accum custs=(ok . fail)
    pair 2                  ; ((ok . fail) accum . in)
    state 1                 ; ((ok . fail) accum . in) peg
    ref std.send_msg

;
; unit test suite
;

unexpected:                 ; _ <- _
    push #f                 ; #f
    assert #t               ; assert(#f==#t)
    ref std.commit

test_1_data:                ; (())
    pair_t #nil
    ref #nil

expect_1:                   ; _ <- (accum . in)
    msg 1                   ; accum
    assert #nil             ; assert(accum==#nil)
    msg -1                  ; in
    assert #nil             ; assert(in==#nil)
    ref std.commit

expect_2:                   ; _ <- in
    msg 0                   ; in
    assert #nil             ; assert(in==#nil)
    ref std.commit

expect_3:                   ; _ <- in
    msg 0                   ; in
    assert #nil             ; assert(in==#nil)
    ref std.commit

expect_4:                   ; _ <- ('0' '\r' . next)
    msg 1                   ; accum
    assert '0'              ; assert(accum=='0')
    msg 2                   ; in.token
    assert '\r'             ; assert(in=='\r')
    ref std.commit

test_source:                ; (48 13 10)
    pair_t '0'
    pair_t '\r'
    pair_t '\n'
    ref #nil

expect_5:                   ; _ <- ('0' '\r' . next)
    msg 1                   ; accum
    assert '0'              ; assert(accum=='0')
    msg 2                   ; in.token
    assert '\r'             ; assert(in=='\r')
    msg -2                  ; next
    typeq #actor_t          ; is_actor(next)
    assert #t               ; assert(is_actor(next))
    ref std.commit

test_6_data:                ; (('0' ('\r' . '\n')))
    pair_t test_6_accum
    ref #nil
test_6_accum:               ; ('0' ('\r' . '\n'))
    pair_t '0'
    pair_t test_6_eol
    ref #nil
test_6_eol:                 ; ('\r' . '\n')
    pair_t '\r'
    ref '\n'

expect_6:                   ; _ <- (accum . in)
    msg 0                   ; (accum . in)
    push test_6_data        ; (accum . in) test_6_data
    push assert_eq.beh      ; (accum . in) test_6_data assert_eq.beh
    actor create            ; (accum . in) assert_eq.beh.test_6_data
    ref std.send_msg

boot:                       ; _ <- {caps}

; test 1: `empty` succeeds at end-of-stream

    push #nil               ; in=()
    push #?                 ; in accum=#?
    push #?                 ; in accum #?
    push unexpected         ; in accum #? unexpected
    actor create            ; in accum fail=unexpected.#?
    push #?                 ; in accum fail #?
    push expect_1           ; in accum fail #? expect_1
    actor create            ; in accum fail ok=expect_1.#?
    pair 1                  ; in accum (ok . fail)
    pair 2                  ; ((ok . fail) accum . in)
    push #?                 ; ((ok . fail) accum . in) #?
    push empty              ; ((ok . fail) accum . in) #? empty
    actor create            ; ((ok . fail) accum . in) peg=empty.#?
    actor send              ; --

; test 2: `fail` fails at end-of-stream

    push #nil               ; in=()
    push #?                 ; in accum=#?
    push #?                 ; in accum #?
    push expect_2           ; in accum #? expect_2
    actor create            ; in accum fail=expect_2.#?
    push #?                 ; in accum fail #?
    push unexpected         ; in accum fail #? unexpected
    actor create            ; in accum fail ok=unexpected.#?
    pair 1                  ; in accum (ok . fail)
    pair 2                  ; ((ok . fail) accum . in)
    push #?                 ; ((ok . fail) accum . in) #?
    push fail               ; ((ok . fail) accum . in) #? fail
    actor create            ; ((ok . fail) accum . in) peg=fail.#?
    actor send              ; --

; test 3: `any` fails at end-of-stream

    push #nil               ; in=()
    push #?                 ; in accum=#?
    push #?                 ; in accum #?
    push expect_3           ; in accum #? expect_3
    actor create            ; in accum fail=expect_3.#?
    push #?                 ; in accum fail #?
    push unexpected         ; in accum fail #? unexpected
    actor create            ; in accum fail ok=unexpected.#?
    pair 1                  ; in accum (ok . fail)
    pair 2                  ; ((ok . fail) accum . in)
    push #?                 ; ((ok . fail) accum . in) #?
    push any                ; ((ok . fail) accum . in) #? any
    actor create            ; ((ok . fail) accum . in) peg=any.#?
    actor send              ; --


; test 4: `any` succeeds on non-empty stream

    push test_source        ; list=test_source
    push s_list             ; test_source s_list
    actor create            ; source=s_list.test_source
    push #?                 ; source #?
    push unexpected         ; source #? unexpected
    actor create            ; source fail=unexpected.#?
    push #?                 ; source fail #?
    push expect_4           ; source fail #? expect_4
    actor create            ; source fail ok=expect_4.#?
    pair 1                  ; source (ok . fail)
    pair 1                  ; msg=((ok . fail) . source)
    push #?                 ; msg #?
    push any                ; msg #? any
    actor create            ; msg peg=any.#?
    push start              ; msg peg start
    actor create            ; msg start.peg
    actor send              ; --

; test 5: [0-9] succeeds on stream starting with '0'

    push test_source        ; list=test_source
    push s_list             ; test_source s_list
    actor create            ; source=s_list.test_source
    push #?                 ; source #?
    push unexpected         ; source #? unexpected
    actor create            ; source fail=unexpected.#?
    push #?                 ; source fail #?
    push expect_5           ; source fail #? expect_5
    actor create            ; source fail ok=expect_5.#?
    pair 1                  ; source (ok . fail)
    pair 1                  ; msg=((ok . fail) . source)
    push '9'                ; ... '9'
    push '0'                ; ... '9' '0'
    pair 1                  ; ... ('0' . '9')
    push in_range           ; ... ('0' . '9') in_range
    actor create            ; ... pred=in_range.('0' . '9')
    push if                 ; ... pred if
    actor create            ; msg peg=if.pred
    push start              ; msg peg start
    actor create            ; msg start.peg
    actor send              ; --

; test 6: and/or/not grammar
;
; grammar   = '0' eol eos
; eol       = lf
;           / cr opt_lf
; cr        = '\r'
; lf        = '\n'
; opt_lf    = lf
;           / ε
; eos       = !.

    push test_source        ; list=test_source
    push s_list             ; test_source s_list
    actor create            ; source=s_list.test_source
    push #?                 ; source #?
    push unexpected         ; source #? unexpected
    actor create            ; source fail=unexpected.#?
    push #?                 ; source fail #?
    push expect_6           ; source fail #? expect_6
    actor create            ; source fail ok=expect_6.#?
    pair 1                  ; source (ok . fail)
    pair 1                  ; msg=((ok . fail) . source)
    push #?                 ; msg #?
    push any                ; msg #? any
    actor create            ; msg any.#?
    push not                ; msg any.#? not
    actor create            ; msg eos=not.any.#?
    push '\n'               ; msg eos '\n'
    push eq                 ; msg eos '\n' eq
    actor create            ; msg eos lf=eq.'\n'
    push #?                 ; msg eos lf #?
    push empty              ; msg eos lf #? empty
    actor create            ; msg eos lf e=empty.#?
    pick 2                  ; msg eos lf e lf
    pair 1                  ; msg eos lf (lf . e)
    push or                 ; msg eos lf (lf . e) or
    actor create            ; msg eos lf opt_lf=or.(lf . e)
    push '\r'               ; msg eos lf opt_lf '\r'
    push eq                 ; msg eos lf opt_lf '\r' eq
    actor create            ; msg eos lf opt_lf cr=eq.'\r'
    pair 1                  ; msg eos lf (cr . opt_lf)
    push and                ; msg eos lf (cr . opt_lf) and
    actor create            ; msg eos lf and.(cr . opt_lf)
    roll 2                  ; msg eos and.(cr opt_lf) lf
    pair 1                  ; msg eos (lf . and.(cr opt_lf))
    push or                 ; msg eos (lf . and.(cr opt_lf)) or
    actor create            ; msg eos eol=or.(lf . and.(cr opt_lf))
    pair 1                  ; msg (eol . eos)
    push and                ; msg (eol . eos) and
    actor create            ; msg and.(eol . eos)
    push '0'                ; msg and.(eol eos) '0'
    push eq                 ; msg and.(eol eos) '0' eq
    actor create            ; msg and.(eol eos) eq.'0'
    pair 1                  ; msg (eq.'0' . and.(eol eos))
    push and                ; msg (eq.'0' . and.(eol eos)) and
    actor create            ; msg peg=and.(eq.'0' . and.(eol eos))
    push start              ; msg peg start
    actor create            ; msg start.peg
    ref std.send_msg

.export
    empty
    fail
    any
    eq
    if
    in_range
    or
    and
    not
    start
    boot
