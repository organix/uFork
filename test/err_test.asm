;
; Test error handling and recovery mechanisms
;

.import
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"

foo_t:
    type_t 1

list_1_2_3:                 ; 1,2,3
    pair_t 1
pair_2_3:                   ; 2,3
    pair_t 2 3

grow_stack:                 ; n
    dup 1                   ; n n
    push 1                  ; n n 1
    alu add                 ; n n+1
    ref grow_stack

no_mem_test:                ; ( -- [E_NO_MEM] )
    push 0                  ; n=0
    ref grow_stack

list_test:                  ; ( -- )
    push list_1_2_3         ; 1,2,3
    nth 0                   ; 1,2,3
    assert list_1_2_3       ; --

    push list_1_2_3         ; 1,2,3
    nth 1                   ; 1
    assert 1                ; --

    push list_1_2_3         ; 1,2,3
    nth -1                  ; 2,3
    assert pair_2_3         ; --

    push list_1_2_3         ; 1,2,3
    nth 2                   ; 2
    assert 2                ; --

    push list_1_2_3         ; 1,2,3
    nth -2                  ; 3
    assert 3                ; --

    push #t                 ; #t
    push list_1_2_3         ; #t 1,2,3
    nth 3                   ; #t #?
    assert #?               ; #t --
    assert #t               ; --

    push #t                 ; #t
    push list_1_2_3         ; #t 1,2,3
    nth -3                  ; #t #?
    assert #?               ; #t --
    assert #t               ; --

    push #t                 ; #t
    push list_1_2_3         ; #t 1,2,3
;    nth 32                 ; [E_BOUNDS]
    nth -32                 ; #t #?
    assert #?               ; #t --
    assert #t               ; --

    return

