;;;
;;; Runtime support for compiled Scheme
;;;

.import
    std: "./std.asm"
    dev: "./dev.asm"
    referee: "./testing/referee.asm"

;
; Custom types and constants for Scheme
;

symbol_t:                   ; [symbol_t, name]
    type_t 1                ; [#type_t, 1]

closure_t:                  ; [closure_t, code, data]
    type_t 2                ; [#type_t, 2]

behavior_t:                 ; [behavior_t, code, data, meta]
    type_t 3                ; [#type_t, 3]

empty_env:                  ; (sp=() . env=())
    pair_t #nil #nil        ; (())

;
; Meta-actor creation and behavior replacement.
;

act_2:                      ; ( (beh . state) -- state beh )
    roll -2                 ; k (beh . state)
    quad -3                 ; k state beh type
    drop 1                  ; k state beh
    roll 3                  ; state beh k
    return                  ; state beh

act_3:                      ; ( [_, _, _, beh] -- state beh )
    roll -2                 ; k state=[_, _, _, beh]
    dup 1                   ; k state [_, _, _, beh]
    quad -4                 ; k state beh _ _ _
    drop 3                  ; k state beh
    roll 3                  ; state beh k
    return                  ; state beh

new_2:                      ; ( (beh . state) -- beh.state )
    roll -2                 ; k (beh . state)
    call act_2              ; k state beh
new_return:                 ; k state beh
    actor create            ; k beh.state
    roll 2                  ; beh.state k
    return                  ; beh.state

new_3:                      ; ( [_, _, _, beh] -- beh.[_, _, _, beh] )
    roll -2                 ; k state=[_, _, _, beh]
    call act_3              ; k state beh
    ref new_return

beh_2:                      ; ( (beh . state) -- )
    roll -2                 ; k (beh . state)
    call act_2              ; k state beh
beh_return:
    actor become            ; k
    return                  ; --

beh_3:                      ; ( [_, _, _, beh] -- )
    roll -2                 ; k state=[_, _, _, beh]
    call act_3              ; k state beh
    ref beh_return

;
; Continuations for non-tail function calls
;

; Function template for compiled lambda-closure
;func:                   ; [closure_t, code, data]
;    quad_3 closure_t code data
;code:                   ; (sp . env) <- (cust . args)
;    ...

; Prepare args for function call
;    push #nil           ; ()
;    push 3              ; () arg3
;    push 2              ; () arg3 arg2
;    push 1              ; () arg3 arg2 arg1
;    my self             ; () arg3 arg2 arg1 cust=SELF
;    pair nargs+1        ; args=(cust arg1 arg2 arg3)
;    push func           ; args closure
;    call new_2          ; args code.data
;    actor send          ; --

; Prefix to create/become continuation
;    pair -1             ; sp'=(...)
;    state -1            ; sp' env
;    push cont           ; sp' env cont
;    msg 0               ; sp' env cont msg
;    pair 3              ; (msg cont env . sp')
;    push continuation   ; (msg cont env . sp') continuation
;    actor become        ; -- SELF=continuation.(msg cont env . sp')
;    ref scm.commit

continuation:               ; (msg cont env . sp) <- rv
    state 3                 ; env
    state -3                ; env sp
    msg 0                   ; env sp rv
    pair 1                  ; env sp'=(rv . sp)
    pair 1                  ; (sp' . env)
    state 2                 ; (sp' . env) cont
    actor become            ; -- SELF=cont.(sp' . env)
    state 1                 ; msg
    my self                 ; msg SELF
    ref std.send_msg

; Suffix to restore stack and continue
;cont:                   ; (sp . env) <- (cust . args)
;    state 1             ; sp=(...)
;    part -1             ; ...
;    ref <k>

;
; meta-actor (from Scheme)
;

imm_actor:                  ; beh <- msg
    msg 0                   ; msg
    my self                 ; msg SELF
    pair 1                  ; (SELF . msg)
    state 0                 ; (SELF . msg) beh=[behavior_t, code, data, meta]
    call new_2              ; (SELF . msg) code.data
    ref std.send_msg

mut_actor:                  ; beh <- msg
    state 0                 ; beh=[behavior_t, code, data, meta]
    deque new               ; beh pending
    msg 0                   ; beh pending msg

txn_actor:                  ; beh pending msg
    ; begin transaction
    my self                 ; beh pending msg SELF
    pair 1                  ; beh pending (SELF . msg)
    pick 3                  ; beh pending (SELF . msg) beh
    call new_2              ; beh pending (SELF . msg) txn=code.data
    pick -3                 ; beh txn pending (SELF . msg) txn
    actor send              ; beh txn pending
    pair 2                  ; (pending txn . beh)
    push bsy_actor          ; (pending txn . beh) bsy_actor
    actor become            ; -- SELF=bsy_actor.(pending txn . beh)
    ref std.commit

bsy_actor:                  ; (pending txn . beh) <- (txn? . beh') | msg
    state 2                 ; txn
    msg 1                   ; txn txn?
    cmp eq                  ; txn==txn?
    if cmt_actor            ; --

    ; enqueue message for deferred processing
    state 0                 ; (pending txn . beh)
    part 1                  ; (txn . beh) pending
    msg 0                   ; (txn . beh) pending msg
    deque put               ; (txn . beh) pending'
    pair 1                  ; (pending' txn . beh)
    push bsy_actor          ; (pending' txn . beh) bsy_actor
    actor become            ; -- SELF=bsy_actor.(pending' txn . beh)
    ref std.commit

cmt_actor:                  ; --
    ; transaction complete
    msg -1                  ; beh'
    dup 1                   ; beh' beh'
    typeq behavior_t        ; beh' is_behavior(beh')
    if nxt_actor            ; beh'

    ; retain existing behavior
;    drop 1              ; -- (no need to drop this from the stack)
    state -2                ; beh'=beh

nxt_actor:                  ; beh'
    ; process next msg
    state 1                 ; beh' pending
    deque empty             ; beh' is_empty(pending)
    if rdy_actor            ; beh'

    ; check for new meta
    dup 1                   ; beh' beh'
    quad -4                 ; beh' Z Y X T
    drop 3                  ; beh' meta'=Z
    eq mut_actor            ; beh' meta'==mut_actor
    if_not rst_actor

    ; dequeue deferred msg
    state 1                 ; beh' pending
    deque pop               ; beh' pending' msg'
    ref txn_actor

rdy_actor:                  ; beh'
    ; no more deferred, become ready
    call beh_3              ; -- SELF=get_Z(beh').beh'
    ref std.commit

rst_actor:                  ; beh'
    ; reset entry-point (e.g.: transition to `imm_actor`)
    call beh_3              ; -- SELF=get_Z(beh').beh'
    state 1                 ; pending

rst_msgs:                   ; pending
    dup 1                   ; pending pending
    deque empty             ; is_empty(pending)
    if std.commit           ; pending
    deque pop               ; pending' msg'
    my self                 ; pending' msg' SELF
    actor send              ; pending'
    ref rst_msgs

;
; Unit-test suite
;

;;  (define count-beh
;;      (lambda (n)
;;          (BEH (cust)
;;              (SEND cust n)
;;              (BECOME (count-beh (+ n 1))) )))

count_0:                    ; [behavior_t, count_code, (#? 0), meta]
    quad_4 behavior_t count_code count_data mut_actor
count_data:
    pair_t #?
    pair_t 0
    ref #nil
count_code:                 ; (_ n) <- (self cust)
    state 2                 ; n
    msg 2                   ; n cust
    actor send              ; --
    push #nil               ; ()
    state 2                 ; () n
    push 1                  ; () n 1
    alu add                 ; () n+1
    state 1                 ; () n+1 _
    pair 2                  ; data=(_ n+1)
    push count_code         ; data code=count_code
    push mut_actor          ; data code meta=mut_actor
    roll -3                 ; meta data code
    push behavior_t         ; meta data code behavior_t
    quad 4                  ; beh'=[behavior_t, code, data, meta]
    my self                 ; beh' txn=SELF
    pair 1                  ; (txn . beh')
    msg 1                   ; (txn . beh') self
    ref std.send_msg

assert:                     ; expect <- actual
    state 0                 ; expect
    msg 0                   ; expect actual
    cmp eq                  ; expect==actual
    assert #t               ; assert(expect==actual)
    ref std.commit

;
; Boot code runs when the module is loaded (but not when imported).
;

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; referee=debug
    ref act
test:                       ; judge <- {caps}
    push #nil               ; ()
    push 1                  ; () 2nd=1
    push 0                  ; () 2nd 1st=0
    push 10                 ; () 2nd 1st probation=10ms
    msg 0                   ; () 2nd 1st probation {caps}
    push dev.timer_key      ; () 2nd 1st probation {caps} timer_key
    dict get                ; () 2nd 1st probation timer
    state 0                 ; () 2nd 1st probation timer judge
    pair 5                  ; (judge timer probation 1st 2nd)
    push referee.beh        ; (judge timer probation 1st 2nd) referee_beh
    actor create            ; referee=referee_beh.(judge timer probation 1st 2nd)
act:
    push #nil               ; referee ()
    roll 2                  ; () referee
    pair 1                  ; (referee)
    push count_0            ; (referee) beh=count_0
    call new_3              ; (referee) counter=get_Z(beh).beh
    dup 2                   ; (referee) counter (referee) counter
    actor send              ; (referee) counter
    actor send              ; --
    ref std.commit

.export
    beh_2
    beh_3
    new_2
    new_3
    symbol_t
    closure_t
    behavior_t
    empty_env
    continuation
    imm_actor
    mut_actor
    boot
    test
