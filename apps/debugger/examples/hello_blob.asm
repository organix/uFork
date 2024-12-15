; Demonstrate blob processing and adapters

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

;;  digit = [0-9]
digit:
    pair_t '0' '9'

;;  upper = [A-Z]
upper:
    pair_t 'A' 'Z'

;;  lower = [a-z]
lower:
    pair_t 'a' 'z'

;;  print = [!-~]
print:
    pair_t '!' '~'

;;  wsp = ' ' | '\t'
wsp:
    pair_t ' '
    pair_t '\t'
    ref #nil

;;  ctrl = [\x00-\x1F]
ctrl:
    pair_t 0 31

;;  blank = ' ' | ctrl | 127
blank:
    pair_t ' '
    pair_t ctrl
    pair_t 127
    ref #nil

;;; Example HTTP request
http_request:
;; GET / HTTP/1.0
    pair_t 'G'
    pair_t 'E'
    pair_t 'T'
    pair_t ' '
    pair_t '/'
    pair_t 'i'
    pair_t 'n'
    pair_t 'd'
    pair_t 'e'
    pair_t 'x'
    pair_t '.'
    pair_t 'h'
    pair_t 't'
    pair_t 'm'
    pair_t 'l'
    pair_t ' '
    pair_t 'H'
    pair_t 'T'
    pair_t 'T'
    pair_t 'P'
    pair_t '/'
    pair_t '1'
    pair_t '.'
    pair_t '0'
    pair_t '\r'
    pair_t '\n'
;; Host: localhost
    pair_t 'H'
    pair_t 'o'
    pair_t 's'
    pair_t 't'
    pair_t ':'
    pair_t ' '
    pair_t 'l'
    pair_t 'o'
    pair_t 'c'
    pair_t 'a'
    pair_t 'l'
    pair_t 'h'
    pair_t 'o'
    pair_t 's'
    pair_t 't'
blankln:
    pair_t '\r'
    pair_t '\n'
crlf:
    pair_t '\r'
nl:
    pair_t '\n'
    ref #nil

;;; Example HTTP response
http_response:
;; HTTP/1.0 404 Not Found
    pair_t 'H'
    pair_t 'T'
    pair_t 'T'
    pair_t 'P'
    pair_t '/'
    pair_t '1'
    pair_t '.'
    pair_t '0'
    pair_t ' '
    pair_t '4'
    pair_t '0'
    pair_t '4'
    pair_t ' '
    pair_t 'N'
    pair_t 'o'
    pair_t 't'
    pair_t ' '
    pair_t 'F'
    pair_t 'o'
    pair_t 'u'
    pair_t 'n'
    pair_t 'd'
    pair_t '\r'
    pair_t '\n'
;; Content-Type: text/plain
    pair_t 'C'
    pair_t 'o'
    pair_t 'n'
    pair_t 't'
    pair_t 'e'
    pair_t 'n'
    pair_t 't'
    pair_t '-'
    pair_t 'T'
    pair_t 'y'
    pair_t 'p'
    pair_t 'e'
    pair_t ':'
    pair_t ' '
    pair_t 't'
    pair_t 'e'
    pair_t 'x'
    pair_t 't'
    pair_t '/'
    pair_t 'p'
    pair_t 'l'
    pair_t 'a'
    pair_t 'i'
    pair_t 'n'
    pair_t '\r'
    pair_t '\n'
;; Content-Length: 11
    pair_t 'C'
    pair_t 'o'
    pair_t 'n'
    pair_t 't'
    pair_t 'e'
    pair_t 'n'
    pair_t 't'
    pair_t '-'
    pair_t 'L'
    pair_t 'e'
    pair_t 'n'
    pair_t 'g'
    pair_t 't'
    pair_t 'h'
    pair_t ':'
    pair_t ' '
    pair_t '1'
    pair_t '1'
    pair_t '\r'
    pair_t '\n'
;;
    pair_t '\r'
    pair_t '\n'
content:
;; Not Found
    pair_t 'N'
    pair_t 'o'
    pair_t 't'
    pair_t ' '
    pair_t 'F'
    pair_t 'o'
    pair_t 'u'
    pair_t 'n'
    pair_t 'd'
    pair_t '\r'
    pair_t '\n'
    ref #nil

