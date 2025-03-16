; Runtime support for compiled Humus.

.import
    div_mod: "./div_mod.asm"
    dev: "./dev.asm"
    eq: "./eq.asm"
    std: "./std.asm"

push_op:
    ref 2
msg_op:
    ref 24

; A Humus closure is represented as an assembly procedure taking one argument
; and returning one value. A closure is created by prefixing some precompiled
; code with an instruction pushing the environment onto the stack.

make_closure:               ; ( code env -- closure )
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
;   pair 1                  ; k env'=args,env

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

make_block:                 ; ( env code -- block )
    roll -3                 ; k env code
    push block_t            ; k env code block_t
    quad 3                  ; k block=[block_t, code, env]
    ref std.return_value

execute_block:              ; ( value -- )
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

; Use 'beh' with 'actor become' or 'actor create', for example:

;   push closure            ; closure
;   push hum.beh            ; closure beh
;   actor create            ; actor=beh.closure

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

system_code:                ; args=key k env={caps}
    roll 3                  ; k {caps} key
    dict get                ; k cap
    ref std.return_value

random_adapter_beh:         ; random_dev <- cust,n
    msg -1                  ; n
    push 1                  ; n 1
    alu sub                 ; limit=n-1
    msg 1                   ; limit cust
    pair 1                  ; cust,limit
    state 0                 ; cust,limit random_dev
    actor send              ; --
    ref std.commit

timer_adapter_beh:          ; timer_dev <- dt,msg,actor
    msg 2                   ; msg
    msg -2                  ; msg target=actor
    msg 1                   ; msg target delay=dt
    pair 2                  ; timer_req=delay,target,msg
    state 0                 ; timer_req timer_dev
    actor send              ; --
    ref std.commit

prepare_env:                ; ( -- env )
    push #?                 ; k #?

    push system_code        ; k #? code=system_code
    msg 0                   ; k #? code env={caps}
    call make_closure       ; k #? system

    msg 0                   ; k #? system {caps}
    push dev.debug_key      ; k #? system {caps} debug_key
    dict get                ; k #? system println=debug_dev

    msg 0                   ; k #? system println {caps}
    push dev.timer_key      ; k #? system println {caps} timer_key
    dict get                ; k #? system println timer_dev
    push timer_adapter_beh  ; k #? system println timer_dev timer_adapter_beh
    actor create            ; k #? system println timer=timer_adapter_beh.timer_dev

    msg 0                   ; k #? system println timer {caps}
    push dev.random_key     ; k #? system println timer {caps} random_key
    dict get                ; k #? system println timer random_dev
    push random_adapter_beh ; k #? system println timer random_dev random_adapter_beh
    actor create            ; k #? system println timer random=random_adapter_beh.random_dev

    pair 3                  ; k #? scope=random,timer,println,system
    pair 1                  ; k env=scope,#?
    ref std.return_value

; Miscellaneous procedures.

dreturn_f:                  ; k value
    drop 1                  ; k
    ref std.return_false

dreturn_t:                  ; k value
    drop 1                  ; k
    ref std.return_true

dreturn_undef:              ; k value
    drop 1                  ; k
    ref std.return_undef

ddreturn_undef:             ; k value value
    drop 2                  ; k
    ref std.return_undef

is_bool_pair:               ; ( value -- boolean )
    roll -2                 ; k value=head,tail
    part 1                  ; k tail head
    call is_boolean         ; k tail bool?(head)
    if_not dreturn_f        ; k tail
    call is_boolean         ; k bool?(tail)
    ref std.return_value

; Primitive builtins.

eq:                         ; ( pair -- boolean )
    roll -2                 ; k pair
    dup 1                   ; k pair pair
    typeq #pair_t           ; k pair is_pair(pair)
    if_not dreturn_undef    ; k pair=a,b
    part 1                  ; k b a
    call eq.proc            ; k boolean
    ref std.return_value

list_of_3:
    pair_t 3 #nil           ; 3,#nil
