;
; Blob (binary large object) support routines
;

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"
    list: "https://ufork.org/lib/list.asm"

;
; initialized blob builder
;   cust,list -> blob
;

init:                       ; blob_dev <- cust,list
    msg -1                  ; list
    call list.len           ; len
    msg 0                   ; len cust,list
    push init_blob          ; len cust,list init_blob
    actor create            ; len k=init_blob.cust,list
    pair 1                  ; k,len
    state 0                 ; k,len blob_dev
    ref std.send_msg

init_blob:                  ; cust,list <- blob
    state 0                 ; cust,list
    part 1                  ; list cust
    msg 0                   ; list cust blob
    push 0                  ; list cust blob ofs=0
    roll 4                  ; cust blob ofs list
    pair 3                  ; list,ofs,blob,cust
    push init_copy          ; list,ofs,blob,cust init_copy
    actor become            ; --
    push #t                 ; #t
    actor self              ; #t SELF
    ref std.send_msg

init_copy:                  ; list,ofs,blob,cust <- bool
    msg 0                   ; bool
    if_not init_fail        ; --
    state 1                 ; list
    typeq #pair_t           ; is_pair(list)
    if_not init_done        ; --
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
    push init_copy          ; rest,ofs+1,blob,cust init_copy
    actor become            ; --
    ref std.commit

init_done:
    state 3                 ; blob
    state -3                ; blob cust
    ref std.send_msg

init_fail:
    push #?                 ; #?
    state -3                ; #? cust
    ref std.send_msg

;
; blob interface to a blob sub-range
;

slice:                      ; base,len,blob <- cust | cust,ofs | cust,ofs,data | base',len',cust
    msg 0                   ; cust
    typeq #actor_t          ; is_cap(cust)
    if slice_size           ; --
    msg -1                  ; req
    typeq #fixnum_t         ; is_fix(req)
    if slice_read           ; --
    msg 1                   ; cust
    typeq #actor_t          ; is_cap(cust)
    if slice_write          ; --
    msg 1                   ; base'
    typeq #fixnum_t         ; is_fix(base')
    if slice_source         ; --
    ref std.abort

slice_size:
    state 2                 ; size=len
    ; FIXME: clamp to size of underlying blob?
    msg 0                   ; size cust
    ref std.send_msg

slice_read:
    msg 0                   ; cust,ofs
    part 1                  ; ofs cust

    pick 2                  ; ofs cust ofs
    state 2                 ; ofs cust ofs len
    cmp lt                  ; ofs cust ofs<len
    if_not slice_read_fail  ; ofs cust

    state 1                 ; ofs cust base
    roll 3                  ; cust base ofs
    alu add                 ; cust base+ofs
    roll -2                 ; base+ofs cust
    pair 1                  ; cust,base+ofs
    state -2                ; cust,base+ofs blob
    ref std.send_msg

slice_read_fail:            ; ofs cust
    push #?                 ; ofs cust #?
    roll 2                  ; ... #? cust
    ref std.send_msg

slice_write:
    msg 0                   ; cust,ofs,value
    part 2                  ; value ofs cust

    pick 2                  ; value ofs cust ofs
    state 2                 ; value ofs cust ofs len
    cmp lt                  ; value ofs cust ofs<len
    if_not slice_write_fail ; value ofs cust

    state 1                 ; value ofs cust base
    roll 3                  ; value cust base ofs
    alu add                 ; value cust base+ofs
    roll -2                 ; value base+ofs cust
    pair 2                  ; cust,base+ofs,value
    state -2                ; cust,base+ofs,value blob
    ref std.send_msg

slice_write_fail:           ; value ofs cust
    push #f                 ; value ofs cust #f
    roll 2                  ; ... #f cust
    ref std.send_msg