list_len:                   ; ( list -- len )
    roll -2                 ; k list
    push 0                  ; k list len=0
list_len_loop:              ; k list len
    pick 2                  ; k list len list
    typeq #pair_t           ; k list len is_pair(list)
    if_not list_len_end     ; k list len
    push 1                  ; k list len 1
    alu add                 ; k list len+1
    roll 2                  ; k len+1 list
    nth -1                  ; k len+1 rest(list)
    roll 2                  ; k rest(list) len+1
    ref list_len_loop
list_len_end:               ; k list len
    roll 2                  ; k len list
    drop 1                  ; k len
    ref std.return_value

; initialized blob builder
; cust,list -> blob
blob_init:                  ; blob_dev <- cust,list
    msg -1                  ; list
    call list_len           ; len
    msg 0                   ; len cust,list
    push k_blob_init        ; len cust,list k_blob_init
    actor create            ; len k
    pair 1                  ; k,len
    state 0                 ; k,len blob_dev
    ref std.send_msg
k_blob_init:                ; cust,list <- blob
    state 0                 ; cust,list
    part 1                  ; list cust
    msg 0                   ; list cust blob
    push 0                  ; list cust blob ofs=0
    roll 4                  ; cust blob ofs list
    pair 3                  ; list,ofs,blob,cust
    push k_blob_copy        ; list,ofs,blob,cust k_blob_copy
    actor become            ; --
    push #t                 ; #t
    actor self              ; #t SELF
    ref std.send_msg
k_blob_copy:                ; list,ofs,blob,cust <- bool
    msg 0                   ; bool
    if_not k_blob_fail      ; --
    state 1                 ; list
    typeq #pair_t           ; is_pair(list)
    if_not k_blob_done      ; --
    state 1                 ; list
    part 1                  ; rest first
    state 2                 ; rest first ofs
    dup 1                   ; rest first ofs ofs
    push 1                  ; rest first ofs ofs 1
    alu add                 ; rest first ofs ofs+1
    roll -4                 ; ofs+1 rest first ofs
    actor self              ; ofs+1 rest first ofs SELF
    pair 2                  ; ofs+1 rest SELF,ofs,first
    state 3                 ; ofs+1 rest SELF,ofs,first blob
    actor send              ; ofs+1 rest
    state -2                ; ofs+1 rest blob,cust
    roll -3                 ; blob,cust ofs+1 rest
    pair 2                  ; rest,ofs+1,blob,cust
    push k_blob_copy        ; rest,ofs+1,blob,cust k_blob_copy
    actor become            ; --
    ref std.commit
k_blob_done:
    state 3                 ; blob
    state -3                ; blob cust
    ref std.send_msg
k_blob_fail:
    push #?                 ; #?
    state -3                ; #? cust
    ref std.send_msg

; blob interface to a blob sub-range
blob_slice:                 ; base,len,blob <- cust,req
    msg -1                  ; req
    eq #?                   ; req==#?
    if slice_size           ; --
    msg -1                  ; req
    typeq #fixnum_t         ; is_fix(req)
    if slice_read           ; --
    ref slice_write
    ; FIXME: handle unknown requests...

slice_size:
    state 2                 ; size=len
    ; FIXME: clamp to size of underlying blob...
    ref std.cust_send

slice_read:
    msg 0                   ; cust,ofs
    part 1                  ; ofs cust
    state 1                 ; ofs cust base
    roll 3                  ; cust base ofs
    alu add                 ; cust base+ofs
    roll -2                 ; base+ofs cust
    pair 1                  ; cust,base+ofs
    state -2                ; cust,base+ofs blob
    ref std.send_msg

slice_write:
    msg 0                   ; cust,ofs,value
    part 2                  ; value ofs cust
    state 1                 ; value ofs cust base
    roll 3                  ; value cust base ofs
    alu add                 ; value cust base+ofs
    roll -2                 ; value base+ofs cust
    pair 2                  ; cust,base+ofs,value
    state -2                ; cust,base+ofs,value blob
    ref std.send_msg

