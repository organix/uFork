; HTTP static file server.

.import
    bind: "https://ufork.org/lib/rq/bind.asm"
    blob: "https://ufork.org/lib/blob.asm"
    dev: "https://ufork.org/lib/dev.asm"
    div_mod: "https://ufork.org/lib/div_mod.asm"
    http: "https://ufork.org/lib/http_data.asm"
    io: "https://ufork.org/lib/blob_io.asm"
    list: "https://ufork.org/lib/list.asm"
    peg: "https://ufork.org/lib/blob_peg.asm"
    std: "https://ufork.org/lib/std.asm"

petname:                    ; the bind address
    ref 0

chunk_size:
    ; ref 10                  ; 10B
    ; ref 8192                ; 8KB
    ; ref 65536               ; 64KB
    ref 1048576             ; 1MB

status_200:                 ; "HTTP/1.0 200 OK"
    pair_t 'H'
    pair_t 'T'
    pair_t 'T'
    pair_t 'P'
    pair_t '/'
    pair_t '1'
    pair_t '.'
    pair_t '0'
    pair_t ' '
    pair_t '2'
    pair_t '0'
    pair_t '0'
    pair_t ' '
    pair_t 'O'
    pair_t 'K'
    ref #nil

length_prefix:              ; "\r\nContent-Length: "
    pair_t '\r'
    pair_t '\n'
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
    ref #nil

type_prefix:                ; "\r\nContent-Type: "
    pair_t '\r'
    pair_t '\n'
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
    ref #nil

mime_html:                  ; "text/html"
    pair_t 't'
    pair_t 'e'
    pair_t 'x'
    pair_t 't'
    pair_t '/'
    pair_t 'h'
    pair_t 't'
    pair_t 'm'
    pair_t 'l'
    ref #nil

list_concat:                ; ( b a -- ab )
    roll -3                 ; k b a
    call list.rev           ; k b a'
    roll 2                  ; k a' b
    call list.rev_onto      ; k ab
    ref std.return_value

; Convert a positive fixnum to a list of base-10 digit-characters

num_to_dec:                 ; ( str +num -- char,char,...,str )
    roll -3                 ; k str n=+num
num_loop:                   ; k str n
    push 10                 ; k str n d=10
    call div_mod.udivmod    ; k str q r
    roll 3                  ; k q r str
    roll 2                  ; k q str r
    push '0'                ; k q str r '0'
    alu add                 ; k q str char=r+'0'
    pair 1                  ; k q str'=char,str
    roll 2                  ; k str' q
    dup 1                   ; k str' q q
    eq 0                    ; k str' q q==0
    if_not num_loop         ; k str' q
    drop 1                  ; k str'
    ref std.return_value

; pattern factories

;;  sp = ' '
new_sp_ptrn:                ; ( -- sp_ptrn )
    push ' '                ; k sp
    push peg.pred_eq        ; k sp pred_eq
    actor create            ; k pred=pred_eq.sp
    push peg.match_one      ; k pred match_one
    actor create            ; k sp_ptrn=match_one.pred
    ref std.return_value

;;  line = [^\n]* '\n'
new_line_ptrn:              ; ( -- line_ptrn )
    push #nil               ; k list=#nil

    push '\n'               ; k list nl
    push peg.pred_eq        ; k list nl pred_eq
    actor create            ; k list pred=pred_eq.nl
    push peg.match_one      ; k list pred match_one
    actor create            ; k list nl_ptrn=match_one.pred
    pair 1                  ; k list=nl_ptrn,list

    push '\n'               ; k list nl
    push peg.pred_eq        ; k list nl pred_eq
    actor create            ; k list pred=pred_eq.nl
    push peg.pred_not       ; k list pred pred_not
    actor create            ; k list not_pred=pred_not.pred
    push peg.match_one      ; k list not_pred match_one
    actor create            ; k list not_nl_ptrn=match_one.not_pred
    push peg.match_star     ; k list not_nl_ptrn match_star
    actor create            ; k list star_ptrn=match_star.not_nl_ptrn
    pair 1                  ; k list=star_ptrn,list

    push peg.match_seq      ; k list match_seq
    actor create            ; k line_ptrn=match_seq.list
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

;;  get = 'G' 'E' 'T' sp
new_get_ptrn:               ; ( -- get_ptrn )
    push #nil               ; k list=#nil
    call new_sp_ptrn        ; k list sp_ptrn
    pair 1                  ; k list=sp_ptrn,list

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

; Request handling stages.

spawn_handler:              ; blob_dev,fs_dev,debug_dev <- tcp_conn
    msg 0                   ; tcp_conn
    state 0                 ; tcp_conn state
    push handler            ; tcp_conn state handler
    actor create            ; tcp_conn handler.state
    ref std.send_msg

handler:                    ; blob_dev,fs_dev,debug_dev <- tcp_conn

; Respond to an HTTP request with the matching file. The request is read from
; the connection, the response is written to the connection which is then
; closed.

