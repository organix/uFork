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
    dev: "./dev.asm"

;
; literal sequence input stream
;

s_seq:                  ; seq <- cust
    state 0             ; seq
    typeq #pair_t       ; is_pair(seq)
    if_not s_eos        ; --

    state -1            ; rest
    push s_seq          ; rest s_seq
    new -1              ; next=s_seq(rest)
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

pred:                   ; (pred) <- ((ok . fail) accum . in)
    msg -2              ; in
    eq #nil             ; in==()
    if fail             ; --

    msg 3               ; token
    msg 0               ; token ((ok . fail) accum . in)
    push k_pred         ; token ((ok . fail) accum . in) k_pred
    new -1              ; token k=k_pred.((ok . fail) accum . in)
    state 1             ; token k pred
    send 2              ; --
    ref std.commit

k_pred:                 ; ((ok . fail) accum . in) <- bool
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

;
; unit test suite
;

unexpected:             ; _ <- _
;    debug               ; BREAKPOINT
    push #f             ; #f
    is_eq #t            ; assert(#f==#t)
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
    is_eq #t            ; assert(expect==actual)
    ref std.commit

is_equal_pair:          ; --
    msg 0               ; actual
    typeq #pair_t       ; is_pair(actual)
    is_eq #t            ; assert(is_pair(actual))

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

expect_1_data:          ; (())
    pair_t #nil
    ref #nil

expect_1:               ; () <- (accum . in)
;    msg 0               ; (accum . in)
;    push expect_1_data  ; (accum . in) expect_1_data
;    push is_equal       ; (accum . in) expect_1_data is_equal
;    new -1              ; (accum . in) is_equal.expect_1_data
;    send -1             ; --

;    debug               ; BREAKPOINT
    msg 1               ; accum
    is_eq #nil          ; assert(accum==#nil)
    msg -1              ; in
    is_eq #nil          ; assert(in==#nil)
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
    is_eq #nil          ; assert(in==#nil)
    ref std.commit

; test `any` fails at end-of-stream

test_3:                 ; (debug_dev) <- ()
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
    is_eq #nil          ; assert(in==#nil)
    ref std.commit

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.debug_key  ; {caps} debug_key
    dict get            ; debug_dev
    push test_1         ; debug_dev test=test_1
    new 1               ; test.(debug_dev)
    send 0              ; --
    ref std.commit

.export
    empty
    fail
    any
    eq
    pred
    boot
