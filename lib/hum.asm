; Runtime support for compiled Humus.

.import
    div: "https://ufork.org/lib/div_mod.asm"
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

push_op:
    ref 2
msg_op:
    ref 24

; A Humus closure is represented as an assembly procedure taking one argument
; and returning one value. A closure is created by prefixing some precompiled
; code with an instruction pushing the environment onto the stack.

make_closure:               ; ( code env k -- closure )
    roll -3                 ; k code env
    push push_op            ; k code env push_op
    push #instr_t           ; k code env push_op #instr_t
    quad 4                  ; k closure=[#instr_t, push_op, env, code]
    ref std.return_value

; Closure code expects a stack like

;                           ; args k env

; where 'args' is the single argument, 'k' is the continuation to return to,
; and 'env' is the closure's environment.

; Immediately, the arguments are incorporated into the environment.

;   roll 3                  ; k env args
;   pair 1                  ; k env'=(args . env)

; After evaluating the return value, the code returns (or continues) to 'k'.

return:                     ; k env' rv
    roll -3                 ; rv k env'
    drop 1                  ; rv k
    return

; Tail calls are achieved by modifying the existing frame before jumping
; directly to the procedure or compiled closure code.

tail_call:                  ; k env procedure args
    roll -4                 ; args k env procedure
    roll 2                  ; args k procedure env
    drop 1                  ; args k procedure
call:
    dup 1                   ; args k procedure procedure
    typeq #instr_t          ; args k procedure instr?
    if_not fail_call        ; args k procedure
    jump

fail_call:                  ; args k procedure
    push #?                 ; args k procedure rv=#?
    roll -4                 ; rv args k procedure
    drop 1                  ; rv args k
    roll 2                  ; rv k args
    drop 1                  ; rv k
    jump

self_tail_call:             ; k env env' code args
    roll -5                 ; args k env env' code
    roll 3                  ; args k env' code env
    drop 1                  ; args k env' code
    jump

; A block is essentially a closure that take no arguments. Because blocks have a
; different signature, and are executed implicitly, they must be
; distinguishable from closures. A custom type is defined for this purpose.

block_t:                    ; [block_t, code, env]
    type_t 2

make_block:                 ; ( env code k -- block )
    roll -3                 ; k env code
    push block_t            ; k env code block_t
    quad 3                  ; k block=[block_t, code, env]
    ref std.return_value

execute_block:              ; ( value k -- )
    roll -2                 ; k value
    quad -3                 ; k Y X T
    eq block_t              ; k Y X block_t?(T)
    if execute_k            ; k env=Y code=X
    drop 2                  ; k
execute_k:
    jump

; At compile time, it is not always possible to discern the intended role of a
; closure. Will it be used as the behavior for an actor, or called as a
; procedure?

; Consequently, the compiled code for a closure needs enough flexibility to
; either handle a message or to be called as a procedure. Clearly closures can
; be called as procedures, because they conform to the calling convention of
; assembly procedures.

; Before a closure can be invoked as a behavior for an actor, the 'args' and 'k'
; values must be provided on the stack. This is accomplished by 'beh', the
; generic actor behavior.

; It first pushes the message onto the stack as 'args', then pushes a
; continuation as 'k'. Finally it retrieves the closure from the actor's state
; and calls it. If the returned value is a block, it is executed for its
; effects. Otherwise the transaction is aborted.

; Use 'beh' with 'beh -1' or 'new -1', for example:

;   push closure            ; closure
;   push hum.beh            ; closure beh
;   beh -1                  ; actor=beh.closure

beh:                        ; closure <- msg
    push std.commit         ; commit
    msg 0                   ; commit args=msg
    push beh_end            ; commit args k=beh_end
    state 0                 ; commit args k closure
    jump
beh_end:                    ; commit rv
    quad -3                 ; commit Y X T
    eq block_t              ; commit Y X T==block_t
    if_not std.abort        ; k=commit env=Y code=X
    jump

; Symbols are interned as quads containing a pair list of code points encoding
; the symbol text.

symbol_t:                   ; [symbol_t, string]
    type_t 1

; Construct the top level environment from capabilities in the boot message.

random_adapter_beh:         ; random_dev <- (cust . n)
    msg -1                  ; n
    push 1                  ; n 1
    alu sub                 ; limit=n-1
    msg 1                   ; limit cust
    state 0                 ; limit cust random_dev
    send 2                  ; --
    ref std.commit

timer_adapter_beh:          ; timer_dev <- (dt msg . actor)
    msg 2                   ; message=msg
    msg -2                  ; message target=actor
    msg 1                   ; message target delay=dt
    state 0                 ; message target delay timer_dev
    send 3                  ; --
    ref std.commit

prepare_env:                ; ( k -- env )
    push #?                 ; k #?

    msg 0                   ; k #? {caps}
    push dev.debug_key      ; k #? {caps} debug_key
    dict get                ; k #? println=debug_dev

    msg 0                   ; k #? println {caps}
    push dev.timer_key      ; k #? println {caps} timer_key
    dict get                ; k #? println timer_dev
    push timer_adapter_beh  ; k #? println timer_dev timer_adapter_beh
    new -1                  ; k #? println timer=timer_adapter_beh.timer_dev

    msg 0                   ; k #? println timer {caps}
    push dev.random_key     ; k #? println timer {caps} random_key
    dict get                ; k #? println timer random_dev
    push random_adapter_beh ; k #? println timer random_dev random_adapter_beh
    new -1                  ; k #? println timer random=random_adapter_beh.random_dev

    msg 0                   ; k #? println timer random {caps}
    push dev.io_key         ; k #? println timer random {caps} io_key
    dict get                ; k #? println timer random stdio

    msg 0                   ; k #? println timer random stdio {caps}
    push dev.svg_key        ; k #? println timer random stdio {caps} svg_key
    dict get                ; k #? println timer random stdio svgout

    pair 4                  ; k #? scope=(svgout stdio random timer . println)
    pair 1                  ; k env=(scope . #?)
    ref std.return_value

; Miscellaneous procedures.

drop_return_f:              ; k value
    drop 1                  ; k
    ref std.return_f

drop_return_t:              ; k value
    drop 1                  ; k
    ref std.return_t

is_bool:                    ; value k
    roll -2                 ; k value
    dup 1                   ; k value value
    eq #t                   ; k value value==#t
    if drop_return_t        ; k value
    eq #f                   ; k value==#f
    ref std.return_value

is_bool_pair:               ; value k
    roll -2                 ; k value=(head . tail)
    part 1                  ; k tail head
    call is_bool            ; k tail bool?(head)
    if_not drop_return_f    ; k tail
    call is_bool            ; k bool?(tail)
    ref std.return_value

equal:                      ; args=(a . b) k
    roll -2                 ; k args
    part 1                  ; k b a
equal_tail:                 ; k b a
    dup 2                   ; k b a b a
    cmp eq                  ; k b a b==a
    if equal_t              ; k b a
    dup 1                   ; k b a a
    typeq #pair_t           ; k b a is_pair(a)
    if_not equal_f          ; k b a
    roll 2                  ; k a b
    dup 1                   ; k a b b
    typeq #pair_t           ; k a b is_pair(b)
    if_not equal_f          ; k a b
    part 1                  ; k a tl(b) hd(b)
    roll 3                  ; k tl(b) hd(b) a
    part 1                  ; k tl(b) hd(b) tl(a) hd(a)
    roll 3                  ; k tl(b) tl(a) hd(a) hd(b)
    pair 1                  ; k tl(b) tl(a) (hd(b) . hd(a))
    call equal              ; k tl(b) tl(a) hd(b)==hd(a)
    if equal_tail           ; k tl(b) tl(a)
equal_f:                    ; k b a
    drop 2                  ; k
    ref std.return_f
equal_t:                    ; k b a
    drop 2                  ; k
    ref std.return_t

list_of_3:
    pair_t 3 #nil           ; (3)
test_equal:                 ; k
    push #?                 ; k #?
    push #?                 ; k #? #?
    pair 1                  ; k (#? . #?)
    call equal              ; k #?==#?
    assert #t               ; k
    push list_of_3          ; k (3)
    push 2                  ; k (3) 2
    push 1                  ; k (3) 2 1
    pair 2                  ; k (1 2 3)
    push list_of_3          ; k (1 2 3) (3)
    push 2                  ; k (1 2 3) (3) 2
    push 1                  ; k (1 2 3) (3) 2 1
    pair 2                  ; k (1 2 3) (1 2 3)
    pair 1                  ; k ((1 2 3) . (1 2 3))
    call equal              ; k (1 2 3)==(1 2 3)
    assert #t               ; k
    return

compare:                    ; args k
    roll -2                 ; k args
    part 1                  ; k b a
    dup 2                   ; k b a b a
    cmp eq                  ; k b a b==a
    if compare_eq           ; k b a
    dup 2                   ; k b a b a
    cmp lt                  ; k b a b<a
    if compare_gt           ; k b a
    cmp gt                  ; k b>a
    if compare_lt           ; k
    ref std.return_undef
compare_lt:                 ; k
    push -1                 ; k -1
    ref std.return_value
compare_eq:                 ; k b a
    drop 2                  ; k
    ref std.return_zero
compare_gt:                 ; k b a
    drop 2                  ; k
    ref std.return_one

test_compare_case:          ; expect b a k
    roll -4                 ; k expect b a
    pair 1                  ; k expect args=(a . b)
    call compare            ; k expect actual
    cmp eq                  ; k eq?
    assert #t               ; k
    return

test_compare:               ; k
    push -1                 ; k expect
    push 555                ; k expect b
    push 444                ; k expect b a
    call test_compare_case  ; k
    push 0                  ; k expect
    push 555                ; k expect b
    push 555                ; k expect b a
    call test_compare_case  ; k
    push 1                  ; k expect
    push 555                ; k expect b
    push 666                ; k expect b a
    call test_compare_case  ; k
    return

; Euclidean division, where <latex> n = dq + r </latex>,
;                      and <latex> 0 ≤ r < |d| </latex>.

div_mod:                    ; args=(n . d) k
    roll 2                  ; k (n . d)
    part 1                  ; k d n
    roll 2                  ; k n d
    call div.divmod         ; k q r
    roll 2                  ; k r q
    pair 1                  ; k (q . r)
    ref std.return_value

test_div:                   ; k
    push 17                 ; k 17
    push 5                  ; k 17 5
    roll 2                  ; k 5 17
    pair 1                  ; k (17 . 5)
    call div_mod            ; k (3 . 2)
    part 1                  ; k 2 3
    assert 3                ; k 2
    assert 2                ; k

    push -17                ; k -17
    push 5                  ; k -17 5
    roll 2                  ; k 5 -17
    pair 1                  ; k (-17 . 5)
    call div_mod            ; k (-4 . 3)
    part 1                  ; k 3 -4
    assert -4               ; k 3
    assert 3                ; k

    push 17                 ; k 17
    push -5                 ; k 17 -5
    roll 2                  ; k -5 17
    pair 1                  ; k (17 . -5)
    call div_mod            ; k (-3 . 2)
    part 1                  ; k 2 -3
    assert -3               ; k 2
    assert 2                ; k

    push -17                ; k -17
    push -5                 ; k -17 -5
    roll 2                  ; k -5 -17
    pair 1                  ; k (-17 . -5)
    call div_mod            ; k (4 . 3)
    part 1                  ; k 3 4
    assert 4                ; k 3
    assert 3                ; k

    push -12                ; k -12
    push 4                  ; k -12 4
    roll 2                  ; k 4 -12
    pair 1                  ; k (-12 . 4)
    call div_mod            ; k (-3 . 0)
    part 1                  ; k 0 -3
    assert -3               ; k 0
    assert 0                ; k
    return

boot:                       ; () <- {caps}
    call test_equal         ; --
    call test_compare       ; --
    call test_div           ; --
    ref std.commit

test:                       ; (verdict) <- {caps}
    call test_equal         ; --
    call test_compare       ; --
    call test_div           ; --
    push #t                 ; pass=#t
    state 1                 ; pass verdict
    send -1                 ; --
    ref std.commit

.export
    beh
    block_t
    boot
    call
    equal
    compare
    div_mod
    execute_block
    is_bool
    is_bool_pair
    make_block
    make_closure
    prepare_env
    return
    self_tail_call
    symbol_t
    test
    tail_call
