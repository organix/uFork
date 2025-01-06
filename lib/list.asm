;
; #nil-terminated pair-list support routines
;

.import
    dev: "./dev.asm"
    std: "./std.asm"

len:                        ; ( list -- len )
    roll -2                 ; k list
    push 0                  ; k list len=0
len_loop:                   ; k list len
    pick 2                  ; k list len list
    typeq #pair_t           ; k list len is_pair(list)
    if_not len_end          ; k list len
    push 1                  ; k list len 1
    alu add                 ; k list len+1
    roll 2                  ; k len+1 list
    nth -1                  ; k len+1 rest(list)
    roll 2                  ; k rest(list) len+1
    ref len_loop
len_end:                    ; k list len
    roll 2                  ; k len list
    drop 1                  ; k len
    ref std.return_value

;   0-->[1,-1]-->[2,-2]-->[3,-3]--> ...
;        |        |        |
;        V        V        V
nth:                        ; ( list index -- item )
    roll -3                 ; k list index
    dup 1                   ; k list index index
    typeq #fixnum_t         ; k list index is_fix(index)
    if_not nth_fail         ; k list index
    dup 1                   ; k list index index
    eq 0                    ; k list index index==0
    if nth_rest             ; k list index
    dup 1                   ; k list index index
    push 0                  ; k list index index 0
    cmp lt                  ; k list index index<0
    if nth_neg              ; k list index
nth_pos:                    ; k list index
    roll 2                  ; k index list
    part 1                  ; k index rest first
    roll 3                  ; k rest first index
    push 1                  ; k rest first index 1
    alu sub                 ; k rest first index-1
    dup 1                   ; k rest first index-1 index-1
    eq 0                    ; k rest first index-1 index-1==0
    if nth_first            ; k rest first index-1
    roll 2                  ; k rest index-1 first
    drop 1                  ; k rest index-1
    ref nth_pos
nth_first:                  ; k rest first index-1
    roll 3                  ; k first index-1 rest
    drop 2                  ; k first
    ref std.return_value
nth_neg:                    ; k list index
    roll 2                  ; k index list
    nth -1                  ; k index rest
    roll 2                  ; k rest index
    push 1                  ; k rest index 1
    alu add                 ; k rest index+1
    dup 1                   ; k rest index+1 index+1
    eq 0                    ; k rest index+1 index+1==0
    if_not nth_neg          ; k rest index+1
nth_rest:                   ; k list index
    drop 1                  ; k list
    ref std.return_value
nth_fail:                   ; k list index
    drop 2                  ; k
    ref std.return_undef

rev:                        ; ( list -- rev )
    roll -2                 ; k list
    push #nil               ; k list last=#nil
    ref rev_loop

rev_onto:                   ; ( list last -- rev )
    roll -3                 ; k list last
rev_loop:                   ; k list last
    roll 2                  ; k last list
    dup 1                   ; k last list list
    typeq #pair_t           ; k last list is_pair(list)
    if_not rev_done         ; k last list
    part 1                  ; k last rest first
    roll 3                  ; k rest first last
    roll 2                  ; k rest last first
    pair 1                  ; k rest first,last
    ref rev_loop
rev_done:                   ; k last list
    drop 1                  ; k last
    ref std.return_value

; test fixtures

list_1_2_3:
    pair_t 1
list_2_3:
    pair_t 2
list_3:
    pair_t 3
    ref #nil

test_len:                   ; ( -- )
    push #nil               ; list=#nil
    call len                ; len=0
    assert 0                ; --

    push list_3             ; list=list_3
    call len                ; len=1
    assert 1                ; --

    push list_2_3           ; list=list_2_3
    call len                ; len=2
    assert 2                ; --

    push list_1_2_3         ; list=list_1_2_3
    call len                ; len=3
    assert 3                ; --

    push #?                 ; list=#nil
    call len                ; len=0
    assert 0                ; --

    return

test_nth:                   ; ( -- )
    push list_1_2_3         ; list=list_1_2_3
    push 0                  ; list index=0
    call nth                ; item
    assert list_1_2_3       ; --

    push list_1_2_3         ; list=list_1_2_3
    push 1                  ; list index=1
    call nth                ; item
    assert 1                ; --

    push list_1_2_3         ; list=list_1_2_3
    push -1                 ; list index=-1
    call nth                ; item
    assert list_2_3         ; --

    push list_1_2_3         ; list=list_1_2_3
    push 2                  ; list index=2
    call nth                ; item
    assert 2                ; --

    push list_1_2_3         ; list=list_1_2_3
    push -2                 ; list index=-2
    call nth                ; item
    assert list_3           ; --

    push list_1_2_3         ; list=list_1_2_3
    push 3                  ; list index=3
    call nth                ; item
    assert 3                ; --

    push list_1_2_3         ; list=list_1_2_3
    push -3                 ; list index=-3
    call nth                ; item
    assert #nil             ; --

    push list_1_2_3         ; list=list_1_2_3
    push 4                  ; list index=4
    call nth                ; item
    assert #?               ; --

    push list_1_2_3         ; list=list_1_2_3
    push -4                 ; list index=-4
    call nth                ; item
    assert #?               ; --

    return

test:                       ; judge <- {caps}
    call test_len           ; --
    call test_nth           ; --
    push #t                 ; verdict=#t
    state 0                 ; verdict judge
    actor send              ; --
    ref std.commit

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    dup 1                   ; {caps} {caps}
    push dev.debug_key      ; {caps} {caps} debug_key
    dict get                ; {caps} judge=debug_dev
    push test               ; {caps} judge test
    actor create            ; {caps} test.judge
    ref std.send_msg

.export
    len
    nth
    rev
    rev_onto
    test
    boot