slice_source:
    msg 0                   ; base',len',cust
    part 2                  ; cust len' base'
    state 1                 ; cust len' base' base
    alu add                 ; cust len' base''=base'+base
    state 2                 ; cust len' base'' len
    msg 1                   ; cust len' base'' len base'
    alu sub                 ; cust len' base'' size'=len-base'
    pick 3                  ; cust len' base'' size' len'
    pick 2                  ; cust len' base'' size' len' size'
    cmp gt                  ; cust len' base'' size' len'>size'
    if_not k_slice_fit      ; cust len' base'' size'

    roll 2                  ; cust len' size' base''
    roll 3                  ; cust size' base'' len'

k_slice_fit:                ; cust len' base' _
    drop 1                  ; cust len' base'
    pair 2                  ; base',len',cust
    state -2                ; base',len',cust blob
    ref std.send_msg

;
; blob interface to a pair of consecutive blobs
;

pair:                       ; head,tail <- cust | cust,ofs | cust,ofs,data | base',len',cust
    msg 0                   ; msg
    state 0                 ; msg head,tail
    pair 1                  ; (head,tail),msg
    msg 0                   ; (head,tail),msg cust
    typeq #actor_t          ; (head,tail),msg is_cap(cust)
    if pair_size            ; (head,tail),cust
    msg -1                  ; (head,tail),msg ofs
    typeq #fixnum_t         ; (head,tail),msg is_fix(ofs)
    if pair_read            ; (head,tail),cust,ofs
    msg 1                   ; (head,tail),msg cust
    typeq #actor_t          ; (head,tail),msg is_cap(cust)
    if pair_write           ; (head,tail),cust,ofs,data
    msg 1                   ; (head,tail),msg base'
    typeq #fixnum_t         ; (head,tail),msg is_fix(base')
    if pair_source          ; (head,tail),base',len',cust
    ref std.abort

pair_size:                  ; (head,tail),cust
    push k_pair_size        ; (head,tail),cust k_beh=k_pair_size
pair_head:                  ; (head,tail),msg k_beh
    actor create            ; k=k_beh.(head,tail),msg
    state 1                 ; k head
    ref std.send_msg
pair_read:                  ; (head,tail),cust,ofs
    push k_pair_read        ; (head,tail),msg k_beh=k_pair_read
    ref pair_head
pair_write:                 ; (head,tail),cust,ofs,data
    push k_pair_write       ; (head,tail),msg k_beh=k_pair_write
    ref pair_head
pair_source:                ; (head,tail),base',len',cust
    push k_pair_source      ; (head,tail),msg k_beh=k_pair_source
    ref pair_head

k_pair_size:                ; (head,tail),cust <- size
    state -1                ; cust
    msg 0                   ; cust size
    pair 1                  ; size,cust
    push k_pair_size2       ; size,cust k_pair_size2
    actor become            ; --

    actor self              ; k=SELF
    state 1                 ; k (head,tail)
    nth -1                  ; k tail
    ref std.send_msg

k_pair_size2:               ; size,cust <- size'
    state 1                 ; size
    msg 0                   ; size size'
    alu add                 ; total=size+size'
    state -1                ; total cust
    ref std.send_msg

k_pair_read:                ; (head,tail),cust,ofs <- size
    state -2                ; ofs
    msg 0                   ; ofs size
    cmp lt                  ; ofs<size
    if_not k_pair_read2     ; --

    state -1                ; cust,ofs
    state 1                 ; cust,ofs (head,tail)
    nth 1                   ; cust,ofs head
    ref std.send_msg

k_pair_read2:               ; --
    state -2                ; ofs
    msg 0                   ; ofs size
    alu sub                 ; ofs'=ofs-size
    state 2                 ; ofs' cust
    pair 1                  ; cust,ofs'
    state 1                 ; cust,ofs' (head,tail)
    nth -1                  ; cust,ofs' tail
    ref std.send_msg

k_pair_write:               ; (head,tail),cust,ofs,data <- size
    state 3                 ; ofs
    msg 0                   ; ofs size
    cmp lt                  ; ofs<size
    if_not k_pair_write2    ; --

    state -1                ; cust,ofs,data
    state 1                 ; cust,ofs,data (head,tail)
    nth 1                   ; cust,ofs,data head
    ref std.send_msg

