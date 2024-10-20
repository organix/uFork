;;;
;;; uFork ASM Playground
;;;
;;; This module contains a variety of uFork ASM code fragments
;;; that illustrate "interesting" behavior. Run the code in the
;;; debugger and single-step to observe the behavior.
;;;

.import
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"
;    lib: "https://ufork.org/lib/lib.asm"
;    asm: "https://ufork.org/lib/asm.asm"

; An infinite loop will consume cycles, but no memory or events.

loop_forever:
    dup 0 loop_forever

; Send yourself an incrementing number forever.

ticker:                     ; () <- n
    msg 0                   ; n
    push 1                  ; n 1
    alu add                 ; n+1
    my self                 ; n+1 SELF
    ref std.send_msg        ; --

; Send yourself two messages for each one received.

msg_bomb:                   ; () <- ()
    my self                 ; SELF
    send 0                  ; --
    my self                 ; SELF
    send 0                  ; --
    ref std.commit

; Create and activate two clones for each message received.

fork_bomb:                  ; () <- ()
    push fork_bomb          ; fork_bomb
    new 0                   ; fork_bomb.()
    send 0                  ; --
    push fork_bomb          ; fork_bomb
    new 0                   ; fork_bomb.()
    send 0                  ; --
    ref std.commit

; Count up to a specified `limit` (forever, if `limit==#?`).

count_to:                   ; (limit) <- count
    state 1                 ; limit
    typeq #fixnum_t         ; typeof(limit)==#fixnum_t
    if_not count_next       ; --
    msg 0                   ; count
    state 1                 ; count limit
    cmp ge                  ; count>=limit
    if std.commit           ; --
count_next:
    msg 0                   ; count
    push 1                  ; count 1
    alu add                 ; count+1
    my self                 ; count+1 SELF
    ref std.send_msg

;;; Hewitt Go/Stop "Unbounded Integer" Example
;
; Theorem. An Actor machine can perform computations that a no λ expression, nondeterministic Turing
; Machine or pure Logic Program can implement because there is an always-halting Actor machine that can
; compute an integer of unbounded size (cf. [Clinger 1981]) This can be accomplished using an Actor with a
; variable count that is initially 0 and a variable continue initially True. The computation is begun by
; concurrently sending two requests to the Actor machine: a stop request that will return an integer and a go
; request that will return Void. The Actor machine operates as follows: 1
;  • When a stop request is received, return count and set continue to False for the next request received.
;  • When a go request is received:
;    o If continue is True, increment count by 1, send this Actor machine a go request in a hole of the region
;      of mutual exclusion, and then return Void.
;    o If continue is False, return Void.

unbounded:                  ; num <- inc | cust
    msg 0                   ; msg
    typeq #actor_t          ; is_actor(msg)
    if ub_stop              ; --
    state 0                 ; num
    msg 0                   ; num inc
    dup 1                   ; num inc inc
    my self                 ; num inc inc SELF
    send -1                 ; num inc
    alu add                 ; num+inc
    push unbounded          ; num+inc unbounded
    beh -1                  ; --
    ref std.commit
ub_stop:                    ; --
    state 0                 ; num
    msg 0                   ; num cust
    send -1                 ; --
    push std.sink_beh       ; sink_beh
    beh 0                   ; --
    ref std.commit

; Boot code runs when the module is loaded (but not when imported).

try_me:                     ; (sp . env) <- (cust . args)
    state 0                 ; (sp . env)
    part -1                 ; ...
    state 1                 ; ... sp
    part -1                 ; ... ...
    end commit

boot:                       ; () <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} dev.debug_key
    dict get                ; debug_dev

;
;   YOUR CODE GOES HERE
;

    ; exercise shift and rotate instructions
    push 3                  ; debug_dev 3
    push 0                  ; debug_dev 3 0
    alu lsl                 ; debug_dev n
    assert 3                ; debug_dev assert(n==3)

    push 3                  ; debug_dev 3
    push 1                  ; debug_dev 3 1
    alu lsl                 ; debug_dev n
    assert 6                ; debug_dev assert(n==6)

    push 3                  ; debug_dev 3
    push -1                 ; debug_dev 3 -1
    alu lsl                 ; debug_dev n
    assert 1                ; debug_dev assert(n==1)

    push 16#40000000        ; debug_dev 16#40000000
    push 1                  ; debug_dev 16#40000000 1
    alu lsr                 ; debug_dev n
    assert 16#20000000      ; debug_dev assert(n==16#20000000)

    push 16#40000000        ; debug_dev 16#40000000
    push 1                  ; debug_dev 16#40000000 1
    alu asr                 ; debug_dev n
    assert 16#60000000      ; debug_dev assert(n==16#60000000)

    push 1                  ; debug_dev 1
    push -1                 ; debug_dev 1 -1
    alu rol                 ; debug_dev n
    assert 16#40000000      ; debug_dev assert(n==16#40000000)

    push 16#aBe11           ; debug_dev 16#aBe11
    push 16                 ; debug_dev 16#aBe11 16
    alu rol                 ; debug_dev n
    dup 1                   ; debug_dev n n
    assert 16#3e110015      ; debug_dev n assert(n==16#3e110015)
    push 16                 ; debug_dev n 16
    alu ror                 ; debug_dev m
    assert 16#aBe11         ; debug_dev assert(m==16#aBe11)

    if std.commit           ; -- early exit

    ; start "unbounded" counter
    dup 1                   ; debug_dev debug_dev
    push 0                  ; debug_dev debug_dev 0
    push unbounded          ; debug_dev debug_dev 0 unbounded
    new -1                  ; debug_dev debug_dev unbounded.0
    push 1                  ; debug_dev debug_dev unbounded.0 1
    pick 2                  ; debug_dev debug_dev unbounded.0 1 unbounded.0

    dup 2                   ; debug_dev debug_dev unbounded.0 1 unbounded.0 1 unbounded.0
    send -1                 ; debug_dev debug_dev unbounded.0 1 unbounded.0
    dup 2                   ; debug_dev debug_dev unbounded.0 1 unbounded.0 1 unbounded.0
    send -1                 ; debug_dev debug_dev unbounded.0 1 unbounded.0
    dup 2                   ; debug_dev debug_dev unbounded.0 1 unbounded.0 1 unbounded.0
    send -1                 ; debug_dev debug_dev unbounded.0 1 unbounded.0
    dup 2                   ; debug_dev debug_dev unbounded.0 1 unbounded.0 1 unbounded.0
    send -1                 ; debug_dev debug_dev unbounded.0 1 unbounded.0

    send -1                 ; debug_dev debug_dev unbounded.0
    send -1                 ; debug_dev
    if std.commit           ; -- early exit

    push 1                  ; debug_dev 1
    pick 2                  ; debug_dev 1 debug_dev
    send -1                 ; debug_dev
    push 2                  ; debug_dev 2
    pick 2                  ; debug_dev 1 debug_dev
    send -1                 ; debug_dev
    push 3                  ; debug_dev 3
    pick 2                  ; debug_dev 1 debug_dev
    send -1                 ; debug_dev
    if std.commit           ; -- early exit

;    push try_me         ; ... try_me
;    new 0               ; ... try_me.()
;    send 0              ; ...

    ; start counting forever
;    push count_to       ; ... count_to
;    new 0               ; ... count_to.()
;    send 0              ; ...

    ref std.commit

assert:                     ; expect <- actual
    state 0                 ; expect
    msg 0                   ; expect actual
    cmp eq                  ; expect==actual
    assert #t               ; assert(expect==actual)
    ref std.commit

.export
    boot
