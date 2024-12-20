;
; Blob (binary large object) support routines
;

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"
    list: "https://ufork.org/lib/list.asm"

;
; legacy API adapter
;

legacy:                     ; blob <- cust | cust,ofs | cust,ofs,data | base',len',cust
    msg 0                   ; msg
    dup 1                   ; msg cust=msg
    typeq #actor_t          ; msg is_cap(cust)
    if_not legacy_api       ; msg
    push #?                 ; msg #?
    roll 2                  ; #? cust=msg
    pair 1                  ; msg=cust,#?
legacy_api:                 ; msg
    dup 1                   ; msg msg
    typeq #pair_t           ; msg is_pair(msg)
    if_not std.abort        ; msg
    dup 1                   ; msg cust,req=msg
    nth 1                   ; msg cust
    typeq #actor_t          ; msg is_pair(msg)
    if_not std.abort        ; msg
    state 0                 ; msg blob
    ref std.send_msg

;
; initialized blob builder
; cust,list -> blob
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

;    push legacy             ; list cust blob legacy
;    actor create            ; list cust blob=legacy.blob

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
    msg -1                  ; req
    typeq #pair_t           ; is_pair(req)
    if slice_write          ; --
    ref std.commit

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
    pick -2                 ; cust len' base base' base
    alu add                 ; cust len' base base'+base
    roll -3                 ; cust base'+base len' base
    alu add                 ; cust base'+base len'+base
    dup 1                   ; cust base'+base len'+base len'+base
    state 2                 ; cust base'+base len'+base len'+base len
    cmp gt                  ; cust base'+base len'+base len'+base>len
    if_not slice_clipped    ; cust base'+base len'+base
    drop 1                  ; cust base'+base
    state 2                 ; cust base'+base len
slice_clipped:              ; cust base'' len''
    roll 2                  ; cust len'' base''
    pair 2                  ; base'',len'',cust
    state -2                ; base'',len'',cust blob
    ref std.send_msg

;
; blob interface to a concatenation of blobs
;

concat:                     ; (len,blob),...,#nil <- cust,req
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

;
; blob interface to a pair of consecutive blobs
;

pair:                       ; head,tail <- cust | cust,ofs | cust,ofs,data
    msg 0                   ; msg
    state 0                 ; msg head,tail
    pair 1                  ; (head,tail),msg
    msg 0                   ; (head,tail),msg cust
    typeq #actor_t          ; (head,tail),msg is_cap(cust)
    if pair_size            ; (head,tail),cust
    msg -1                  ; (head,tail),msg ofs
    typeq #fixnum_t         ; (head,tail),msg is_fix(ofs)
    if pair_read            ; (head,tail),cust,ofs
    msg -1                  ; (head,tail),msg ofs,data
    typeq #pair_t           ; (head,tail),msg is_pair(ofs,data)
    if pair_write           ; (head,tail),cust,ofs,data
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
    ref std.commit

k_pair_write:               ; (head,tail),cust,req <- size
    ref std.commit

;
; input stream-requestor interface to a blob
;

reader:                     ; ofs,blob <- can,cb,req | data,cb
; FIXME: need `size` to distinguish end-of-stream from read-error...
    msg 0                   ; msg
    typeq #pair_t           ; is_pair(msg)
    if_not std.abort        ; --
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
    actor self              ; ofs SELF
    msg 2                   ; ofs SELF cb
    pair 1                  ; ofs cb,SELF
    push k_blob_r           ; ofs cb,SELF k_blob_r
    actor create            ; ofs cust=k_blob_r.cb,SELF
    pair 1                  ; cust,ofs
    state -1                ; cust,ofs blob
    ref std.send_msg
reader_end:                 ; --
    push #nil               ; #nil
    push #t                 ; #nil #t
    pair 1                  ; #t,#nil
    msg 2                   ; #t,#nil cb
    ref std.send_msg
reader_ok:                  ; --
    state 0                 ; ofs,blob
    part 1                  ; blob ofs
    push 1                  ; blob ofs 1
    alu add                 ; blob ofs+1
    pair 1                  ; state'=ofs+1,blob
update_blob:                ; state'
    push reader             ; state' reader
    actor become            ; --
    msg 1                   ; data
    push #t                 ; data #t
    pair 1                  ; #t,data
    msg -1                  ; #t,data cb
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
;

writer_factory:             ; blob_dev <- cust,blk_size
    msg -1                  ; len=blk_size
    msg 0                   ; len cust,blk_size
    push k_writer_init      ; len cust,blk_size k_writer_init
    actor create            ; len k=k_writer_init.cust,blk_size
    pair 1                  ; k,len
    state 0                 ; k,len blob_dev
    ref std.send_msg

k_writer_init:              ; cust,blk_size <- blob
    msg 0                   ; blob
    typeq #actor_t          ; is_cap(blob)
    if_not writer_init_fail ; --
    ;...
writer_init_fail:           ; --
    push #?                 ; #?
    state 1                 ; #? cust
    ref std.send_msg

writer:                     ; ofs,size,blob,blk_size <- can,cb,req | wr_ok
    msg -2                  ; req
    eq #?                   ; req==#?
    if writer_read          ; --
    msg -2                  ; req
    typeq #fixnum_t         ; is_fix(req)
    if writer_write         ; --
writer_fail:                ; --
    push #?                 ; #?
    push #f                 ; #? #f
    pair 1                  ; #f,#?
    msg 2                   ; #f,#? cb
    ref std.send_msg

writer_read:                ; --
    ref writer_fail

writer_write:               ; --
    ref writer_fail

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
    ref #nil

demo_slice:                 ; {caps} <- blob
    state 0                 ; {caps}
;    push demo_size          ; {caps} demo=demo_size
    push demo_print         ; {caps} demo=demo_print
    actor become            ; --
    msg 0                   ; blob
    push 11                 ; blob len=11
    push 4                  ; blob len base=4
    pair 2                  ; base,len,blob
    push slice              ; base,len,blob slice
    actor create            ; blob=slice.base,len,blob
    actor self              ; blob SELF
    ref std.send_msg

demo_size:                  ; {caps} <- blob
    state 0                 ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; cust=debug_dev
    msg 0                   ; debug_dev blob
    ref std.send_msg

demo_print:                 ; {caps} <- blob
    debug
    msg 0                   ; blob
    push 0                  ; blob ofs=0
    pair 1                  ; ofs,blob
    push reader             ; ofs,blob reader
    actor create            ; in=reader.ofs,blob
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

boot:                       ; _ <- {caps}
    push http_request       ; list=http_request
    msg 0                   ; list {caps}
;    push demo_size          ; list {caps} demo=demo_size
;    push demo_print         ; list {caps} demo=demo_print
    push demo_slice         ; list {caps} demo=demo_slice
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
    concat
    pair
    boot
