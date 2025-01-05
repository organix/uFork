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
    roll 2                  ; cust len' base'
    msg 0                   ; cust len' base' size
    alu sub                 ; cust len' base''=base'-size
    pair 2                  ; base'',len',cust
    state 1                 ; base'',len',cust (head,tail)
    nth -1                  ; base'',len',cust tail
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
    push demo_source        ; {caps} demo=demo_source
    actor become            ; --
    state 1                 ; blob
    actor self              ; blob SELF
    ref std.send_msg

demo_slice:                 ; {caps} <- blob
    state 0                 ; {caps}
;    push demo_size          ; {caps} demo=demo_size
    push demo_source        ; {caps} demo=demo_source
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
;    push demo_source        ; list {caps} demo=demo_source
;    push demo_slice         ; list {caps} demo=demo_slice
    push demo_pair          ; list {caps} demo=demo_pair
;    push demo_composite     ; list {caps} demo=demo_composite
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
    boot