; blob interface to a concatenation of blobs
blob_concat:                ; (len,blob),...,#nil <- cust,req
    msg -1                  ; req
    eq #?                   ; req==#?
    if concat_size          ; --
    msg -1                  ; req
    typeq #fixnum_t         ; is_fix(req)
    if concat_read          ; --
    ref concat_write
    ; FIXME: handle unknown requests...

concat_size:
    push 0                  ; size=0
    state 0                 ; size list=(len,blob),...,#nil
concat_size_loop:           ; size list
    dup 1                   ; size list list
    typeq #pair_t           ; size list is_pair(list)
    if_not concat_size_done ; size list
    part 1                  ; size rest first
    part 1                  ; size rest blob len
    roll 4                  ; rest blob len size
    alu add                 ; rest blob len+size
    roll -3                 ; len+size rest blob
    drop 1                  ; len+size rest
    ref concat_size_loop
concat_size_done:           ; size list
    drop 1                  ; size
    ref std.cust_send

concat_read:
    msg 0                   ; cust,ofs
    part 1                  ; ofs cust
    state 0                 ; ofs cust list=(len,blob),...,#nil
concat_read_loop:           ; ofs cust list
    dup 1                   ; ofs cust list list
    typeq #pair_t           ; ofs cust list is_pair(list)
    if_not std.rv_undef     ; ofs cust list
    part 1                  ; ofs cust rest first
    part 1                  ; ofs cust rest blob len
    pick 5                  ; ofs cust rest blob len ofs
    pick 2                  ; ofs cust rest blob len ofs len
    cmp lt                  ; ofs cust rest blob len ofs<len
    if concat_read_done     ; ofs cust rest blob len
    roll 5                  ; cust rest blob len ofs
    roll 2                  ; cust rest blob ofs len
    alu sub                 ; cust rest blob ofs-len
    roll -4                 ; ofs-len cust rest blob
    drop 1                  ; ofs-len cust rest
    ref concat_read_loop
concat_read_done:           ; ofs cust rest blob len
    drop 1                  ; ofs cust rest blob
    roll -4                 ; blob ofs cust rest
    drop 1                  ; blob ofs cust
    pair 1                  ; blob cust,ofs
    roll 2                  ; cust,ofs blob
    ref std.send_msg

concat_write:
    msg 0                   ; cust,ofs,value
    part 2                  ; value ofs cust
    state 0                 ; value ofs cust list=(len,blob),...,#nil
concat_write_loop:          ; value ofs cust list
    dup 1                   ; value ofs cust list list
    typeq #pair_t           ; value ofs cust list is_pair(list)
    if_not std.rv_false     ; value ofs cust list
    part 1                  ; value ofs cust rest first
    part 1                  ; value ofs cust rest blob len
    pick 5                  ; value ofs cust rest blob len ofs
    pick 2                  ; value ofs cust rest blob len ofs len
    cmp lt                  ; value ofs cust rest blob len ofs<len
    if concat_write_done    ; value ofs cust rest blob len
    roll 5                  ; value cust rest blob len ofs
    roll 2                  ; value cust rest blob ofs len
    alu sub                 ; value cust rest blob ofs-len
    roll -4                 ; value ofs-len cust rest blob
    drop 1                  ; value ofs-len cust rest
    ref concat_write_loop
concat_write_done:          ; value ofs cust rest blob len
    drop 1                  ; value ofs cust rest blob
    roll -5                 ; blob value ofs cust rest
    drop 1                  ; blob value ofs cust
    pair 2                  ; blob cust,ofs,value
    roll 2                  ; cust,ofs,value blob
    ref std.send_msg

