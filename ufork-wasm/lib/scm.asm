;;;
;;; Runtime support for compiled Scheme
;;;

.import
    std: "./std.asm"
    dev: "./dev.asm"

;
; Custom types and constants for Scheme
;

symbol_t:               ; [#type_t, 1]
    type_t 1

closure_t:              ; [#type_t, 2]
    type_t 2

behavior_t:             ; [#type_t, 2]
    type_t 2

empty_env:              ; (sp=#nil . env=#nil) = (())
    pair_t #nil
    ref #nil

;
; Continuations for non-tail function calls
;

; Function template for compiled lambda-closure
;func:                   ; [closure_t, code, data]
;    quad_3 closure_t code data
;code:                   ; (sp . env) <- (cust . args)
;    ...

; Prepare args for function call
;    push 3              ; arg3
;    push 2              ; arg3 arg2
;    push 1              ; arg3 arg2 arg1
;    my self             ; args... cust=SELF
;    push func           ; args... cust closure
;    new -2              ; args... cust code.data
;    send 4              ; -- nargs+1

; Prefix to create/become continuation
;    pair -1             ; sp'=(...)
;    state -1            ; sp' env
;    push cont           ; sp' env cont
;    msg 0               ; sp' env cont msg
;    push continuation   ; sp' env cont msg continuation
;    beh 4               ; -- SELF=continuation.(msg cont env sp')
;    ref std.commit

continuation:           ; (msg cont env sp) <- rv
    state 3             ; env
    state 4             ; env sp
    msg 0               ; env sp rv
    pair 1              ; env sp'=(rv . sp)
    pair 1              ; (sp' . env)
    state 2             ; (sp' . env) cont
    beh -1              ; -- SELF=cont.(sp' . env)
    state 1             ; msg
    my self             ; msg SELF
    ref std.send_msg
;std.send_msg:
;    send -1
;std.commit:
;    end commit

; Suffix to restore stack and continue
;cont:                   ; (sp . env) <- (cust . args)
;    state 1             ; sp=(...)
;    part -1             ; ...
;    ref <k>

;
; meta-actor (from Scheme)
;

imm_actor:              ; beh <- msg
    msg 0               ; msg
    my self             ; msg SELF
    pair 1              ; (SELF . msg)
    state 0             ; (SELF . msg) beh=[behavior_t, code, data]
    new -2              ; (SELF . msg) code.data
    ref std.send_msg
;std.send_msg:
;    send -1
;std.commit:
;    end commit

mut_actor:              ; beh <- msg
    state 0             ; beh=[behavior_t, code, data]
    deque new           ; beh pending
    msg 0               ; beh pending msg

txn_actor:              ; beh pending msg
    ; begin transaction
    my self             ; beh pending msg SELF
    pair 1              ; beh pending (SELF . msg)
    pick 3              ; beh pending (SELF . msg) beh
    new -2              ; beh pending (SELF . msg) txn=code.data
    pick -3             ; beh txn pending (SELF . msg) txn
    send -1             ; beh txn pending
    push bsy_actor      ; beh txn pending bsy_actor
    beh 3               ; -- SELF=bsy_actor.(pending txn beh)
    ref std.commit
;std.commit:
;    end commit

bsy_actor:              ; (pending txn beh) <- (txn? . beh') | msg
    state 2             ; txn
    msg 1               ; txn txn?
    cmp eq              ; txn==txn?
    if cmt_actor        ; --

    ; enqueue message for deferred processing
    state 0             ; (pending txn beh)
    part 1              ; (txn beh) pending
    msg 0               ; (txn beh) pending msg
    deque put           ; (txn beh) pending'
    pair 1              ; (pending' txn beh)
    push bsy_actor      ; (pending' txn beh) bsy_actor
    beh -1              ; -- SELF=bsy_actor.(pending' txn beh)
    ref std.commit
;std.commit:
;    end commit

cmt_actor:              ; --
    ; transaction complete
    msg -1              ; beh'
    dup 1               ; beh' beh'
; FIXME: `typeq` should work on user-defined types!
;    typeq behavior_t    ; beh' is_behavior(beh')
;    if nxt_actor        ; beh'
    eq #nil             ; beh' beh'==#nil
    if_not nxt_actor    ; beh'

    ; retain existing behavior
;    drop 1              ; -- (no need to drop this from the stack)
    state 3             ; beh'=beh

nxt_actor:              ; beh'
    ; process next msg
    state 1             ; beh' pending
    deque empty         ; beh' is_empty(pending)
    if rdy_actor        ; beh'

    ; dequeue deferred msg
    state 1             ; beh' pending
    deque pop           ; beh' pending' msg'
    ref txn_actor

rdy_actor:              ; beh'
    ; no more deferred, become ready
    push mut_actor      ; beh' mut_actor
    beh -1              ; -- SELF=mut_actor.beh'
    ref std.commit
;std.commit:
;    end commit

;
; Unit-test suite
;

;;  (define count-beh
;;      (lambda (n)
;;          (BEH (cust)
;;              (SEND cust n)
;;              (BECOME (count-beh (+ n 1))) )))

count_0:                ; [behavior_t, count_beh, (#? 0)]
    quad_3 behavior_t count_beh
    pair_t #?
    pair_t 0
    ref #nil

count_beh:              ; (_ n) <- (self cust)
    state 2             ; n
    msg 2               ; n cust
    send -1             ; --
    push #nil           ; ()
    state 2             ; () n
    push 1              ; () n 1
    alu add             ; () n+1
    state 1             ; () n+1 _
    pair 2              ; data=(_ n+1)
    push count_beh      ; data code=count_beh
    push behavior_t     ; data code behavior_t
    quad 3              ; beh'=[behavior_t, code, data]
    my self             ; beh' txn=SELF
    pair 1              ; (txn . beh')
    msg 1               ; (txn . beh') self
    ref std.send_msg
;std.send_msg:
;    send -1
;std.commit:
;    end commit

assert:                 ; expect <- actual
    state 0             ; expect
    msg 0               ; expect actual
    cmp eq              ; expect==actual
    is_eq #t            ; assert(expect==actual)
    ref std.commit

;
; Boot code runs when the module is loaded (but not when imported).
;

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.debug_key  ; {caps} debug_key
    dict get            ; debug_dev

;
;   YOUR CODE GOES HERE
;

    push count_0        ; debug_dev count_0
    push mut_actor      ; debug_dev count_0 mut_actor
    new -1              ; debug_dev counter=mut_actor.count_0

    dup 2               ; debug_dev counter debug_dev counter
    send 1              ; debug_dev counter

    dup 2               ; debug_dev counter debug_dev counter
    send 1              ; debug_dev counter

    ref std.commit

.export
    boot