test_eq:                    ; ( -- )
    push #?                 ; k #?
    push #?                 ; k #? #?
    pair 1                  ; k #?,#?
    call eq                 ; k #?==#?
    assert #t               ; k

    push list_of_3          ; k 3,#nil
    push 2                  ; k 3,#nil 2
    push 1                  ; k 3,#nil 2 1
    pair 2                  ; k 1,2,3,#nil
    push list_of_3          ; k 1,2,3,#nil 3,#nil
    push 2                  ; k 1,2,3,#nil 3,#nil 2
    push 1                  ; k 1,2,3,#nil 3,#nil 2 1
    pair 2                  ; k 1,2,3,#nil 1,2,3,#nil
    pair 1                  ; k (1,2,3,#nil),(1,2,3,#nil)
    call eq                 ; k 1,2,3,#nil==1,2,3,#nil
    assert #t               ; k

    push 1                  ; k 1
    push 2                  ; k 1 2
    pair 1                  ; k 1,2
    call eq                 ; k 1==2
    assert #f               ; k

    push 42                 ; k 42
    call eq                 ; k ???
    assert #?               ; k
    return

not:                        ; ( value -- boolean | #? )
    roll -2                 ; k value
    dup 1                   ; k value value
    call is_boolean         ; k value bool?(value)
    if_not dreturn_undef    ; k value
    if std.return_false     ; k
    ref std.return_true

test_not:                   ; ( -- )
    push #t                 ; k value=#t
    call not                ; k not(#t)
    assert #f               ; k
    push #f                 ; k value=#f
    call not                ; k not(#f)
    assert #t               ; k
    push 123                ; k value=123
    call not                ; k not(123)
    assert #?               ; k
    return

and:                        ; ( pair -- boolean | #? )
    roll -2                 ; k pair
    dup 1                   ; k pair pair
    call is_bool_pair       ; k pair ok?
    if_not dreturn_undef    ; k pair=a,b
    part 1                  ; k b a
    if_not dreturn_f        ; k b
    ref std.return_value

test_and_case:              ; ( expect b a -- )
    roll -4                 ; k expect b a
    pair 1                  ; k expect pair=a,b
    call and                ; k expect actual
    cmp eq                  ; k expect==actual
    assert #t               ; k
    return

test_and:                   ; ( -- )
    push #t                 ; k expect
    push #t                 ; k expect b
    push #t                 ; k expect b a
    call test_and_case      ; k
    push #f                 ; k expect
    push #t                 ; k expect b
    push #f                 ; k expect b a
    call test_and_case      ; k
    push #f                 ; k expect
    push #f                 ; k expect b
    push #t                 ; k expect b a
    call test_and_case      ; k
    push #f                 ; k expect
    push #f                 ; k expect b
    push #f                 ; k expect b a
    call test_and_case      ; k
    push #?                 ; k expect
    push 42                 ; k expect b
    push #f                 ; k expect b a
    call test_and_case      ; k
    push #?                 ; k expect
    push #f                 ; k expect b
    push 42                 ; k expect b a
    call test_and_case      ; k
    return

or:                         ; ( pair -- boolean | #? )
    roll -2                 ; k pair
    dup 1                   ; k pair pair
    call is_bool_pair       ; k pair ok?
    if_not dreturn_undef    ; k pair=a,b
    part 1                  ; k b a
    if dreturn_t            ; k b
    ref std.return_value

test_or_case:               ; ( expect b a -- )
    roll -4                 ; k expect b a
    pair 1                  ; k expect pair=a,b
    call or                 ; k expect actual
    cmp eq                  ; k expect==actual
    assert #t               ; k
    return

test_or:                    ; ( -- )
    push #t                 ; k expect
    push #t                 ; k expect b
    push #t                 ; k expect b a
    call test_or_case       ; k
    push #t                 ; k expect
    push #t                 ; k expect b
    push #f                 ; k expect b a
    call test_or_case       ; k
    push #t                 ; k expect
    push #f                 ; k expect b
    push #t                 ; k expect b a
    call test_or_case       ; k
    push #f                 ; k expect
    push #f                 ; k expect b
    push #f                 ; k expect b a
    call test_or_case       ; k
    push #?                 ; k expect
    push 42                 ; k expect b
    push #t                 ; k expect b a
    call test_or_case       ; k
    push #?                 ; k expect
    push #t                 ; k expect b
    push 42                 ; k expect b a
    call test_or_case       ; k
    return

is_boolean:                 ; ( value -- boolean )
    roll -2                 ; k value
    dup 1                   ; k value value
    eq #t                   ; k value value==#t
    if dreturn_t            ; k value
    eq #f                   ; k value==#f
    ref std.return_value

is_number:                  ; ( value -- boolean )
    roll -2                 ; k value
    typeq #fixnum_t         ; k number?(value)
    ref std.return_value

is_function:                ; ( value -- boolean )
    roll -2                 ; k value
    typeq #instr_t          ; k instr?(value)
    ref std.return_value

is_actor:                   ; ( value -- boolean )
    roll -2                 ; k value
    typeq #actor_t          ; k actor?(value)
    ref std.return_value

is_pair:                    ; ( value -- boolean )
    roll -2                 ; k value
    typeq #pair_t           ; k pair?(value)
    ref std.return_value

test_predicates:            ; ( -- )
    push #t                 ; k value
    call is_boolean         ; k actual
    assert #t               ; k
    push 42                 ; k value
    call is_boolean         ; k actual
    assert #f               ; k

    push 42                 ; k value
    call is_number          ; k actual
    assert #t               ; k
    push #t                 ; k value
    call is_number          ; k actual
    assert #f               ; k

    push is_function        ; k value
    call is_function        ; k actual
    assert #t               ; k
    push 42                 ; k value
    call is_function        ; k actual
    assert #f               ; k

    push #?                 ; k #?
    push std.sink_beh       ; k #? sink_beh
    actor create            ; k sink=sink_beh.#?
    call is_actor           ; k actual
    assert #t               ; k
    push is_actor           ; k value
    call is_actor           ; k actual
    assert #f               ; k

    push list_of_3          ; k pair
    call is_pair            ; k actual
    assert #t               ; k
    push #t                 ; k value
    call is_pair            ; k actual
    assert #f               ; k
    return

neg:                        ; ( n -- n | #? )
    roll -2                 ; k n
    push -1                 ; k n -1
    alu mul                 ; k -n
    ref std.return_value

test_neg:                   ; ( -- )
    push #t                 ; k value=#t
    call neg                ; k neg(#t)
    assert #?               ; k
    push 5                  ; k value=5
    call neg                ; k neg(5)
    assert -5               ; k
    push -5                 ; k value=-5
    call neg                ; k neg(-5)
    assert 5                ; k
    return

add:                        ; ( pair -- n | #? )
    roll -2                 ; k pair=a,b
    part 1                  ; k b a
    alu add                 ; k b+a
    ref std.return_value

sub:                        ; ( pair -- n | #? )
    roll -2                 ; k pair=a,b
    part 1                  ; k b a
    roll 2                  ; k a b
    alu sub                 ; k a-b
    ref std.return_value

mul:                        ; ( pair -- n | #? )
    roll -2                 ; k pair=a,b
    part 1                  ; k b a
    alu mul                 ; k b*a
    ref std.return_value

test_alu:                   ; ( -- )
    push 1729               ; k b=1729
    push 42                 ; k b a=42
    pair 1                  ; k pair=a,b
    dup 1                   ; k pair pair
    call add                ; k pair a+b
    roll 2                  ; k a+b pair
    call mul                ; k a+b a*b
    pair 1                  ; k a*b,a+b
    call sub                ; k (a*b)-(a+b)
    assert 70847            ; k
    return

div:                        ; ( pair -- q )
    roll 2                  ; k pair=n,d
    part 1                  ; k d n
    roll 2                  ; k n d
    call div_mod.divmod     ; k q r
    drop 1                  ; k q
    ref std.return_value

test_div:                   ; ( -- )
    push 5                  ; k d=5
    push 17                 ; k d n=17
    pair 1                  ; k pair=n,d
    call div                ; k q
    assert 3                ; k
    return

mod:                        ; ( pair -- r )
    roll 2                  ; k pair=n,d
    part 1                  ; k d n
    roll 2                  ; k n d
    call div_mod.divmod     ; k q r
    roll 2                  ; k r q
    drop 1                  ; k r
    ref std.return_value

test_mod:                   ; ( -- )
    push 5                  ; k d=5
    push 17                 ; k d n=17
    pair 1                  ; k pair=n,d
    call mod                ; k r
    assert 2                ; k
    return

compare:                    ; ( pair -- -1 | 0 | 1 )
    roll -2                 ; k pair
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

test_compare_case:          ; ( expect b a -- )
    roll -4                 ; k expect b a
    pair 1                  ; k expect pair=a,b
    call compare            ; k expect actual
    cmp eq                  ; k eq?
    assert #t               ; k
    return

test_compare:               ; ( -- )
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

less:                       ; ( pair -- boolean | #? )
    roll -2                 ; k pair=a,b
    part 1                  ; k b a
    cmp gt                  ; k b>a
    ref std.return_value

less_equal:                 ; ( pair -- boolean | #? )
    roll -2                 ; k pair=a,b
    part 1                  ; k b a
    cmp ge                  ; k b>=a
    ref std.return_value

greater:                    ; ( pair -- boolean | #? )
    roll -2                 ; k pair=a,b
    part 1                  ; k b a
    cmp lt                  ; k b<a
    ref std.return_value

greater_equal:              ; ( pair -- boolean | #? )
    roll -2                 ; k pair=a,b
    part 1                  ; k b a
    cmp le                  ; k b<=a
    ref std.return_value

test_cmp:                   ; ( -- )
    push 1729               ; k b=1729
    push 42                 ; k b a=42
    pair 1                  ; k a,b
    call less               ; k a<b
    assert #t               ; k
    push 666                ; k b=666
    push 666                ; k b a=666
    pair 1                  ; k a,b
    call greater_equal      ; k a>=b
    assert #t               ; k
    push 42                 ; k b=42
    push #t                 ; k b a=#t
    pair 1                  ; k a,b
    call greater            ; k a>b
    assert #?               ; k
    return

; Test suite.

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; judge=debug
    ref suite

test:                       ; judge <- {caps}
    state 0                 ; judge
suite:
    call test_alu           ; judge
    call test_and           ; judge
    call test_cmp           ; judge
    call test_compare       ; judge
    call test_div           ; judge
    call test_eq            ; judge
    call test_mod           ; judge
    call test_neg           ; judge
    call test_not           ; judge
    call test_or            ; judge
    call test_predicates    ; judge
    push #t                 ; judge verdict=#t
    roll 2                  ; verdict judge
    ref std.send_msg

.export
    add
    and
    beh
    block_t
    boot
    call
    compare
    div
    eq
    execute_block
    greater
    greater_equal
    is_actor
    is_boolean
    is_function
    is_number
    is_pair
    less
    less_equal
    make_block
    make_closure
    mod
    mul
    neg
    not
    or
    prepare_env
    return
    self_tail_call
    sub
    symbol_t
    tail_call
    test