concat_len:                 ; ( (len,blob),...,#nil -- total )
    roll -2                 ; k blobs
    push 0                  ; k blobs total=0
concat_len_loop:            ; k blobs total
    pick 2                  ; k blobs total blobs
    typeq #pair_t           ; k blobs total is_pair(blobs)
    if_not concat_len_end   ; k blobs total
    roll 2                  ; k total blobs
    part 1                  ; k total rest first
    nth 1                   ; k total rest len
    roll 3                  ; k rest len total
    alu add                 ; k rest len+total
    ref concat_len_loop
concat_len_end:             ; k blobs total
    roll 2                  ; k total blobs
    drop 1                  ; k total
    ref std.return_value

; blob-i/o "connection" backed by byte-i/o stream
; stream-requestor interface to a blob
blob_conn:                  ; in,out <- can,cb,req | io,ok,value
    msg 1                   ; io
    state 1                 ; io in
    cmp eq                  ; io=in
    if conn_io_in
    msg 1                   ; io
    state -1                ; io out
    cmp eq                  ; io=out
    if conn_io_out
    msg -2                  ; req
    eq #?                   ; req==#?
    if conn_read            ; --
    msg -2                  ; req
    typeq #actor_t          ; is_blob(req)
    if conn_write           ; --
    msg -2                  ; req
    eq #nil                 ; req==#nil
    if conn_close           ; --
conn_read:
conn_write:
conn_close:
    push #?                 ; #?
    push #f                 ; #? #f
    pair 1                  ; #f,#?
    msg 2                   ; #f,#? cb
    ref std.send_msg
conn_io_in:
conn_io_out:
    ref std.commit
; copy stream `in` to stream `out`
; sending the final `result` to `cb`
;;str_copy:                   ; cb,out,in <- result
; stream-requestor interface to a blob
;;str_blob:                   ; wofs,rofs,blob <- can,cb,req | data,cb
; blob interface to a concatenation of blobs
;;blob_concat:                ; (len,blob),...,#nil <- cust,req
; blob interface to a blob sub-range
;;blob_slice:                 ; base,len,blob <- cust,req

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

;;  rws = [ \t]+
new_rws_ptrn:               ; ( -- rws_ptrn )
    push wsp                ; k set=wsp
    push pred_in            ; k set pred_in
    actor create            ; k wsp_pred=pred_in.set
    push match_one          ; k wsp_pred match_one
    actor create            ; k wsp_ptrn=match_one.pred
    call new_plus_ptrn      ; k rws_ptrn
    ref std.return_value

;;  crlf = '\r' '\n'
new_crlf_ptrn:              ; ( -- crlf_ptrn )
    push #nil               ; k list=#nil

    push '\n'               ; k list lf
    push pred_eq            ; k list lf pred_eq
    actor create            ; k list pred=pred_eq.lf
    push match_one          ; k list pred match_one
    actor create            ; k list lf_ptrn=match_one.pred
    pair 1                  ; k list=lf_ptrn,list

    push '\r'               ; k list cr
    push pred_eq            ; k list cr pred_eq
    actor create            ; k list pred=pred_eq.cr
    push match_one          ; k list pred match_one
    actor create            ; k list cr_ptrn=match_one.pred
    pair 1                  ; k list=cr_ptrn,list

    push match_seq          ; k list match_seq
    actor create            ; k crlf_ptrn=match_seq.list
    ref std.return_value

;;  token = print+
new_token_ptrn:             ; ( -- token_ptrn )
    push #nil               ; k #nil
    push print              ; k #nil print
    pair 1                  ; k set=print,#nil
    push pred_in            ; k set pred_in
    actor create            ; k print_pred=pred_in.set
    push match_one          ; k print_pred match_one
    actor create            ; k print_ptrn=match_one.pred
    call new_plus_ptrn      ; k token_ptrn
    ref std.return_value

;;  get = 'G' 'E' 'T' rws
new_get_ptrn:               ; ( -- get_ptrn )
    push #nil               ; k list=#nil
    call new_rws_ptrn       ; k list rws_ptrn
    pair 1                  ; k list=rws_ptrn,list

    push 'T'                ; k list 'T'
    push pred_eq            ; k list 'T' pred_eq
    actor create            ; k list pred=pred_eq.'T'
    push match_one          ; k list pred match_one
    actor create            ; k list T_ptrn=match_one.pred
    pair 1                  ; k list=T_ptrn,list

    push 'E'                ; k list 'E'
    push pred_eq            ; k list 'E' pred_eq
    actor create            ; k list pred=pred_eq.'E'
    push match_one          ; k list pred match_one
    actor create            ; k list E_ptrn=match_one.pred
    pair 1                  ; k list=E_ptrn,list

    push 'G'                ; k list 'G'
    push pred_eq            ; k list 'G' pred_eq
    actor create            ; k list pred=pred_eq.'G'
    push match_one          ; k list pred match_one
    actor create            ; k list G_ptrn=match_one.pred
    pair 1                  ; k list=G_ptrn,list

    push match_seq          ; k list match_seq
    actor create            ; k get_ptrn=match_seq.list
    ref std.return_value

;;  get = 'H' 'E' 'A' 'D' rws
new_head_ptrn:              ; ( -- head_ptrn )
    push #nil               ; k list=#nil
    call new_rws_ptrn       ; k list rws_ptrn
    pair 1                  ; k list=rws_ptrn,list

    push 'D'                ; k list 'D'
    push pred_eq            ; k list 'D' pred_eq
    actor create            ; k list pred=pred_eq.'D'
    push match_one          ; k list pred match_one
    actor create            ; k list D_ptrn=match_one.pred
    pair 1                  ; k list=D_ptrn,list

    push 'A'                ; k list 'A'
    push pred_eq            ; k list 'A' pred_eq
    actor create            ; k list pred=pred_eq.'A'
    push match_one          ; k list pred match_one
    actor create            ; k list A_ptrn=match_one.pred
    pair 1                  ; k list=A_ptrn,list

    push 'E'                ; k list 'E'
    push pred_eq            ; k list 'E' pred_eq
    actor create            ; k list pred=pred_eq.'E'
    push match_one          ; k list pred match_one
    actor create            ; k list E_ptrn=match_one.pred
    pair 1                  ; k list=E_ptrn,list

    push 'H'                ; k list 'H'
    push pred_eq            ; k list 'H' pred_eq
    actor create            ; k list pred=pred_eq.'H'
    push match_one          ; k list pred match_one
    actor create            ; k list H_ptrn=match_one.pred
    pair 1                  ; k list=H_ptrn,list

    push match_seq          ; k list match_seq
    actor create            ; k get_ptrn=match_seq.list
    ref std.return_value

; main program execution stages

demo:                       ; {caps} <- blob
    msg 0                   ; blob
    push 0                  ; blob ofs=0
    state 0                 ; blob ofs {caps}
    push get_path           ; blob ofs {caps} get_path
    actor create            ; blob ofs cust=get_path.{caps}
    pair 2                  ; cust,ofs,blob
    call new_get_ptrn       ; cust,ofs,blob ptrn
    ref std.send_msg

get_path:                   ; {caps} <- base,len,blob
    msg 0                   ; base,len,blob
    part 2                  ; blob len base
    alu add                 ; blob ofs=len+base
    state 0                 ; blob ofs {caps}
;    push get_rws            ; blob ofs {caps} get_rws
    push debug_out          ; blob ofs {caps} debug_out
    actor create            ; blob ofs cust=get_rws.{caps}
    pair 2                  ; cust,ofs,blob
    call new_token_ptrn     ; cust,ofs,blob ptrn
    ref std.send_msg

get_rws:                    ; {caps} <- base,len,blob
    msg 0                   ; base,len,blob
    part 2                  ; blob len base
    alu add                 ; blob ofs=len+base
    state 0                 ; blob ofs {caps}
    push debug_out          ; blob ofs {caps} debug_out
    actor create            ; blob ofs cust=debug_out.{caps}
    pair 2                  ; cust,ofs,blob
    call new_rws_ptrn       ; cust,ofs,blob ptrn
    ref std.send_msg

debug_out:                  ; {caps} <- msg
    msg 0                   ; msg
    state 0                 ; msg {caps}
    push dev.debug_key      ; msg {caps} debug_key
    dict get                ; msg cust=debug_dev
    ref std.send_msg

boot:                       ; _ <- {caps}
    push http_request       ; list=http_request
    msg 0                   ; list {caps}
    push demo               ; list {caps} demo
    actor create            ; list cust=demo.{caps}
    pair 1                  ; cust,list
    msg 0                   ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push blob_init          ; cust,list blob_dev blob_init
    actor create            ; cust,list blob_init.blob_dev
    ref std.send_msg

.export
    blob_init
    blob_slice
    blob_concat
    boot
