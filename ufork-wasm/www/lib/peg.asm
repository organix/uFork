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
    std: "./std.asm"
    lib: "./lib.asm"
    dev: "./dev.asm"

;
; literal list input stream
;

s_list:                 ; list <- cust
    state 0             ; list
    typeq #pair_t       ; is_pair(list)
    if_not s_eos        ; --

    state -1            ; rest
    push s_list         ; rest s_list
    new -1              ; next=s_list(rest)
    state 1             ; next token=first
    pair 1              ; (token . next)
    msg 0               ; (token . next) cust
    ref std.send_msg

s_eos:
    push #nil           ; ()
    msg 0               ; () cust
    ref std.send_msg

;
; primitive patterns
;

; always succeed, consume no input

empty:                  ; () <- ((ok . fail) accum . in)
    msg -2              ; in
    push #nil           ; in accum'=()
    pair 1              ; (accum' . in)
    msg 1               ; (accum' . in) custs=(ok . fail)
    nth 1               ; (accum' . in) ok
    ref std.send_msg

; always fail, consume no input

fail:                   ; () <- ((ok . fail) accum . in)
    msg -2              ; in
    msg 1               ; in custs=(ok . fail)
    nth -1              ; in fail
    ref std.send_msg

; fail on end-of-stream, else succeed and consume token

any:                    ; () <- ((ok . fail) accum . in)
    msg -2              ; in
    eq #nil             ; in==()
    if fail             ; --

ok:                     ; --
    msg 3               ; token
    msg 1               ; token custs=(ok . fail)
    nth 1               ; token ok
    push k_next         ; token ok k_next
    new 2               ; k=k_next.(ok token)
    msg -3              ; k next
    ref std.send_msg

k_next:                 ; (ok token) <- in
    msg 0               ; in
    state 2             ; in accum=token
    pair 1              ; (accum . in)
    state 1             ; (accum . in) ok
    ref std.send_msg

; succeed and consume token if token matches expect

eq:                     ; (expect) <- ((ok . fail) accum . in)
    msg -2              ; in
    eq #nil             ; in==()
    if fail             ; --

    msg 3               ; token
    state 1             ; token expect
    cmp eq              ; token==expect
    if ok fail

; succeed and consume token if pred(token)

if:                     ; (pred) <- ((ok . fail) accum . in)
    msg -2              ; in
    eq #nil             ; in==()
    if fail             ; --

    msg 3               ; token
    msg 0               ; token ((ok . fail) accum . in)
    push k_if           ; token ((ok . fail) accum . in) k_if
    new -1              ; token k=k_if.((ok . fail) accum . in)
    state 1             ; token k pred
    send 2              ; --
    ref std.commit

k_if:                   ; ((ok . fail) accum . in) <- bool
    msg 0               ; bool
    if k_ok

    state -2            ; in
    state 1             ; in custs=(ok . fail)
    nth -1              ; in fail
    ref std.send_msg

k_ok:                   ; --
    state 3             ; token
    state 1             ; token custs=(ok . fail)
    nth 1               ; token ok
    push k_next         ; token ok k_next
    new 2               ; k=k_next.(ok token)
    state -3            ; k next
    ref std.send_msg

; a predicate for matching an inclusive range [lo, hi]

in_range:               ; (lo hi) <- (cust value)
    msg 2               ; value
    state 1             ; value lo
    cmp lt              ; value<lo
    if std.rv_false
    msg 2               ; value
    state 2             ; value hi
    cmp le              ; value<=hi
    ref std.cust_send

; try matching `first`, if failed try `rest` at same position

or:                     ; (first rest) <- ((ok . fail) accum . in)
    msg -1              ; ctx=(accum . in)
    msg 0               ; ctx msg=((ok . fail) accum . in)
    state 2             ; ctx msg rest
    push lib.relay_beh  ; ctx msg rest relay_beh
    new 2               ; ctx fail'=relay_beh.(rest msg)
    msg 1               ; ctx fail' custs=(ok . fail)
    nth 1               ; ctx fail' ok
    pair 1              ; ctx (ok . fail')
    pair 1              ; ((ok . fail') accum . in)
    state 1             ; ((ok . fail') accum . in) first
    ref std.send_msg

; try matching `first` followed by `rest`

and:                    ; (first rest) <- ((ok . fail) accum . in)
    msg -2              ; in
    msg 1               ; in custs=(ok . fail)
    nth -1              ; in fail
    push lib.relay_beh  ; in fail relay_beh
    new 2               ; fail'=relay_beh.(fail in)

    dup 1               ; fail' fail'
    msg 1               ; fail' fail' custs=(ok . fail)
    nth 1               ; fail' fail' ok
    state 2             ; fail' fail' ok rest
    push and_ok         ; fail' fail' ok rest and_ok
    new 3               ; fail' ok'=and_ok.(rest ok fail')

    pair 1              ; (ok' . fail')
    msg -1              ; (ok' . fail') (accum . in)
    roll -2             ; (accum . in) (ok' . fail')
    pair 1              ; ((ok' . fail') accum . in)
    state 1             ; ((ok . fail') accum . in) first
    ref std.send_msg

and_ok:                 ; (rest ok fail') <- (accum' . in')
    msg 0               ; (accum' . in')
    state 3             ; (accum' . in') fail'
    msg 1               ; (accum' . in') fail' accum'
    state 2             ; (accum' . in') fail' accum' ok
    push and_pair       ; (accum' . in') fail' accum' ok and_pair
    new 2               ; (accum' . in') fail' ok'=and_pair.(ok accum')

    pair 1              ; (accum' . in') (ok' . fail')
    pair 1              ; ((ok' . fail') accum . in)
    state 1             ; ((ok' . fail') accum . in) rest
    ref std.send_msg

and_pair:               ; (ok accum') <- (accum'' . in'')
    msg 0               ; (accum'' . in'')
    part 1              ; in'' accum''
    state 2             ; in'' accum'' accum'
    pair 1              ; in'' accum=(accum' . accum'')
    pair 1              ; (accum . in'')
    state 1             ; (accum . in'') ok
    ref std.send_msg

; succeed if `peg` fails, fail if it succeeds (look-ahead)

not:                    ; (peg) <- ((ok . fail) accum . in)
    msg 1               ; custs=(ok . fail)
    part 1              ; fail ok
    msg -2              ; fail ok in
    push #unit          ; fail ok in #unit
    pair 1              ; fail ok (#unit . in)
    roll 2              ; fail (#unit . in) ok
    push lib.relay_beh  ; fail (#unit . in) ok relay_beh
    new 2               ; fail fail'=relay_beh.(ok (#unit . in))

    msg -2              ; fail fail' in
    roll 3              ; fail' in fail
    push lib.relay_beh  ; fail' in fail relay_beh
    new 2               ; fail' ok'=relay_beh.(fail in)

    pair 1              ; (ok' . fail')
    msg -1              ; (ok' . fail') (accum . in)
    roll -2             ; (accum . in) (ok' . fail')
    pair 1              ; ((ok' . fail') accum . in)
    state 1             ; ((ok' . fail') accum . in) peg
    ref std.send_msg

; start parsing `source` according to `peg`

start:                  ; (peg) <- ((ok . fail) source)
    msg 1               ; custs=(ok . fail)
    state 1             ; custs=(ok . fail) peg
    push k_start        ; custs=(ok . fail) peg k_start
    new 2               ; cust=k_start.(peg (ok . fail))
    msg 2               ; cust source
    ref std.send_msg

k_start:                ; (peg (ok . fail)) <- in
    msg 0               ; in
    push #?             ; in accum=#?
    state 2             ; in accum custs=(ok . fail)
    pair 2              ; ((ok . fail) accum . in)
    state 1             ; ((ok . fail) accum . in) peg
    ref std.send_msg

;
; unit test suite
;

unexpected:             ; _ <- _
;    debug               ; BREAKPOINT
    push #f             ; #f
    assert #t           ; assert(#f==#t)
    ref std.commit

; assert deep (structural) equality

is_equal:               ; expect <- actual
    state 0             ; expect
    typeq #pair_t       ; is_pair(expect)
    if is_equal_pair    ; --

    ; FIXME: handle dictionary, etc...

    state 0             ; expect
    msg 0               ; expect actual
    cmp eq              ; expect==actual
    assert #t           ; assert(expect==actual)
    ref std.commit

is_equal_pair:          ; --
    msg 0               ; actual
    typeq #pair_t       ; is_pair(actual)
    assert #t           ; assert(is_pair(actual))

    msg 1               ; first(actual)
    state 1             ; first(actual) first(expect)
    push is_equal       ; first(actual) first(expect) is_equal
    new -1              ; first(actual) is_equal.first(expect)
    send -1             ; --

    msg -1              ; rest(actual)
    state -1            ; rest(actual) rest(expect)
    push is_equal       ; rest(actual) rest(expect) is_equal
    new -1              ; rest(actual) is_equal.rest(expect)
    ref std.send_msg

; test `empty` succeeds at end-of-stream

test_1:                 ; (debug_dev) <- ()
    state 0             ; (debug_dev)
    push test_2         ; (debug_dev) test_2
    beh -1              ; --
    my self             ; SELF
    send 0              ; --
;    if_not std.commit   ; // SKIP THIS TEST...

    push #nil           ; in=()
    push #?             ; in accum=#?
    push unexpected     ; in accum unexpected
    new 0               ; in accum fail=unexpected.()
    push expect_1       ; in accum fail expect_1
    new 0               ; in accum fail ok=expect_1.()
    pair 1              ; in accum (ok . fail)
    pair 2              ; ((ok . fail) accum . in)
    push empty          ; ((ok . fail) accum . in) empty
    new 0               ; ((ok . fail) accum . in) peg=empty.()
    ref std.send_msg

test_1_data:            ; (())
    pair_t #nil
    ref #nil

expect_1:               ; () <- (accum . in)
;    msg 0               ; (accum . in)
;    push test_1_data    ; (accum . in) test_1_data
;    push is_equal       ; (accum . in) test_1_data is_equal
;    new -1              ; (accum . in) is_equal.test_1_data
;    send -1             ; --

;    debug               ; BREAKPOINT
    msg 1               ; accum
    assert #nil         ; assert(accum==#nil)
    msg -1              ; in
    assert #nil         ; assert(in==#nil)
    ref std.commit

; test `fail` fails at end-of-stream

test_2:                 ; (debug_dev) <- ()
    state 0             ; (debug_dev)
    push test_3         ; (debug_dev) test_3
    beh -1              ; --
    my self             ; SELF
    send 0              ; --
;    if_not std.commit   ; // SKIP THIS TEST...

    push #nil           ; in=()
    push #?             ; in accum=#?
    push expect_2       ; in accum expect_2
    new 0               ; in accum fail=expect_2.()
    push unexpected     ; in accum fail unexpected
    new 0               ; in accum fail ok=unexpected.()
    pair 1              ; in accum (ok . fail)
    pair 2              ; ((ok . fail) accum . in)
    push fail           ; ((ok . fail) accum . in) fail
    new 0               ; ((ok . fail) accum . in) peg=fail.()
    ref std.send_msg

expect_2:               ; () <- in
;    debug               ; BREAKPOINT
    msg 0               ; in
    assert #nil         ; assert(in==#nil)
    ref std.commit

; test `any` fails at end-of-stream

test_3:                 ; (debug_dev) <- ()
    state 0             ; (debug_dev)
    push test_4         ; (debug_dev) test_4
    beh -1              ; --
    my self             ; SELF
    send 0              ; --
;    if_not std.commit   ; // SKIP THIS TEST...

    push #nil           ; in=()
    push #?             ; in accum=#?
    push expect_3       ; in accum expect_3
    new 0               ; in accum fail=expect_3.()
    push unexpected     ; in accum fail unexpected
    new 0               ; in accum fail ok=unexpected.()
    pair 1              ; in accum (ok . fail)
    pair 2              ; ((ok . fail) accum . in)
    push any            ; ((ok . fail) accum . in) any
    new 0               ; ((ok . fail) accum . in) peg=any.()
    ref std.send_msg

expect_3:               ; () <- in
;    debug               ; BREAKPOINT
    msg 0               ; in
    assert #nil         ; assert(in==#nil)
    ref std.commit

; test `any` succeeds on non-empty stream

test_source:            ; (48 13 10)
    pair_t '0'
    pair_t '\r'
    pair_t '\n'
    ref #nil

test_4:                 ; (debug_dev) <- ()
    state 0             ; (debug_dev)
    push test_5         ; (debug_dev) test_5
    beh -1              ; --
    my self             ; SELF
    send 0              ; --
;    if_not std.commit   ; // SKIP THIS TEST...

    push test_source    ; list=test_source
    push s_list         ; test_source s_list
    new -1              ; source=s_list.test_source
    push unexpected     ; source unexpected
    new 0               ; source fail=unexpected.()
    push expect_4       ; source fail expect_4
    new 0               ; source fail ok=expect_4.()
    pair 1              ; source (ok . fail)
    push any            ; source (ok . fail) any
    new 0               ; source (ok . fail) peg=any.()
    push start          ; source (ok . fail) peg start
    new 1               ; source (ok . fail) start.(peg)
    send 2              ; --
    ref std.commit

expect_4:               ; () <- ('0' '\r' . next)
;    debug               ; BREAKPOINT
    msg 1               ; accum
    assert '0'          ; assert(accum=='0')
    msg 2               ; in.token
    assert '\r'         ; assert(in=='\r')
    ref std.commit

; test [0-9] succeeds on stream starting with '0'

test_5:                 ; (debug_dev) <- ()
    state 0             ; (debug_dev)
    push test_6         ; (debug_dev) test_6
    beh -1              ; --
    my self             ; SELF
    send 0              ; --
;    if_not std.commit   ; // SKIP THIS TEST...

    push test_source    ; list=test_source
    push s_list         ; test_source s_list
    new -1              ; source=s_list.test_source
    push unexpected     ; source unexpected
    new 0               ; source fail=unexpected.()
    push expect_5       ; source fail expect_5
    new 0               ; source fail ok=expect_5.()
    pair 1              ; source (ok . fail)
    push '9'            ; ... '9'
    push '0'            ; ... '9' '0'
    push in_range       ; ... '9' '0' in_range
    new 2               ; ... pred=in_range.('0' '9')
    push if             ; ... pred if
    new 1               ; source (ok . fail) peg=if.(pred)
    push start          ; source (ok . fail) peg start
    new 1               ; source (ok . fail) start.(peg)
    send 2              ; --
    ref std.commit

expect_5:               ; () <- ('0' '\r' . next)
;    debug               ; BREAKPOINT
    msg 1               ; accum
    assert '0'          ; assert(accum=='0')
    msg 2               ; in.token
    assert '\r'         ; assert(in=='\r')
    msg -2              ; next
    typeq #actor_t      ; is_actor(next)
    assert #t           ; assert(is_actor(next))
    ref std.commit

; test and/or/not grammar
;
; grammar   = '0' eol eos
; eol       = lf
;           / cr opt_lf
; cr        = '\r'
; lf        = '\n'
; opt_lf    = lf
;           / ε
; eos       = !.

test_6:                 ; (debug_dev) <- ()
    push test_source    ; list=test_source
    push s_list         ; test_source s_list
    new -1              ; source=s_list.test_source
    push unexpected     ; source unexpected
    new 0               ; source fail=unexpected.()
    push expect_6       ; source fail expect_6
    new 0               ; source fail ok=expect_6.()
    pair 1              ; source (ok . fail)

    push any            ; ... any
    new 0               ; ... any.()
    push not            ; ... any.() not
    new 1               ; ... eos=not.(any.())
    push '\n'           ; ... eos '\n'
    push eq             ; ... eos '\n' eq
    new 1               ; ... eos lf=eq.('\n')
    push empty          ; ... eos lf empty
    new 0               ; ... eos lf e=empty.()
    pick 2              ; ... eos lf e lf
    push or             ; ... eos lf e lf or
    new 2               ; ... eos lf opt_lf=or.(lf e)
    push '\r'           ; ... eos lf opt_lf '\r'
    push eq             ; ... eos lf opt_lf '\r' eq
    new 1               ; ... eos lf opt_lf cr=eq.('\r')
    push and            ; ... eos lf opt_lf cr and
    new 2               ; ... eos lf and.(cr opt_lf)
    roll 2              ; ... eos and.(cr opt_lf) lf
    push or             ; ... eos and.(cr opt_lf) lf or
    new 2               ; ... eos eol=or.(lf and.(cr opt_lf))
    push and            ; ... eos eol and
    new 2               ; ... and.(eol eos)
    push '0'            ; ... and.(eol eos) '0'
    push eq             ; ... and.(eol eos) '0' eq
    new 1               ; ... and.(eol eos) eq.('0')
    push and            ; ... and.(eol eos) eq.('0') and
    new 2               ; ... peg=and.(eq.('0') and.(eol eos))

    push start          ; source (ok . fail) peg start
    new 1               ; source (ok . fail) start.(peg)
    send 2              ; --
    ref std.commit

test_6_data:            ; (('0' ('\r' . '\n') . #unit) . ())
    pair_t test_6_accum
    ref #nil
test_6_accum:           ; ('0' ('\r' . '\n') . #unit)
    pair_t '0'
    pair_t test_6_eol
    ref #unit
test_6_eol:             ; ('\r' . '\n')
    pair_t '\r'
    ref '\n'

expect_6:               ; () <- (accum . in)
;    debug               ; BREAKPOINT
    msg 0               ; (accum . in)
    push test_6_data    ; (accum . in) test_6_data
    push is_equal       ; (accum . in) test_6_data is_equal
    new -1              ; (accum . in) is_equal.test_6_data
    ref std.send_msg

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.debug_key  ; {caps} debug_key
    dict get            ; debug_dev
    push test_1         ; debug_dev test=test_1
;    push test_5         ; debug_dev test=test_5
    new 1               ; test.(debug_dev)
    send 0              ; --
    ref std.commit

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
