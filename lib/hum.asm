; Runtime support for compiled Humus.

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

push_op:
    ref 2
msg_op:
    ref 24

; A Humus closure is represented as an assembly procedure
; taking one argument and returning one value. A closure
; is created by prefixing some precompiled code with an
; instruction pushing the environment onto the stack.

make_closure:               ; code env k
    roll -3                 ; k code env
    push push_op            ; k code env push_op
    push #instr_t           ; k code env push_op #instr_t
    quad 4                  ; k closure
    roll -2                 ; closure k
    return

; At compile time, it is not always possible to discern the
; intended role of a closure. Will it be used as the behavior
; for an actor, or called as a procedure?

; Consequently, the compiled code for a closure needs enough
; flexibility to either handle a message or to be called
; as a procedure. Thus, compiled closure code expects a stack
; like

;   args k env

; where 'args' is the single argument, 'k' is the
; continuation to return to, and 'env' is the closure's
; environment. The code always ends with a 'return'
; instruction. Closures are clearly suitable for being
; called as procedures.

; When such a closure is provided as a behavior for an
; actor, it is dynamically prefixed with two instructions:

;   msg 0
;   push std.commit

; First, the message is pushed onto the stack as 'args',
; then std.commit is pushed onto the stack as 'k'. This
; augmented closure is now suitable to be used as an actor
; behavior directly.

make_beh:                   ; closure k
    roll -2                 ; k Z=closure
    push std.commit         ; k Z Y=std.commit
    push push_op            ; k Z Y X=push_op
    push #instr_t           ; k Z Y X T=#instr_t
    quad 4                  ; k Z=closure'
    push 0                  ; k Z Y=0
    push msg_op             ; k Z Y X=msg_op
    push #instr_t           ; k Z Y X T=#instr_t
    quad 4                  ; k beh
    roll -2                 ; beh k
    return

.export
    make_closure
    make_beh
