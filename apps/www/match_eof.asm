; A blob PEG pattern that matches the end of the blob (EOF).
; See also blob_peg.asm.

.import
    dev: "https://ufork.org/lib/dev.asm"
    peg: "https://ufork.org/lib/blob_peg.asm"
    std: "https://ufork.org/lib/std.asm"
    match_nla: "./match_nla.asm"

new:                        ; ( -- ptrn )
    push #?                 ; _
    push peg.pred_any       ; _ pred_any
    actor create            ; pred=pred_any._
    push peg.match_one      ; pred match_one
    actor create            ; ptrn=match_one.pred
    call match_nla.new      ; eof_ptrn
    ref std.return_value

test:                       ; judge <- {caps}
    push 3                  ; size=3
    state 0                 ; size judge
    push test_no_match      ; size judge test_no_match
    actor create            ; size cust=test_no_match.judge
    pair 1                  ; cust,size
    msg 0                   ; cust,size {caps}
    push dev.blob_key       ; cust,size {caps} blob_key
    dict get                ; cust,size blob_dev
    ref std.send_msg
test_no_match:              ; judge <- blob
    msg 0                   ; blob
    push 2                  ; blob ofs=2
    state 0                 ; blob ofs judge
    push test_match         ; blob ofs judge test_match
    actor create            ; blob ofs cust=test_match.judge
    pair 2                  ; cust,ofs,blob
    call new                ; cust,ofs,blob ptrn
    ref std.send_msg
test_match:                 ; judge <- #?,ofs,blob
    msg 1                   ; base
    assert #?               ; base==#?!
    msg 2                   ; ofs
    assert 2                ; ofs==2!
    msg -2                  ; blob
    typeq #actor_t          ; is_cap(blob)
    assert #t               ; --
    msg -2                  ; blob
    push 3                  ; blob ofs=3
    state 0                 ; blob ofs judge
    push test_done          ; blob ofs judge test_done
    actor create            ; blob ofs cust=test_done.judge
    pair 2                  ; cust,ofs,blob
    call new                ; cust,ofs,blob ptrn
    ref std.send_msg
test_done:                  ; judge <- base,len,blob
    msg 1                   ; base
    assert 3                ; base==3!
    msg 2                   ; len
    assert 0                ; len==0!
    msg -2                  ; blob
    typeq #actor_t          ; is_cap(blob)
    assert #t               ; --
    push #t                 ; verdict=#t
    state 0                 ; verdict judge
    ref std.send_msg

.export
    new
    test
