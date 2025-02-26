; A blob PEG pattern that matches a list of characters in order.
; See also blob_peg.asm.

.import
    blob: "https://ufork.org/lib/blob.asm"
    dev: "https://ufork.org/lib/dev.asm"
    list: "https://ufork.org/lib/list.asm"
    peg: "https://ufork.org/lib/blob_peg.asm"
    std: "https://ufork.org/lib/std.asm"

new_char_ptrn:              ; ( char -- char_ptrn )
    roll -2                 ; k char
    push peg.pred_eq        ; k char pred_eq
    actor create            ; k pred=pred_eq.char
    push peg.match_one      ; k pred match_one
    actor create            ; k char_ptrn=match_one.pred
    ref std.return_value

new:                        ; ( list -- string_ptrn )
    roll -2                 ; k list
    call list.rev           ; k revlist
    push #nil               ; k revlist ptrns=#nil
string_ptrn_loop:
    roll 2                  ; k ptrns revlist
    dup 1                   ; k ptrns revlist revlist
    typeq #pair_t           ; k ptrns revlist pair_t(revlist)
    if_not string_ptrn_done ; k ptrns revlist
    part 1                  ; k ptrns revlist' char
    call new_char_ptrn      ; k ptrns revlist' char_ptrn
    roll 3                  ; k revlist' char_ptrn ptrns
    roll 2                  ; k revlist' ptrns char_ptrn
    pair 1                  ; k revlist' ptrns'
    ref string_ptrn_loop
string_ptrn_done:           ; k ptrns revlist
    roll 2                  ; k revlist ptrns
    push peg.match_seq      ; k revlist ptrns match_seq
    actor create            ; k revlist seq_ptrn=match_seq.ptrns
    roll 2                  ; k seq_ptrn revlist
    drop 1                  ; k seq_ptrn
    ref std.return_value

abc:
    pair_t 'a'
    pair_t 'b'
    pair_t 'c'
    ref #nil

test:                       ; judge <- {caps}
    push abc                ; list="abc"
    state 0                 ; list judge
    push test_k             ; list judge test_k
    actor create            ; list cust=test_k.judge
    pair 1                  ; cust,list
    msg 0                   ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg
test_k:                     ; judge <- blob
    msg 0                   ; blob
    push 0                  ; blob ofs=0
    state 0                 ; blob ofs judge
    push test_k2            ; blob ofs judge test_k2
    actor create            ; blob ofs cust=test_k2.judge
    pair 2                  ; cust,ofs,blob
    push abc                ; cust,ofs,blob "abc"
    call new                ; cust,ofs,blob ptrn
    ref std.send_msg
test_k2:                    ; judge <- base,len,blob
    msg 1                   ; base
    assert 0                ; base==0!
    msg 2                   ; len
    assert 3                ; len==3!
    msg -2                  ; blob
    typeq #actor_t          ; is_cap(blob)
    assert #t               ; --
    push #t                 ; verdict=#t
    state 0                 ; verdict judge
    ref std.send_msg

.export
    new
    test