k_pair_write2:              ; --
    state -2                ; ofs,data
    part 1                  ; data ofs
    msg 0                   ; data ofs size
    alu sub                 ; data ofs'=ofs-size
    state 2                 ; data ofs' cust
    pair 2                  ; cust,ofs',data
    state 1                 ; cust,ofs',data (head,tail)
    nth -1                  ; cust,ofs',data tail
    ref std.send_msg

k_pair_source:              ; (head,tail),base',len',cust <- size
    state 2                 ; base'
    msg 0                   ; base' size
    cmp lt                  ; base'<size
    if_not k_pair_source2   ; --

    state -1                ; base',len',cust
    part 2                  ; cust len' base'
    msg 0                   ; cust len' base' size
    pick 2                  ; cust len' base' size base'
    alu sub                 ; cust len' base' size'=size-base'
    pick 3                  ; cust len' base' size' len'
    pick 2                  ; cust len' base' size' len' size'
    cmp gt                  ; cust len' base' size' len'>size'
    if_not k_pair_fit       ; cust len' base' size'

    roll 2                  ; cust len' size' base'
    roll 3                  ; cust size' base' len'

k_pair_fit:                 ; cust len' base' _
    drop 1                  ; cust len' base'
    pair 2                  ; base',len',cust
    state 1                 ; base',len',cust (head,tail)
    nth 1                   ; base',len',cust head
    ref std.send_msg

k_pair_source2:             ; --
    state -1                ; base',len',cust
    part 2                  ; cust len' base'
    roll 2                  ; cust base' len'
    msg 0                   ; cust base' len' size
    alu sub                 ; cust base' len''=len'-size
    roll 2                  ; cust len'' base'
    msg 0                   ; cust len'' base' size
    alu sub                 ; cust len'' base''=base'-size
    pair 2                  ; base'',len'',cust
    state 1                 ; base'',len'',cust (head,tail)
    nth -1                  ; base'',len'',cust tail
    ref std.send_msg

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
    push pair               ; size ofs len blob,blob' pair
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
    push slice              ; base,len,blob slice
    actor become            ; --
    actor self              ; SELF
    msg 1                   ; SELF cust
    ref std.send_msg
wr_pair:                    ; convert to blob.pair
;    msg 0                   ; cust,next
    msg -1                  ; tail=next
    state 0                 ; tail head=blob
    pair 1                  ; head,tail
    push pair               ; head,tail pair
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
    push slice              ; base,len,blob slice
    actor create            ; tail=slice.base,len,blob

    msg 0                   ; tail blob
    push 11                 ; tail blob len=11
    push 4                  ; tail blob len base=4
    pair 2                  ; tail base,len,blob
    push slice              ; tail base,len,blob slice
    actor create            ; tail head=slice.base,len,blob

    pair 1                  ; head,tail
    push pair               ; head,tail pair
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
    push init               ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg
k_demo_pair:                ; head,{caps} <- tail
    state -1                ; {caps}
    push k_demo_pair1       ; {caps} demo=k_demo_pair1
    actor become            ; --
    msg 0                   ; tail
    state 1                 ; tail head
    pair 1                  ; head,tail
    push pair               ; head,tail pair
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
    push slice              ; base,len,blob slice
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
;    push 4096               ; cust len=4096
    push 13                 ; cust len=13
    push 7                  ; cust len base=7
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
    push demo_pair          ; list {caps} demo=demo_pair
;    push demo_composite     ; list {caps} demo=demo_composite
;    push demo_writer        ; list {caps} demo=demo_writer
    actor create            ; list cust=demo.{caps}
    pair 1                  ; cust,list
    msg 0                   ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push init               ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg

.export
    init
    slice
    pair
    reader_factory
    writer_factory
    stream_copy
    boot
