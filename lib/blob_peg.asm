;
; PEG parser support for Blobs
;

.import
    dev: "./dev.asm"
    std: "./std.asm"

;;  digit = [0-9]
digit_rng:
    pair_t '0' '9'

;;  upper = [A-Z]
upper_rng:
    pair_t 'A' 'Z'

;;  lower = [a-z]
lower_rng:
    pair_t 'a' 'z'

;;  print = [!-~]
print_rng:
    pair_t '!' '~'

;;  wsp = ' ' | '\t'
wsp:
    pair_t ' '
    pair_t '\t'
    ref #nil

;;  ctrl = [\x00-\x1F]
ctrl_rng:
    pair_t 0 31

;;  blank = ' ' | ctrl | 127
blank:
    pair_t ' '
    pair_t ctrl_rng
    pair_t 127
    ref #nil

; string endings
crlf:
    pair_t '\r'
nl:
    pair_t '\n'
    ref #nil

; predicate "function" actors

pred_any:                   ; _ <- cust,value
    ref std.rv_true

pred_none:                  ; _ <- cust,value
    ref std.rv_false

pred_eq:                    ; expect <- cust,actual
    state 0                 ; expect
    msg -1                  ; expect actual
    cmp eq                  ; expect==actual
    ref std.cust_send

pred_not:                   ; pred <- cust,value
    msg 0                   ; cust,value
    part 1                  ; value cust
    push k_pred_not         ; value cust k_pred_not
    actor create            ; value k=k_pred_not.cust
    pair 1                  ; k,value
    state 0                 ; k,value pred
    ref std.send_msg
k_pred_not:                 ; cust <- bool
    msg 0                   ; bool
    if k_not_true           ; --
    push #t                 ; #t
    state 0                 ; #t cust
    ref std.send_msg
k_not_true:                 ; --
    push #f                 ; #f
    state 0                 ; #f cust
    ref std.send_msg

pred_in:                    ; list <- cust,value
    state 0                 ; list
pred_in_loop:               ; list
    dup 1                   ; list list
    typeq #pair_t           ; list is_pair(list)
    if_not std.rv_false     ; list
    part 1                  ; rest first
    dup 1                   ; rest first first
    typeq #pair_t           ; rest first is_pair(first)
    if in_range             ; rest first
    msg -1                  ; rest first value
    cmp eq                  ; rest first==value
    if std.rv_true          ; rest
    ref pred_in_loop
in_range:                   ; rest lo,hi
    part 1                  ; rest hi lo
    msg -1                  ; rest hi lo value
    cmp le                  ; rest hi lo<=value
    if lo_range             ; rest hi
    drop 1                  ; rest
    ref pred_in_loop
lo_range:                   ; rest hi
    msg -1                  ; rest hi value
    cmp ge                  ; rest hi>=value
    if std.rv_true          ; rest
    ref pred_in_loop

; match a pattern in a blob
;   cust,ofs,blob -> base,len,blob | #?,ofs,blob
match_one:                  ; pred <- cust,ofs,blob
    msg 0                   ; cust,ofs,blob
    state 0                 ; cust,ofs,blob pred
    pair 1                  ; pred,cust,ofs,blob
    push k_pred_one         ; pred,cust,ofs,blob k_pred_one
    actor create            ; k=k_pred_one.pred,cust,ofs,blob
    msg 2                   ; k ofs
    roll 2                  ; ofs k
    pair 1                  ; k,ofs
    msg -2                  ; k,ofs blob
    ref std.send_msg
k_pred_one:                 ; pred,cust,ofs,blob <- value | #?
    msg 0                   ; value
    eq #?                   ; value==#?
    if k_fail_one           ; --
    msg 0                   ; value
    state 0                 ; value state=pred,cust,ofs,blob
    push k_match_one        ; value state k_match_one
    actor create            ; value k=k_match_one.state
    pair 1                  ; k,value
    state 1                 ; k,value pred
    ref std.send_msg
k_match_one:                ; pred,cust,ofs,blob <- #t | #f
    msg 0                   ; bool
    if_not k_fail_one       ; --
    state -3                ; blob
    push 1                  ; blob len=1
    state 3                 ; blob len base=ofs
    pair 2                  ; base,len,blob
    state 2                 ; base,len,blob cust
    ref std.send_msg
k_fail_one:                 ; --
    state -2                ; ofs,blob
    push #?                 ; ofs,blob #?
    pair 1                  ; #?,ofs,blob
    state 2                 ; #?,ofs,blob cust
    ref std.send_msg

; match a sequence of patterns in a blob
;   cust,ofs,blob -> base,len,blob | #?,ofs,blob
match_seq:                  ; list <- cust,ofs,blob
    state 0                 ; list
    typeq #pair_t           ; is_pair(list)
    if match_seq_pair       ; --
    msg -2                  ; blob
    push 0                  ; blob len=0
    msg 2                   ; blob len base=ofs
    pair 2                  ; base,len,blob
    ref std.cust_send