; Read the request into a virtual blob, using it to parse the request as it
; arrives. Note that the incoming stream remains open until the response is
; sent off, so we can't just wait for EOF before parsing.

    actor self              ; cb=SELF
    msg 0                   ; cb str=tcp_conn
    push #nil               ; cb str blob=#nil
    pair 2                  ; blob,str,cb
    push io.blobstr         ; blob,str,cb blobstr
    actor create            ; blob'=blobstr.blob,str,cb

; Become the virtual blob's callback.

    state 0                 ; blob' state
    msg 0                   ; blob' state tcp_conn
    pick 3                  ; blob' state tcp_conn blob'
    pair 2                  ; blob' state'=blob',tcp_conn,state
    push receive            ; blob' state' receive
    actor become            ; blob'

; Read from the connection to prime the pump.

    push #?                 ; blob' #?
    roll 2                  ; #? cb=blob'
    push #?                 ; #? cb can=#?
    pair 2                  ; read_req=can,cb,#?
    msg 0                   ; read_req tcp_conn
    ref std.send_msg

receive:                    ; blob,tcp_conn,blob_dev,fs_dev,debug_dev <- ok,value | #?
    msg 1                   ; ok
    eq #f                   ; ok==#f
    if receive_fail         ; --

; More bytes of the request have arrived. Check if we have the whole first line
; of the request (the Request-Line).

    state -1                ; state'=tcp_conn,blob_dev,fs_dev,debug_dev
    push parse_method       ; state' parse_method
    actor become            ; --
    state 1                 ; blob
    push 0                  ; blob ofs=0
    actor self              ; blob ofs cust=SELF
    pair 2                  ; cust,ofs,blob
    call new_line_ptrn      ; cust,ofs,blob line_ptrn
    ref std.send_msg

receive_fail:               ; _,_,_,_,debug_dev <- #f,reason
    msg 0                   ; #f,reason
    state -4                ; #f,reason debug_dev
    ref std.send_msg

parse_method:               ; tcp_conn,blob_dev,fs_dev,debug_dev <- base,len,blob

; Keep waiting if the Request-Line is not yet available.

    msg 1                   ; base
    typeq #fixnum_t         ; is_fixnum(base)
    if_not std.commit       ; --

; We have the Request-Line. Ignore future messages from the virtual blob.

    push #?                 ; _
    push std.sink_beh       ; _ sink_beh
    actor become            ; --

; Ensure that the request is a GET.

    msg -2                  ; blob
    push 0                  ; blob ofs=0
    state 0                 ; blob ofs state
    push parse_path         ; blob ofs state parse_path
    actor create            ; blob ofs cust=parse_path.state
    pair 2                  ; cust,ofs,blob
    call new_get_ptrn       ; cust,ofs,blob get_ptrn
    ref std.send_msg

parse_path:                 ; tcp_conn,blob_dev,fs_dev,debug_dev <- base,len,blob

; If the request was not a GET, fail.

    msg 1                   ; base
    typeq #fixnum_t         ; is_fixnum(base)
    if_not bad_request      ; --

; Match the path in the Request-Line.

    state 0                 ; state
    push get_file_meta      ; state get_file_meta
    actor become            ; --
    msg 0                   ; base,len,blob
    part 2                  ; blob len base
    alu add                 ; blob ofs=len+base
    actor self              ; blob ofs cust=SELF
    pair 2                  ; cust,ofs,blob
    call new_token_ptrn     ; cust,ofs,blob token_ptrn
    ref std.send_msg

get_file_meta:              ; tcp_conn,blob_dev,fs_dev,debug_dev <- base,len,blob

; If a path was not matched, fail.

    msg 1                   ; base
    typeq #fixnum_t         ; is_fixnum(base)
    if_not bad_request      ; --

; Slice the path from the request.

    msg 0                   ; base,len,blob
    push blob.slice         ; base,len,blob slice
    actor create            ; path=slice.base,len,blob

; Get the metadata of the file at the requested path.

    state 0                 ; path state
    pick 2                  ; path state path
    pair 1                  ; path state'=path,state
    push init_headers       ; path state' init_headers
    actor become            ; path
    push dev.fs_meta        ; path fs_meta
    actor self              ; path fs_meta cb=SELF
    push #?                 ; path fs_meta cb can=#?
    pair 3                  ; meta_req=can,cb,fs_meta,path
    state 3                 ; meta_req fs_dev
    ref std.send_msg

init_headers:               ; path,tcp_conn,blob_dev,fs_dev,debug_dev <- ok,value
    msg -1                  ; value
    typeq #dict_t           ; is_dict(value)
    if_not not_found        ; --

; The file exists and we know how big it is.

    msg -1                  ; metadata
    push dev.fs_size        ; metadata fs_size
    dict get                ; size
    ; dup 1                   ; size size
    ; state -4                ; size size debug_dev
    ; actor send              ; size

