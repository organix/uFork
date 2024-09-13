; Runtime support for compiled Humus.

.import
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
    roll 2                  ; closure k
    return

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
    return                  ; rv

; Tail calls are achieved by modifying the existing frame before jumping
; directly to the procedure or compiled closure code.

tail_call:                  ; k env procedure args
    roll -4                 ; args k env procedure
    roll 2                  ; args k procedure env
    drop 1                  ; args k procedure
    jump                    ; args k
self_tail_call:             ; k env env' code args
    roll -5                 ; args k env env' code
    roll 3                  ; args k env' code env
    drop 1                  ; args k env' code
    jump                    ; args k env'

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

; It first pushes the message onto the stack as 'args', then pushes std.commit
; onto the stack as 'k'. Finally it retrieves the closure from the actor's
; state and jumps to it.

; Use it with 'beh -1' or 'new -1', for example:

;   push closure            ; closure
;   push hum.closure_beh    ; closure closure_beh
;   beh -1                  ; actor=closure_beh.closure

closure_beh:                ; closure <- msg
    msg 0                   ; args=msg
    push std.commit         ; args k=std.commit
    state 0                 ; args k closure
    jump

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
    if std.return_t         ; k
    ref std.return_f

is_bool_pair:               ; value k
    roll -2                 ; k value=(head . tail)
    part 1                  ; k tail head
    call is_bool            ; k tail bool?(head)
    if_not drop_return_f    ; k tail
    call is_bool            ; k bool?(tail)
    if_not std.return_f     ; k
    ref std.return_t

boot:                       ; () <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; debug_dev
    push #t                 ; debug_dev #t
    call is_bool            ; debug_dev bool?
    pick 2                  ; bool? debug_dev
    send -1                 ; --
    ref std.commit

.export
    boot
    closure_beh
    is_bool
    is_bool_pair
    make_closure
    return
    self_tail_call
    tail_call