dict_test:                  ; ( -- )
    push #nil               ; #nil
    push 0                  ; #nil 0
    push #f                 ; #nil 0 #f
    dict set                ; {0:#f}
    push 1                  ; {0:#f} 1
    push #t                 ; {0:#f} 1 #t
    dict set                ; {1:t,0:#t}

    pick 1                  ; {1:t,0:#t} {1:t,0:#t}
    push 0                  ; {1:t,0:#t} {1:t,0:#t} 0
    dict has                ; {1:t,0:#t} #t
    assert #t               ; {1:t,0:#t}

    pick 1                  ; {1:t,0:#t} {1:t,0:#t}
    push 0                  ; {1:t,0:#t} {1:t,0:#t} 0
    dict get                ; {1:t,0:#t} #f
    assert #f               ; {1:t,0:#t}

    pick 1                  ; {1:t,0:#t} {1:t,0:#t}
    push -1                 ; {1:t,0:#t} {1:t,0:#t} -1
    dict get                ; {1:t,0:#t} #?
    assert #?               ; {1:t,0:#t}

    roll -10                ; --
    return

test:                       ; judge <- {caps}
;    assert #t               ; [E_ASSERT]
;    call no_mem_test        ; [E_NO_MEM]
;    if_not test_fail        ; --

stack_underflow_test:       ; --
    assert #?               ; --
;    assert #f               ; [E_ASSERT]

    typeq #fixnum_t         ; #f
    assert #f               ; --
    typeq foo_t             ; #f
    assert #f               ; --

    dup 0                   ; --
    drop 0                  ; --
    dup 1                   ; #?
    drop 1                  ; --
    dup 3                   ; #? #? #?
    drop 3                  ; --

    dict has                ; #f
    assert #f               ; --
    assert #?               ; --

;    if_not ignorable_test   ; --
    call list_test          ; --
    assert #?               ; --
    call dict_test          ; --
    assert #?               ; --

ignorable_test:
;    drop -1                 ; --
    quad_4 #instr_t 23 -1
;    drop -3                 ; --
    quad_4 #instr_t 23 -3
;    drop -32                ; --
    quad_4 #instr_t 23 -32

    eq #?                   ; #t
    assert #t               ; --

    push #t                 ; #t
    push 0                  ; #t 0
    push #nil               ; #t 0 #nil
    alu add                 ; #t #?
    assert #?               ; #t
    assert #t               ; --

    push #t                 ; #t
    push #nil               ; #t #nil
    push 1                  ; #t #nil 1
    alu add                 ; #t #?
    assert #?               ; #t
    assert #t               ; --

    push #t                 ; #t
    push 0                  ; #t 0
    push #nil               ; #t 0 #nil
    cmp lt                  ; #t #?
    assert #?               ; #t
    assert #t               ; --

bounds_test:                ; --
    drop 31                 ; --
;    drop 32                 ; [E_BOUNDS]
;    drop 33                 ; [E_BOUNDS]

;    drop -33                ; [E_BOUNDS]
;    quad_4 #instr_t 23 -33

not_fix_test:               ; --
;    dup #?                  ; [E_NOT_FIX]
;    quad_4 #instr_t 22 #?

no_type_test:               ; --
;    typeq 0                 ; [E_NO_TYPE]
;    quad_4 #instr_t 5 0

;    typeq #?                ; [E_NO_TYPE]
;    quad_4 #instr_t 5 #?

not_cap_test:               ; --
    push #t                 ; #t
    push #f                 ; #t #f
;    actor send              ; [E_NOT_CAP]
    drop 10                 ; --

test_pass:
    ; trivial case of test success
    push #t                 ; verdict=#t
    state 0                 ; verdict judge
    ref std.send_msg

test_fail:
    ; trivial case of test failure
    push #f                 ; verdict=#f
    state 0                 ; verdict judge
    ref std.send_msg

boot:                       ; _ <- {caps}
    call spn_test           ; --

    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; debug

    push boot_ctl           ; debug boot_ctl
    actor become            ; --
    ref std.commit

boot_ctl:                   ; debug <- msg
    msg 0                   ; msg
    typeq #sponsor_t        ; is_sponsor(msg)
    if boot_report          ; --

    msg 0                   ; msg
    state 0                 ; msg debug
    ref std.send_msg

boot_report:
    msg 0                   ; spn
    quad -4                 ; waiting signal quota type
    pick 2                  ; waiting signal quota type quota
    quad -3                 ; waiting signal quota type cycles events memory
    pair 2                  ; waiting signal quota type memory,events,cycles
    state 0                 ; waiting signal quota type memory,events,cycles debug
    actor send              ; waiting signal quota type

    pick 4                  ; waiting signal quota type waiting
    roll -5                 ; waiting waiting signal quota type
    pair 3                  ; waiting type,quota,signal,waiting
    state 0                 ; waiting type,quota,signal,waiting debug
    actor send              ; next=waiting

boot_dump:                  ; next
    dup 1                   ; next next
    eq #nil                 ; next next==#nil
    if boot_refill          ; next
    dup 1                   ; next next
    eq #?                   ; next next==#?
    if boot_refill          ; next

    quad -4                 ; next msg to sponsor
    pair 2                  ; next sponsor,to,msg
    state 0                 ; next sponsor,to,msg debug
    actor send              ; next
    ref boot_dump

boot_refill:
    msg 0                   ; spn
    quad -2                 ; quota type
    drop 1                  ; quota
    quad -3                 ; cycles events memory
    drop 2                  ; cycles
    push 0                  ; cycles 0
    cmp le                  ; cycles<=0
    if_not std.commit       ; --

    msg 0                   ; spn
    push 100                ; spn 100
    sponsor cycles          ; spn
    actor self              ; spn SELF
    sponsor start           ; --
    ref std.commit

spn_test:                   ; ( -- )
    sponsor new             ; spn
    push 100                ; spn 100
    sponsor memory          ; spn
    push 100                ; spn 100
    sponsor events          ; spn
    push 100                ; spn 100
    sponsor cycles          ; spn

    dup 1                   ; spn spn
    push 5                  ; spn spn 5
    push 0                  ; spn spn 5 0
    push hewitt_cnt         ; spn spn 5 0 hewitt_cnt
    actor create            ; spn spn 5 hewitt_cnt.0
    pick -3                 ; spn hewitt_cnt.0 spn 5 hewitt_cnt.0
    actor post              ; spn hewitt_cnt.0
    pick 2                  ; spn hewitt_cnt.0 spn
    push -2                 ; spn hewitt_cnt.0 spn -2
    roll 3                  ; spn spn -2 hewitt_cnt.0
    actor post              ; spn

    actor self              ; spn SELF
    sponsor start           ; --
    return

hewitt_cnt:                 ; cnt <- cust | inc
    msg 0                   ; msg
    typeq #actor_t          ; is_cap(msg)
    if hewitt_done          ; --
    state 0                 ; cnt
    msg 0                   ; cnt inc
    alu add                 ; cnt+inc
    push hewitt_cnt         ; cnt+inc hewitt_cnt
    actor become            ; --
    msg 0                   ; inc
    actor self              ; inc SELF
    ref std.send_msg
hewitt_done:                ; --
    state 0                 ; cnt
    msg 0                   ; cnt cust
    ref std.send_msg

.export
    boot
    test
