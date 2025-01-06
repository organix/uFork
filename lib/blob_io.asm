;
; Blob (binary large object) I/O streams
;

.import
    dev: "./dev.asm"
    std: "./std.asm"
    blob: "./blob.asm"

;
; input stream-requestor interface to a blob
;   cust,blob -> stream
;

reader_factory:             ; _ <- cust,blob
    msg 0                   ; cust,blob
    push k_reader_init      ; cust,blob k_reader_init
    actor create            ; k=k_reader_init.cust,blob
    msg -1                  ; k blob
    ref std.send_msg
k_reader_init:              ; cust,blob <- size
    state -1                ; blob
    msg 0                   ; blob size
    push 0                  ; blob size ofs=0
    pair 2                  ; ofs,size,blob
    push reader             ; ofs,size,blob reader
    actor become            ; --
    actor self              ; SELF
    state 1                 ; SELF cust
    ref std.send_msg

reader:                     ; ofs,size,blob <- can,cb,req | data,cb | (len,blob'),k
    msg 0                   ; msg
    typeq #pair_t           ; is_pair(msg)
    if_not std.abort        ; --
    msg 1                   ; (len,blob)
    typeq #pair_t           ; is_pair((len,blob))
    if reader_grow          ; --
    msg 1                   ; data
    typeq #fixnum_t         ; is_fix(data)
    if reader_ok            ; --
    msg 2                   ; cb
    typeq #actor_t          ; is_cap(cb)
    if_not std.abort        ; --
    msg -2                  ; req
    eq #?                   ; req==#?
    if reader_read          ; --
reader_fail:                ; --
    push #?                 ; #?
    push #f                 ; #? #f
    pair 1                  ; #f,#?
    msg 2                   ; #f,#? cb
    ref std.send_msg
reader_read:                ; --
    state 1                 ; ofs
    state 2                 ; ofs size
    cmp lt                  ; ofs<size
    if_not reader_end       ; --
    state 1                 ; ofs
    actor self              ; ofs SELF
    msg 2                   ; ofs SELF cb
    pair 1                  ; ofs cb,SELF
    push k_blob_r           ; ofs cb,SELF k_blob_r
    actor create            ; ofs cust=k_blob_r.cb,SELF
    pair 1                  ; cust,ofs
    state -2                ; cust,ofs blob
    ref std.send_msg
reader_end:                 ; --
    push #nil               ; #nil
    push #t                 ; #nil #t
    pair 1                  ; #t,#nil
    msg 2                   ; #t,#nil cb
    ref std.send_msg
reader_ok:                  ; --
    state 0                 ; ofs,size,blob
    part 1                  ; size,blob ofs
    push 1                  ; size,blob ofs 1
    alu add                 ; size,blob ofs+1
    pair 1                  ; state'=ofs+1,size,blob
    push reader             ; state' reader
    actor become            ; --
    msg 1                   ; data
    push #t                 ; data #t
    pair 1                  ; #t,data
    msg -1                  ; #t,data cb
    ref std.send_msg
reader_grow:                ; --
;    msg 0                   ; (len,blob'),k
    state 0                 ; ofs,size,blob
    part 2                  ; blob size ofs
    msg 1                   ; blob size ofs (len,blob')
    part 1                  ; blob size ofs blob' len
    roll 2                  ; blob size ofs len blob'
    roll 5                  ; size ofs len blob' blob
    pair 1                  ; size ofs len blob,blob'
    push blob.pair          ; size ofs len blob,blob' pair
    actor create            ; size ofs len blob''=pair.blob,blob'
    roll 2                  ; size ofs blob'' len
    roll 4                  ; ofs blob'' len size
    alu add                 ; ofs blob'' size'=len+size
    roll 3                  ; blob'' size'' ofs
    pair 2                  ; state'=ofs,size',blob''
    push reader             ; state' reader
    actor become            ; --
    actor self              ; SELF
    msg -1                  ; SELF k
    ref std.send_msg

k_blob_r:                   ; cb,stream <- byte | #?
    msg 0                   ; msg
    eq #?                   ; msg==#?
    if k_cb_fail k_cb_ok    ; --
k_blob_w:                   ; cb,stream <- #t | #f
    msg 0                   ; msg
    if k_cb_ok k_cb_fail    ; --
k_cb_ok:                    ; --
    state 1                 ; cb
    msg 0                   ; cb data
    pair 1                  ; data,cb
    state -1                ; data,cb stream
    ref std.send_msg
k_cb_fail:                  ; --
    msg 0                   ; msg
    push #f                 ; msg #f
    pair 1                  ; #f,msg
    state 1                 ; #f,msg cb
    ref std.send_msg

;
; output stream-requestor interface to an auto-allocated blob
;   cust,blk_size -> stream
;

writer_factory:             ; blob_dev <- cust,blk_size
    msg -1                  ; len=blk_size
    state 0                 ; len blob_dev
    msg 0                   ; len blob_dev cust,blk_size
    part 1                  ; len blob_dev blk_size cust
    pair 2                  ; len cust,blk_size,blob_dev
    push k_writer_init      ; len cust,blk_size,blob_dev k_writer_init
    actor create            ; len k=k_writer_init.cust,blk_size,blob_dev
    pair 1                  ; k,len
    state 0                 ; k,len blob_dev
    ref std.send_msg

k_writer_init:              ; cust,blk_size,blob_dev <- blob
    msg 0                   ; blob
    typeq #actor_t          ; is_cap(blob)
    if_not writer_init_fail ; --
    state -2                ; blob_dev
    msg 0                   ; blob_dev blob
    push wr_blob            ; blob_dev blob wr_blob
    actor create            ; blob_dev first=wr_blob.blob
    state 2                 ; blob_dev first size=blk_size
    pick 2                  ; blob_dev first size first
    push 0                  ; blob_dev first size first ofs=0
    pair 4                  ; ofs,first,size,first,blob_dev
    push writer             ; ofs,first,size,first,blob_dev writer
    actor become            ; --
    actor self              ; SELF
    state 1                 ; SELF cust
    ref std.send_msg
writer_init_fail:           ; --
    push #?                 ; #?
    state 1                 ; #? cust
    ref std.send_msg

wr_blob:                    ; blob <- cust,len | cust,next | cust,ofs,data
    msg 1                   ; cust
    typeq #actor_t          ; is_cap(cust)
    if_not std.abort        ; --
    msg -1                  ; req
    typeq #fixnum_t         ; is_fix(req)
    if wr_slice             ; --
    msg -1                  ; req
    typeq #actor_t          ; is_cap(req)
    if wr_pair              ; --
    msg -1                  ; req
    typeq #pair_t           ; is_pair(req)
    if_not std.abort        ; --
wr_write:                   ; write into blob
    msg 0                   ; cust,ofs,data
    state 0                 ; cust,ofs,data blob
    ref std.send_msg
wr_slice:                   ; convert to blob.slice
;    msg 0                   ; cust,len
    state 0                 ; blob
    msg -1                  ; blob len
    push 0                  ; blob len base=0
    pair 2                  ; base,len,blob
    push blob.slice         ; base,len,blob slice
    actor become            ; --
    actor self              ; SELF
    msg 1                   ; SELF cust
    ref std.send_msg
wr_pair:                    ; convert to blob.pair
;    msg 0                   ; cust,next
    msg -1                  ; tail=next
    state 0                 ; tail head=blob
    pair 1                  ; head,tail
    push blob.pair          ; head,tail pair
    actor become            ; --
    msg 0                   ; cust,next
    part 1                  ; next cust
    ref std.send_msg

writer:                     ; ofs,blob,size,blobs,blob_dev <- can,cb,req | ok,cb | (can,cb,req),blob''
    msg 0                   ; msg
    typeq #pair_t           ; is_pair(msg)
    if_not std.abort        ; --
    msg 1                   ; (can,cb,req)
    typeq #pair_t           ; is_pair((can,cb,req))
    if writer_grown         ; --
    msg -1                  ; cb
    typeq #actor_t          ; is_cap(cb)
    if writer_done          ; --
    msg -2                  ; req
    eq #?                   ; req==#?
    if writer_read          ; --
    msg -2                  ; req
    typeq #fixnum_t         ; is_fix(req)
    if writer_write         ; --
    ref std.abort

writer_read:                ; --
    state 1                 ; len=ofs
    state 4                 ; len blobs
    msg 2                   ; len blobs cb
    pair 1                  ; len cb,blobs
    push writer_stone       ; len cb,blobs writer_stone
    actor create            ; len cust=writer_stone.cb,blobs
    pair 1                  ; cust,len
    state 2                 ; cust,len blob
    ref std.send_msg
writer_stone:               ; cb,blobs <- slice
    state -1                ; blobs
    push #t                 ; blobs #t
    pair 1                  ; #t,blobs
    state 1                 ; #t,blobs cb
    ref std.send_msg

writer_write:               ; --
    state 1                 ; ofs
    state 3                 ; ofs size
    cmp lt                  ; ofs<size
    if_not writer_grow      ; --
    msg -2                  ; data
    state 1                 ; data ofs
    actor self              ; data ofs SELF
    msg 2                   ; data ofs SELF cb
    pair 1                  ; data ofs cb,SELF
    push k_blob_w           ; data ofs cb,SELF k_blob_w
    actor create            ; data ofs cust=k_blob_w.wr,cb
    pair 2                  ; cust,ofs,data
    state 2                 ; cust,ofs,data blob
    ref std.send_msg

writer_done:                ; --
    msg 1                   ; ok
    if writer_ok            ; --
    push #?                 ; #?
    push #f                 ; #? #f
    pair 1                  ; #f,#?
    msg -1                  ; #f,#? cb
    ref std.send_msg
writer_ok:                  ; --
    state 0                 ; ofs,blob,size,blobs,blob_dev
    part 1                  ; blob,size,blobs,blob_dev ofs
    push 1                  ; blob,size,blobs,blob_dev ofs 1
    alu add                 ; blob,size,blobs,blob_dev ofs+1
    pair 1                  ; ofs+1,blob,size,blobs,blob_dev
    push writer             ; ofs+1,blob,size,blobs,blob_dev writer
    actor become            ; --
    push #?                 ; #?
    push #t                 ; #? #t
    pair 1                  ; #t,#?
    msg -1                  ; #t,#? cb
    ref std.send_msg

writer_grow:                ; --
    state 3                 ; len=size
    state 0                 ; len state=ofs,blob,size,blobs,blob_dev
    msg 0                   ; len state msg=can,cb,req
    actor self              ; len state msg wr=SELF
    pair 2                  ; len wr,msg,state
    push k_writer_grow      ; len wr,msg,state k_writer_grow
    actor create            ; len k=k_writer_grow.wr,msg,state
    pair 1                  ; k,len
    state -4                ; k,len blob_dev
    ref std.send_msg
k_writer_grow:              ; wr,(can,cb,req),ofs,blob,size,blobs,blob_dev <- blob'
    msg 0                   ; blob'
    push wr_blob            ; blob' wr_blob
    actor create            ; next=wr_blob.blob'
    state 0                 ; next state
    push k_writer_grow2     ; next state k_writer_grow2
    actor create            ; next k=k_writer_grow2.state
    pair 1                  ; k,next
    state 4                 ; k,next blob
    ref std.send_msg
k_writer_grow2:             ; wr,(can,cb,req),ofs,blob,size,blobs,blob_dev <- blob''
    state 0                 ; wr,(can,cb,req),ofs,blob,size,blobs,blob_dev
    part 2                  ; ofs,blob,size,blobs,blob_dev (can,cb,req) wr
    msg 0                   ; ... (can,cb,req) wr blob''
    roll 3                  ; ... wr blob'' (can,cb,req)
    pair 1                  ; ... wr (can,cb,req),blob''
    roll 2                  ; ... (can,cb,req),blob'' wr
    ref std.send_msg

writer_grown:               ; --
    state -2                ; size,blobs,blob_dev
    msg -1                  ; size,blobs,blob_dev blob''
    push 0                  ; size,blobs,blob_dev blob'' ofs=0
    pair 2                  ; ofs,blob'',size,blobs,blob_dev
    push writer             ; ofs,blob'',size,blobs,blob_dev writer
    actor become            ; --
    msg 1                   ; (can,cb,req)
    actor self              ; (can,cb,req) SELF
    ref std.send_msg

;
; copy stream `in` to stream `out`
; sending the final `result` to `cb`
;

stream_copy:                ; cb,out,in <- result
    msg 1                   ; ok
    if_not stream_end       ; --

    msg -1                  ; value
    eq #nil                 ; value==#nil
    if stream_end           ; --

    msg -1                  ; value
    typeq #fixnum_t         ; is_fix(value)
    if stream_write         ; --

stream_read:                ; --
    push #?                 ; #?
    actor self              ; #? callback=SELF
    push #?                 ; #? callback to_cancel=#?
    pair 2                  ; req=to_cancel,callback,#?
    state -2                ; req in
    ref std.send_msg

stream_write:               ; --
    msg -1                  ; char
    actor self              ; char callback=SELF
    push #?                 ; char callback to_cancel=#?
    pair 2                  ; req=to_cancel,callback,char
    state 2                 ; req out
    ref std.send_msg

stream_end:                 ; --
    msg 0                   ; result
    state 1                 ; result cb
    ref std.send_msg

;
; blob interface to a blob-stream
;

blobstr:                    ; blob,str,cb <- ok,blob' | cust | cust,ofs | cust,ofs,data | base',len',cust
    msg 1                   ; ok
    eq #t                   ; ok==#t
    if blobstr_ok           ; --
    msg 1                   ; ok
    eq #f                   ; ok==#f
    if blobstr_done         ; --
    msg 0                   ; msg
    state 1                 ; msg blob
    ref std.send_msg
blobstr_ok:                 ; --
    msg -1                  ; blob'
    typeq #actor_t          ; is_cap(blob')
    if_not blobstr_done     ; --
    state 0                 ; blob,str,cb
    part 1                  ; str,cb blob
    dup 1                   ; str,cb blob blob
    typeq #actor_t          ; str,cb blob is_cap(blob)
    if blobstr_pair         ; str,cb blob
    drop 1                  ; str,cb
    msg -1                  ; str,cb blob'
    ref blobstr_update
blobstr_pair:               ; str,cb blob
    msg -1                  ; str,cb blob blob'
    roll 2                  ; str,cb blob' blob
    pair 1                  ; str,cb blob,blob'
    push blob.pair          ; str,cb blob,blob' pair
    actor create            ; str,cb blob''=pair.blob,blob'
blobstr_update:             ; str,cb blob''
    pair 1                  ; blob'',str,cb
    push blobstr            ; blob'',str,cb blobstr
    actor become            ; --
    push #?                 ; req=#?
    actor self              ; req cb=SELF
    push #?                 ; req cb can=#?
    pair 2                  ; can,cb,req
    state 2                 ; can,cb,req str
    ref std.send_msg
blobstr_done:               ; --
    state -2                ; cb
    typeq #actor_t          ; is_cap(cb)
    if_not std.commit       ; --
    msg 0                   ; ok,value
    state -2                ; ok,value cb
    ref std.send_msg

;
; read-stream of source-blobs
;

strsource:                  ; offset,size,blob <- can,cb,#? | (base,len,blob'),cb
    msg 1                   ; (base,len,blob')
    typeq #pair_t           ; is_pair((base,len,blob'))
    if strsource_result     ; --
    state 0                 ; offset,size,blob
    part 2                  ; blob size offset
    actor self              ; blob size offset SELF
    msg 2                   ; blob size offset SELF cb
    pair 1                  ; blob size offset cb,SELF
    push k_strsource        ; blob size offset cb,SELF k_strsource
    actor create            ; blob size offset cust=k_strsource.cb,SELF
    roll -3                 ; blob cust len=size base=offset
    pair 2                  ; blob base,len,cust
    roll 2                  ; base,len,cust blob
    ref std.send_msg
strsource_result:           ; --
    msg 1                   ; base,len,blob'
    nth 2                   ; len
    eq 0                    ; len==0
    if strsource_done       ; --
    state 0                 ; offset,size,blob
    part 1                  ; size,blob offset
    msg 1                   ; size,blob offset base,len,blob'
    nth 2                   ; size,blob offset len
    alu add                 ; size,blob offset+len
    pair 1                  ; offset+len,size,blob
    push strsource          ; offset+len,size,blob strsource
    actor become            ; --
    msg 1                   ; base,len,blob'
    push blob.slice         ; base,len,blob' slice
    actor create            ; blob''=slice.base,len,blob'
strsource_send:             ; blob''
    push #t                 ; blob'' #t
    pair 1                  ; #t,blob''
    msg -1                  ; #t,blob'' cb
    ref std.send_msg
strsource_done:             ; --
    push #nil               ; blob''=#nil
    ref strsource_send

k_strsource:                ; cb,str <- base,len,blob'
    state 1                 ; cb
    msg 0                   ; cb base,len,blob'
    pair 1                  ; (base,len,blob'),cb
    state -1                ; (base,len,blob'),cb str
    ref std.send_msg

;
; usage demonstration
;

;;; Example HTTP request
http_request:
;; GET /index.html HTTP/1.0
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
    ref #nil                ; size=26

http_req_hdrs:
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
    pair_t '\n'
    ref #nil                ; size=19

demo_blobstr:               ; {caps} <- blob
    state 0                 ; {caps}
    msg 0                   ; {caps} head=blob
    pair 1                  ; head,{caps}
    push k_demo_blobstr     ; head,{caps} demo=k_demo_blobstr
    actor become            ; --
;    msg 0                   ; tail=blob
;    actor self              ; tail SELF
;    ref std.send_msg
    push http_req_hdrs      ; list=http_req_hdrs
    actor self              ; list cust=SELF
    pair 1                  ; cust,list
    state 0                 ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg
k_demo_blobstr:             ; head,{caps} <- tail
    state -1                ; {caps}
    push k_demo_blobstr1    ; {caps} demo=k_demo_blobstr1
    actor become            ; --
    msg 0                   ; tail
    state 1                 ; tail head
    pair 1                  ; head,tail
    push blob.pair          ; head,tail pair
    actor create            ; blob=pair.head,tail
    actor self              ; blob SELF
    ref std.send_msg
k_demo_blobstr1:            ; {caps} <- blob
    actor self              ; cb=SELF
    msg 0                   ; cb blob
;    push 1024               ; cb blob size=1024
    push 10                 ; cb blob size=10
    push 0                  ; cb blob size offset=0
    pair 2                  ; cb offset,size,blob
    push strsource          ; cb offset,size,blob strsource
    actor create            ; cb str=strsource.offset,size,blob

    pick -2                 ; str cb str
    push #nil               ; str cb str blob=#nil
    pair 2                  ; str blob,str,cb
    push blobstr            ; str blob,str,cb blobstr
    actor create            ; str blob'=blobstr.blob,str,cb

    state 0                 ; str blob' {caps}
    pick 2                  ; str blob' {caps} blob'
    pair 1                  ; str blob' blob',{caps}
    push k_demo_blobstr2    ; str blob' blob',{caps} k_demo_blobstr2
    actor become            ; str blob'

    push #?                 ; str blob' req=#?
    roll 2                  ; str req cb=blob'
    push #?                 ; str req cb can=#?
    pair 2                  ; str can,cb,req
    roll 2                  ; can,cb,req str
    ref std.send_msg
k_demo_blobstr2:            ; blob',{caps} <- ok,value
    state -1                ; {caps}
    push k_demo_blobstr9    ; {caps} k_demo_blobstr9
    actor become            ; --
    state 1                 ; blob'
    actor self              ; blob' SELF
    ref std.send_msg
k_demo_blobstr9:            ; {caps} <- blob
    msg 0                   ; blob
    state 0                 ; blob {caps}
;    push demo_debug         ; blob {caps} demo=demo_debug
;    push demo_size          ; blob {caps} demo=demo_size
    push demo_print         ; blob {caps} demo=demo_print
;    push demo_source        ; blob {caps} demo=demo_source
    actor create            ; blob demo.{caps}
    ref std.send_msg

demo_strsource:             ; {caps} <- blob
    state 0                 ; {caps}
    msg 0                   ; {caps} head=blob
    pair 1                  ; head,{caps}
    push k_demo_strsource   ; head,{caps} demo=k_demo_strsource
    actor become            ; --
;    msg 0                   ; tail=blob
;    actor self              ; tail SELF
;    ref std.send_msg
    push http_req_hdrs      ; list=http_req_hdrs
    actor self              ; list cust=SELF
    pair 1                  ; cust,list
    state 0                 ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg
k_demo_strsource:           ; head,{caps} <- tail
    state -1                ; {caps}
    push k_demo_strsource1  ; {caps} demo=k_demo_strsource1
    actor become            ; --
    msg 0                   ; tail
    state 1                 ; tail head
    pair 1                  ; head,tail
    push blob.pair          ; head,tail pair
    actor create            ; blob=pair.head,tail
    actor self              ; blob SELF
    ref std.send_msg
k_demo_strsource1:          ; {caps} <- blob
    msg 0                   ; blob
;    push 1024               ; blob size=1024
    push 10                 ; blob size=10
    push 0                  ; blob size offset=0
    pair 2                  ; offset,size,blob
    push strsource          ; offset,size,blob strsource
    actor create            ; str=strsource.offset,size,blob
    push #?                 ; str req=#?
    state 0                 ; str req {caps}
    pick 3                  ; str req {caps} str
    pair 1                  ; str req str,{caps}
    push k_demo_strsource2  ; str req str,{caps} k_demo_strsource2
    actor create            ; str req cb=k_demo_strsource2.str,{caps}
    push #?                 ; str req cb can=#?
    pair 2                  ; str can,cb,req
    roll 2                  ; can,cb,req str
    ref std.send_msg
k_demo_strsource2:          ; str,{caps} <- ok,blob'
    msg 1                   ; ok
    eq #t                   ; ok==#t
    if_not k_demo_strsource3; --
    msg -1                  ; blob'
    typeq #actor_t          ; is_cap(blob')
    if_not k_demo_strsource3; --

    push #?                 ; req=#?
    actor self              ; req cb=SELF
    push #?                 ; req cb can=#?
    pair 2                  ; can,cb,req
    state 1                 ; can,cb,req str
    actor send              ; --

    msg -1                  ; blob'
    state -1                ; blob' {caps}
;    push demo_debug         ; blob' {caps} demo=demo_debug
;    push demo_size          ; blob' {caps} demo=demo_size
;    push demo_print         ; blob' {caps} demo=demo_print -- CAUTION: scrambled output
    push demo_source        ; blob' {caps} demo=demo_source
    actor create            ; blob' demo.{caps}
    ref std.send_msg
k_demo_strsource3:          ; --
    msg 0                   ; ok,blob'
    state -1                ; ok,blob' {caps}
    push dev.debug_key      ; ok,blob' {caps} debug_key
    dict get                ; ok,blob' debug_dev
    ref std.send_msg

demo_writer:                ; {caps} <- blob
    msg 0                   ; blob
    state 0                 ; blob {caps}
    push k_demo_writer      ; blob {caps} k_demo_writer
    actor create            ; blob cust=k_demo_print.{caps}
    pair 1                  ; cust,blob
    push #?                 ; cust,blob #?
    push reader_factory     ; cust,blob #? reader_factory
    actor create            ; cust,blob reader_factory._
    ref std.send_msg
k_demo_writer:              ; {caps} <- in
    state 0                 ; {caps}
    msg 0                   ; {caps} in
    pair 1                  ; in,{caps}
    push k_demo_writer2     ; in,{caps} k_demo_writer2
    actor become            ; --

    push 10                 ; blk_size=10
;    push 7                  ; blk_size=7
    actor self              ; blk_size cust=SELF
    pair 1                  ; cust,blk_size

    state 0                 ; cust,blk_size {caps}
    push dev.blob_key       ; cust,blk_size {caps} blob_key
    dict get                ; cust,blk_size blob_dev
    push writer_factory     ; cust,blk_size blob_dev writer_factory
    actor create            ; cust,blk_size writer_factory.blob_dev
    ref std.send_msg
k_demo_writer2:             ; in,{caps} <- out
    state -1                ; {caps}
    msg 0                   ; {caps} out
    pair 1                  ; out,{caps}
    push k_demo_writer3     ; out,{caps} k_demo_writer3
    actor become            ; --

    state 1                 ; in
    msg 0                   ; in out
    actor self              ; in out cb=SELF
    pair 2                  ; cb,out,in
    push stream_copy        ; cb,out,in stream_copy
    actor create            ; tgt=stream_copy.cb,out,in
    ref tgt_start
k_demo_writer3:             ; out,{caps} <- result
    state -1                ; {caps}
    push k_demo_writer4     ; {caps} k_demo_writer4
    actor become            ; --

    push #?                 ; #?
    actor self              ; #? cb=SELF
    push #?                 ; #? cb can=#?
    pair 2                  ; can,cb,#?
    state 1                 ; can,cb,#? out
    ref std.send_msg
k_demo_writer4:           ; {caps} <- result
    state 0                 ; {caps}
;    push demo_debug         ; {caps} demo=demo_debug
;    push demo_size          ; {caps} demo=demo_size
    push demo_print         ; {caps} demo=demo_print
;    push demo_source        ; {caps} demo=demo_source
    actor become            ; --

    msg -1                  ; blob
    actor self              ; blob SELF
    ref std.send_msg

demo_composite:             ; {caps} <- blob
    state 0                 ; {caps}
    push k_demo_composite   ; {caps} demo=k_demo_composite
    actor become            ; --

    msg 0                   ; blob
    push 2                  ; blob len=2
    push 24                 ; blob len base=24
    pair 2                  ; base,len,blob
    push blob.slice         ; base,len,blob slice
    actor create            ; tail=slice.base,len,blob

    msg 0                   ; tail blob
    push 11                 ; tail blob len=11
    push 4                  ; tail blob len base=4
    pair 2                  ; tail base,len,blob
    push blob.slice         ; tail base,len,blob slice
    actor create            ; tail head=slice.base,len,blob

    pair 1                  ; head,tail
    push blob.pair          ; head,tail pair
    actor create            ; blob=pair.head,tail

    actor self              ; blob SELF
    ref std.send_msg
k_demo_composite:           ; {caps} <- blob
    state 0                 ; {caps}
;    push demo_size          ; {caps} demo=demo_size
;    push demo_print         ; {caps} demo=demo_print
    push demo_source        ; {caps} demo=demo_source
    actor become            ; --
    msg 0                   ; blob
    actor self              ; blob SELF
    ref std.send_msg

demo_pair:                  ; {caps} <- blob
    state 0                 ; {caps}
    msg 0                   ; {caps} head=blob
    pair 1                  ; head,{caps}
    push k_demo_pair        ; head,{caps} demo=k_demo_pair
    actor become            ; --
demo_pair_aliased:
;    msg 0                   ; tail=blob
;    actor self              ; tail SELF
;    ref std.send_msg
demo_pair_composed:
    push http_req_hdrs      ; list=http_req_hdrs
    actor self              ; list cust=SELF
    pair 1                  ; cust,list
    state 0                 ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg
k_demo_pair:                ; head,{caps} <- tail
    state -1                ; {caps}
    push k_demo_pair1       ; {caps} demo=k_demo_pair1
    actor become            ; --
    msg 0                   ; tail
    state 1                 ; tail head
    pair 1                  ; head,tail
    push blob.pair          ; head,tail pair
    actor create            ; blob=pair.head,tail
    actor self              ; blob SELF
    ref std.send_msg
k_demo_pair1:               ; {caps} <- blob
    state 0                 ; {caps}
    msg 0                   ; {caps} blob
    pair 1                  ; blob,{caps}
    push k_demo_pair2       ; blob,{caps} demo=k_demo_pair2
    actor become            ; --
    push '1'                ; data='1'
    push 49                 ; data ofs=49
    actor self              ; data ofs cust=SELF
    pair 2                  ; cust,ofs,data
    msg 0                   ; cust,ofs,data blob
    ref std.send_msg
k_demo_pair2:               ; blob,{caps} <- wr_ok
    state 0                 ; blob,{caps}
    push k_demo_pair3       ; blob,{caps} demo=k_demo_pair3
    actor become            ; --
    push '\t'               ; data='\t'
    push 3                  ; data ofs=3
    actor self              ; data ofs cust=SELF
    pair 2                  ; cust,ofs,data
    state 1                 ; cust,ofs,data blob
    ref std.send_msg
k_demo_pair3:               ; blob,{caps} <- wr_ok
    state -1                ; {caps}
;    push demo_size          ; {caps} demo=demo_size
    push demo_print         ; {caps} demo=demo_print
;    push demo_source        ; {caps} demo=demo_source
    actor become            ; --
    state 1                 ; blob
    actor self              ; blob SELF
    ref std.send_msg

demo_slice:                 ; {caps} <- blob
    state 0                 ; {caps}
;    push demo_size          ; {caps} demo=demo_size
    push demo_print         ; {caps} demo=demo_print
;    push demo_source        ; {caps} demo=demo_source
    actor become            ; --
    msg 0                   ; blob
    push 11                 ; blob len=11
    push 4                  ; blob len base=4
    pair 2                  ; base,len,blob
    push blob.slice         ; base,len,blob slice
    actor create            ; blob=slice.base,len,blob
    actor self              ; blob SELF
    ref std.send_msg

demo_debug:                 ; {caps} <- blob
    msg 0                   ; blob
    state 0                 ; blob {caps}
    push dev.debug_key      ; blob {caps} debug_key
    dict get                ; blob debug_dev
    ref std.send_msg

demo_size:                  ; {caps} <- blob
    state 0                 ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; cust=debug_dev
    msg 0                   ; debug_dev blob
    ref std.send_msg

demo_print:                 ; {caps} <- blob
    msg 0                   ; blob
    state 0                 ; blob {caps}
    push k_demo_print       ; blob {caps} k_demo_print
    actor create            ; blob cust=k_demo_print.{caps}
    pair 1                  ; cust,blob
    push #?                 ; cust,blob #?
    push reader_factory     ; cust,blob #? reader_factory
    actor create            ; cust,blob reader_factory._
    ref std.send_msg
k_demo_print:               ; {caps} <- in
    msg 0                   ; in
    state 0                 ; in {caps}
    push dev.io_key         ; in {caps} io_key
    dict get                ; in out=io_dev
    state 0                 ; in out {caps}
    push dev.debug_key      ; in out {caps} debug_key
    dict get                ; in out cb=debug_dev
    pair 2                  ; cb,out,in
    push stream_copy        ; cb,out,in stream_copy
    actor create            ; tgt=stream_copy.cb,out,in
tgt_start:                  ; tgt
    push #?                 ; tgt value=#?
    push #t                 ; tgt #? ok=#t
    pair 1                  ; tgt result=ok,value
    roll 2                  ; result tgt
    ref std.send_msg

demo_source:                ; {caps} <- blob
    state 0                 ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; cust=debug_dev
    push 4096               ; cust len=4096
;    push 13                 ; cust len=13
    push 0                  ; cust len base=0
;    push 7                  ; cust len base=7
;    push 42                 ; cust len base=42
    pair 2                  ; base,len,cust
    msg 0                   ; base,len,cust blob
    ref std.send_msg

boot:                       ; _ <- {caps}
    push http_request       ; list=http_request
    msg 0                   ; list {caps}
;    push demo_debug         ; list {caps} demo=demo_debug
;    push demo_size          ; list {caps} demo=demo_size
;    push demo_print         ; list {caps} demo=demo_print
;    push demo_source        ; list {caps} demo=demo_source
;    push demo_slice         ; list {caps} demo=demo_slice
;    push demo_pair          ; list {caps} demo=demo_pair
;    push demo_composite     ; list {caps} demo=demo_composite
;    push demo_writer        ; list {caps} demo=demo_writer
;    push demo_strsource     ; list {caps} demo=demo_strsource
    push demo_blobstr       ; list {caps} demo=demo_blobstr
    actor create            ; list cust=demo.{caps}
    pair 1                  ; cust,list
    msg 0                   ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg

.export
    reader_factory
    writer_factory
    stream_copy
    blobstr
    strsource
    boot
