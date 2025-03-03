; A blob PEG pattern that performs a negative lookahead, written as ?! in regex.
; See also blob_peg.asm.

.import
    blob: "https://ufork.org/lib/blob.asm"
    dev: "https://ufork.org/lib/dev.asm"
    peg: "https://ufork.org/lib/blob_peg.asm"
    std: "https://ufork.org/lib/std.asm"

beh:
match_nla:                  ; ptrn <- cust,ofs,blob
    msg -1                  ; ofs,blob
    msg 1                   ; ofs,blob cust
    push k_check            ; ofs,blob cust k_check
    actor create            ; ofs,blob cust'=k_check.cust
    pair 1                  ; cust',ofs,blob
    state 0                 ; cust',ofs,blob ptrn
    ref std.send_msg
k_check:                    ; cust <- base,len,blob | #?,ofs,blob
    msg -2                  ; blob
    msg 1                   ; blob base
    eq #?                   ; blob base==#?
    if_not k_fail           ; blob
    push 0                  ; blob len=0
    msg 2                   ; blob len base=ofs
    pair 2                  ; base,len,blob
    state 0                 ; base,len,blob cust
    ref std.send_msg
k_fail:                     ; blob
    msg 1                   ; blob ofs=base
    push #?                 ; blob ofs #?
    pair 2                  ; #?,ofs,blob
    state 0                 ; #?,ofs,blob cust
    ref std.send_msg

new:                        ; ( ptrn -- nla_ptrn )
    roll -2                 ; k ptrn
    push beh                ; k ptrn beh
    actor create            ; k nla_ptrn=beh.ptrn
    ref std.return_value

; Test suite.

abc:
    pair_t 'a'
    pair_t 'b'
    pair_t 'c'
    ref #nil

new_b_ptrn:                 ; ( -- b_ptrn )
    push 'b'                ; char='b'
    push peg.pred_eq        ; char pred_eq
    actor create            ; pred=pred_eq.char
    push peg.match_one      ; pred match_one
    actor create            ; b_ptrn=match_one.pred
    ref std.return_value

test:                       ; judge <- {caps}
    push abc                ; list="abc"
    state 0                 ; list judge
    push test_no_match      ; list judge test_no_match
    actor create            ; list cust=test_no_match.judge
    pair 1                  ; cust,list
    msg 0                   ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg
test_no_match:              ; judge <- blob
    msg 0                   ; blob
    push 1                  ; blob ofs=1  // 'b' == 'b'
    state 0                 ; blob ofs judge
    push test_match         ; blob ofs judge test_match
    actor create            ; blob ofs cust=test_match.judge
    pair 2                  ; cust,ofs,blob
    call new_b_ptrn         ; cust,ofs,blob b_ptrn
    call new                ; cust,ofs,blob nla_ptrn
    ref std.send_msg
test_match:                 ; judge <- #?,ofs,blob
    msg 1                   ; base
    assert #?               ; base==#?!
    msg 2                   ; ofs
    assert 1                ; ofs==1!
    msg -2                  ; blob
    typeq #actor_t          ; is_cap(blob)
    assert #t               ; --
    msg -2                  ; blob
    push 2                  ; blob ofs=2  // 'b' != 'c'
    state 0                 ; blob ofs judge
    push test_done          ; blob ofs judge test_done
    actor create            ; blob ofs cust=test_done.judge
    pair 2                  ; cust,ofs,blob
    call new_b_ptrn         ; cust,ofs,blob b_ptrn
    call new                ; cust,ofs,blob nla_ptrn
    ref std.send_msg
test_done:                  ; judge <- base,len,blob
    msg 1                   ; base
    assert 2                ; base==2!
    msg 2                   ; len
    assert 0                ; len==0!
    msg -2                  ; blob
    typeq #actor_t          ; is_cap(blob)
    assert #t               ; --
    push #t                 ; verdict=#t
    state 0                 ; verdict judge
    ref std.send_msg

.export
    beh
    new
    test