; Construct the headers. This is done in reverse to minimize unnecessary work
; during list concatenation.

    push http.blankln       ; size blankln
    roll 2                  ; blankln size
    call num_to_dec         ; head=size+blankln
    push length_prefix      ; head length_prefix
    call list_concat        ; head
    ; push mime_html          ; head mime_html
    ; call list_concat        ; head
    ; push type_prefix        ; head type_prefix
    ; call list_concat        ; head
    push status_200         ; head status_200
    call list_concat        ; head
    state 0                 ; head state
    push write_headers      ; head state write_headers
    actor become            ; list=head''
    actor self              ; list cust=SELF
    pair 1                  ; cust,list
    state 3                 ; cust,list blob_dev
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg

write_headers:              ; path,tcp_conn,blob_dev,fs_dev,debug_dev <- blob
    msg 0                   ; blob
    typeq #actor_t          ; is_cap(blob)
    if_not std.abort        ; -- // alloc failed
    state 0                 ; state
    push open_file          ; state open_file
    actor become            ; --
    msg 0                   ; blob
    actor self              ; blob cb=SELF
    push #?                 ; blob cb can=#?
    pair 2                  ; write_req=can,cb,blob
    state 2                 ; write_req tcp_conn
    ref std.send_msg

open_file:                  ; path,tcp_conn,blob_dev,fs_dev,debug_dev <- ok,value
    msg 1                   ; ok
    eq #t                   ; ok==#t
    if_not std.commit       ; -- // write failed, drop the connection
    state 0                 ; state
    push read_file          ; state read_file
    actor become            ; --
    push #f                 ; create=#f
    state 1                 ; create path
    push dev.fs_file        ; create path fs_file
    actor self              ; create path fs_file cb=SELF
    push #?                 ; create path fs_file cb can=#?
    pair 4                  ; file_req=can,cb,fs_file,path,create
    state 4                 ; file_req fs_dev
    ref std.send_msg

read_file:                  ; path,tcp_conn,blob_dev,fs_dev,debug_dev <- ok,value
    msg 1                   ; ok
    eq #t                   ; ok==#t
    if_not std.commit       ; -- // open failed, drop the connection
    state 0                 ; state
    push close_connection   ; state close_connection
    actor become            ; --
    msg -1                  ; requestor=file
    push chunk_size         ; requestor input=chunk_size
    pair 1                  ; input,requestor
    push bind.beh           ; input,requestor bind_beh
    actor create            ; in=bind_beh.input,requestor
    state 2                 ; in out=tcp_conn
    actor self              ; in out cb=SELF
    pair 2                  ; cb,out,in
    push io.stream_copy     ; cb,out,in stream_copy
    actor create            ; copier=stream_copy.cb,out,in
    push #?                 ; copier value=#?
    push #t                 ; copier value ok=#t
    pair 1                  ; copier ok,value
    roll 2                  ; ok,value copier
    ref std.send_msg

close_connection:           ; path,tcp_conn,blob_dev,fs_dev,debug_dev <- ok,value
    push #?                 ; _
    push std.sink_beh       ; _ sink_beh
    actor become            ; --
    push #nil               ; #nil
    actor self              ; #nil cb=SELF
    push #?                 ; #nil cb can=#?
    pair 2                  ; write_req=can,cb,#nil
    state 2                 ; write_req tcp_conn
    ref std.send_msg

; Pending proper error responses, we simply close the connection.

not_found:                  ; path,tcp_conn,fs_dev,debug_dev <- _
    state -1                ; tcp_conn,fs_dev,debug_dev
    push bad_request        ; tcp_conn,fs_dev,debug_dev bad_request
    actor become            ; --
    ref std.resend

bad_request:                ; tcp_conn,fs_dev,debug_dev <- _
    push #nil               ; #nil
    state -2                ; #nil cb=debug_dev
    push #?                 ; #nil cb can=#?
    pair 2                  ; close_req=can,cb,#nil
    state 1                 ; close_req tcp_conn
    ref std.send_msg

boot:                       ; _ <- {caps}

; Send a listen request to the TCP device.

    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; debug_dev
    msg 0                   ; debug_dev {caps}
    push dev.fs_key         ; debug_dev {caps} fs_key
    dict get                ; debug_dev fs_dev
    msg 0                   ; debug_dev fs_dev {caps}
    push dev.blob_key       ; debug_dev fs_dev {caps} blob_key
    dict get                ; debug_dev fs_dev blob_dev
    pair 2                  ; blob_dev,fs_dev,debug_dev
    push spawn_handler      ; blob_dev,fs_dev,debug_dev spawn_handler
    actor create            ; on_open=spawn_handler.blob_dev,fs_dev,debug_dev
    push petname            ; on_open petname
    push #?                 ; on_open petname #?
    push std.sink_beh       ; on_open petname #? sink_beh
    actor create            ; on_open petname cb=sink_beh.#?
    push #?                 ; on_open petname cb can=#?
    pair 3                  ; listen_req=can,cb,petname,on_open
    msg 0                   ; listen_req {caps}
    push dev.tcp_key        ; listen_req {caps} tcp_key
    dict get                ; listen_req tcp_dev
    ref std.send_msg

.export
    boot