match_seq_pair:             ; --
    msg -1                  ; ofs,blob
    msg 0                   ; ofs,blob cust,ofs,blob
    state -1                ; ofs,blob cust,ofs,blob rest
    pair 1                  ; ofs,blob state=rest,cust,ofs,blob
    push k_first_seq        ; ofs,blob state k_first_seq
    actor create            ; ofs,blob k=k_first_seq.state
    pair 1                  ; k,ofs,blob
    state 1                 ; k,ofs,blob first
    ref std.send_msg
k_first_seq:                ; rest,cust,ofs,blob <- base,len,blob
    msg 1                   ; base
    eq #?                   ; base==#?
    if k_fail_seq           ; --
    state 0                 ; rest,cust,ofs,blob
    push k_rest_seq         ; rest,cust,ofs,blob k_rest_seq
    actor become            ; --
    msg 0                   ; base,len,blob
    part 2                  ; blob len base
    alu add                 ; blob ofs=len+base
    actor self              ; blob ofs cust=SELF
    pair 2                  ; cust,ofs,blob
    state 1                 ; cust,ofs,blob rest
    push match_seq          ; cust,ofs,blob rest match_seq
    actor create            ; cust,ofs,blob match_seq.rest
    ref std.send_msg
k_rest_seq:                 ; rest,cust,ofs,blob <- base,len,blob
    msg 1                   ; base
    eq #?                   ; base==#?
    if k_fail_seq           ; --
    msg 0                   ; base,len,blob
    part 2                  ; blob len base
    alu add                 ; blob ofs'=len+base
    state 3                 ; blob ofs' ofs
    alu sub                 ; blob len'=ofs'-ofs
    state 3                 ; blob len base=ofs
    pair 2                  ; base,len,ofs
    state 2                 ; base,len,ofs cust
    ref std.send_msg
k_fail_seq:                 ; --
    state -2                ; ofs,blob
    push #?                 ; ofs,blob #?
    pair 1                  ; #?,ofs,blob
    state 2                 ; #?,ofs,blob cust
    ref std.send_msg

; match a repeating pattern in a blob (Kleene star)
;   cust,ofs,blob -> base,len,blob | #?,ofs,blob
match_star:                 ; ptrn <- cust,ofs,blob
    msg 0                   ; cust,ofs,blob
    state 0                 ; cust,ofs,blob ptrn
    push 0                  ; cust,ofs,blob ptrn len=0
    pair 2                  ; len,ptrn,cust,ofs,blob
    push k_try_star         ; len,ptrn,cust,ofs,blob k_try_star
    actor create            ; k=k_try_star.len,ptrn,cust,ofs,blob
    msg -1                  ; k ofs,blob
    roll 2                  ; ofs,blob k
    pair 1                  ; k,ofs,blob
    state 0                 ; k,ofs,blob ptrn
    ref std.send_msg
k_try_star:                 ; len,ptrn,cust,ofs,blob <- base,len',blob
    msg 1                   ; base
    eq #?                   ; base==#?
    if k_done_star          ; --
    state 0                 ; len,ptrn,cust,ofs,blob
    part 1                  ; ptrn,cust,ofs,blob len
    msg 2                   ; ptrn,cust,ofs,blob len len'
    alu add                 ; ptrn,cust,ofs,blob len''=len+len'
    pair 1                  ; len'',ptrn,cust,ofs,blob
    push k_try_star         ; len'',ptrn,cust,ofs,blob k_try_star
    actor become            ; --
    msg 0                   ; base,len',blob
    part 2                  ; blob len' base
    alu add                 ; blob ofs=len'+base
    actor self              ; blob ofs k=SELF
    pair 2                  ; k,ofs,blob
    state 2                 ; k,ofs,blob ptrn
    ref std.send_msg
k_done_star:
    state -3                ; ofs,blob
    part 1                  ; blob base=ofs
    state 1                 ; blob base len
    roll -2                 ; blob len base
    pair 2                  ; base,len,blob
    state 3                 ; base,len,blob cust
    ref std.send_msg

; pattern factories

; match 1 or more repeats of a pattern
;;  ptrn+ = ptrn ptrn*
new_plus_ptrn:              ; ( ptrn -- ptrn+ )
    roll -2                 ; k ptrn

    push #nil               ; k ptrn list=#nil
    pick 2                  ; k ptrn list ptrn
    push match_star         ; k ptrn list ptrn match_star
    actor create            ; k ptrn list ptrn*=match_star.ptrn
    pair 1                  ; k ptrn list=ptrn*,list

    roll 2                  ; k list ptrn
    pair 1                  ; k list=ptrn,list

    push match_seq          ; k list match_seq
    actor create            ; k ptrn+=match_seq.list
    ref std.return_value

.export
    digit_rng
    upper_rng
    lower_rng
    print_rng
    wsp
    ctrl_rng
    blank
    crlf
    nl
    pred_any
    pred_none
    pred_eq
    pred_not
    pred_in
    match_one
    match_seq
    match_star
    new_plus_ptrn
