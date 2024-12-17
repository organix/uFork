; Demonstrate blob processing and adapters

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"
    blob: "https://ufork.org/lib/blob.asm"
    peg: "https://ufork.org/lib/blob_peg.asm"

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
    ref peg.crlf

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
    ref peg.crlf

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


; pattern factories

;;  rws = [ \t]+
new_rws_ptrn:               ; ( -- rws_ptrn )
    push peg.wsp            ; k set=wsp
    push peg.pred_in        ; k set pred_in
    actor create            ; k wsp_pred=pred_in.set
    push peg.match_one      ; k wsp_pred match_one
    actor create            ; k wsp_ptrn=match_one.pred
    call peg.new_plus_ptrn  ; k rws_ptrn
    ref std.return_value

;;  crlf = '\r' '\n'
new_crlf_ptrn:              ; ( -- crlf_ptrn )
    push #nil               ; k list=#nil

    push '\n'               ; k list lf
    push peg.pred_eq        ; k list lf pred_eq
    actor create            ; k list pred=pred_eq.lf
    push peg.match_one      ; k list pred match_one
    actor create            ; k list lf_ptrn=match_one.pred
    pair 1                  ; k list=lf_ptrn,list

    push '\r'               ; k list cr
    push peg.pred_eq        ; k list cr pred_eq
    actor create            ; k list pred=pred_eq.cr
    push peg.match_one      ; k list pred match_one
    actor create            ; k list cr_ptrn=match_one.pred
    pair 1                  ; k list=cr_ptrn,list

    push peg.match_seq      ; k list match_seq
    actor create            ; k crlf_ptrn=match_seq.list
    ref std.return_value

;;  token = print+
new_token_ptrn:             ; ( -- token_ptrn )
    push #nil               ; k #nil
    push peg.print_rng      ; k #nil print
    pair 1                  ; k set=print,#nil
    push peg.pred_in        ; k set pred_in
    actor create            ; k print_pred=pred_in.set
    push peg.match_one      ; k print_pred match_one
    actor create            ; k print_ptrn=match_one.pred
    call peg.new_plus_ptrn  ; k token_ptrn
    ref std.return_value

;;  get = 'G' 'E' 'T' rws
new_get_ptrn:               ; ( -- get_ptrn )
    push #nil               ; k list=#nil
    call new_rws_ptrn       ; k list rws_ptrn
    pair 1                  ; k list=rws_ptrn,list

    push 'T'                ; k list 'T'
    push peg.pred_eq        ; k list 'T' pred_eq
    actor create            ; k list pred=pred_eq.'T'
    push peg.match_one      ; k list pred match_one
    actor create            ; k list T_ptrn=match_one.pred
    pair 1                  ; k list=T_ptrn,list

    push 'E'                ; k list 'E'
    push peg.pred_eq        ; k list 'E' pred_eq
    actor create            ; k list pred=pred_eq.'E'
    push peg.match_one      ; k list pred match_one
    actor create            ; k list E_ptrn=match_one.pred
    pair 1                  ; k list=E_ptrn,list

    push 'G'                ; k list 'G'
    push peg.pred_eq        ; k list 'G' pred_eq
    actor create            ; k list pred=pred_eq.'G'
    push peg.match_one      ; k list pred match_one
    actor create            ; k list G_ptrn=match_one.pred
    pair 1                  ; k list=G_ptrn,list

    push peg.match_seq      ; k list match_seq
    actor create            ; k get_ptrn=match_seq.list
    ref std.return_value

;;  get = 'H' 'E' 'A' 'D' rws
new_head_ptrn:              ; ( -- head_ptrn )
    push #nil               ; k list=#nil
    call new_rws_ptrn       ; k list rws_ptrn
    pair 1                  ; k list=rws_ptrn,list

    push 'D'                ; k list 'D'
    push peg.pred_eq        ; k list 'D' pred_eq
    actor create            ; k list pred=pred_eq.'D'
    push peg.match_one      ; k list pred match_one
    actor create            ; k list D_ptrn=match_one.pred
    pair 1                  ; k list=D_ptrn,list

    push 'A'                ; k list 'A'
    push peg.pred_eq        ; k list 'A' pred_eq
    actor create            ; k list pred=pred_eq.'A'
    push peg.match_one      ; k list pred match_one
    actor create            ; k list A_ptrn=match_one.pred
    pair 1                  ; k list=A_ptrn,list

    push 'E'                ; k list 'E'
    push peg.pred_eq        ; k list 'E' pred_eq
    actor create            ; k list pred=pred_eq.'E'
    push peg.match_one      ; k list pred match_one
    actor create            ; k list E_ptrn=match_one.pred
    pair 1                  ; k list=E_ptrn,list

    push 'H'                ; k list 'H'
    push peg.pred_eq        ; k list 'H' pred_eq
    actor create            ; k list pred=pred_eq.'H'
    push peg.match_one      ; k list pred match_one
    actor create            ; k list H_ptrn=match_one.pred
    pair 1                  ; k list=H_ptrn,list

    push peg.match_seq      ; k list match_seq
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
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg

.export
    boot
