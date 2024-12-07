; "Hello, World!" example using blobs and streaming I/O

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"
    div_mod: "https://ufork.org/lib/div_mod.asm"

hello:                      ; 72,101,108,108,111,63,10,#nil
    pair_t 'H'
    pair_t 'e'
    pair_t 'l'
    pair_t 'l'
    pair_t 'o'
    pair_t '?'
nl:
    pair_t '\n'
    ref #nil

;;; Example HTTP request
http_request:
;; GET / HTTP/1.0
    pair_t 'G'
    pair_t 'E'
    pair_t 'T'
    pair_t ' '
    pair_t '/'
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
    pair_t '\r'
    pair_t '\n'
    pair_t '\r'
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

;;; TODO
;;;  * list_last ( list -- last )
;;;  * reverse_onto ( list last -- rev )

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

; copy `list` to stream `out` until `#nil`
; sending the final `result` to `cb`
list_out:                   ; cb,out,list <- result
    msg 1                   ; ok
    if_not str_end          ; --

    state -2                ; list
    typeq #pair_t           ; is_pair(list)
    if_not str_end          ; --

    state 0                 ; cb,out,list
    part 3                  ; rest first out cb
    roll 3                  ; rest out cb char=first
    actor self              ; rest out cb char callback=SELF
    push #?                 ; rest out cb char callback to_cancel=#?
    pair 2                  ; rest out cb req=to_cancel,callback,char
    state 2                 ; rest out cb req out
    actor send              ; rest out cb
    pair 2                  ; cb,out,rest
    push list_out           ; cb,out,rest list_out
    actor become            ; --
    ref std.commit

str_end:                    ; --
    msg 0                   ; result
    state 1                 ; result cb
    ref std.send_msg

; copy stream `in` to stream `out`
; sending the final `result` to `cb`
str_copy:                   ; cb,out,in <- result
    msg 1                   ; ok
    if_not str_end          ; --

    msg -1                  ; value
    eq #nil                 ; value==#nil
    if str_end              ; --

    msg -1                  ; value
    typeq #fixnum_t         ; is_fix(value)
    if str_write            ; --

str_read:                   ; --
    push #?                 ; #?
    actor self              ; #? callback=SELF
    push #?                 ; #? callback to_cancel=#?
    pair 2                  ; req=to_cancel,callback,#?
    state -2                ; req in
    ref std.send_msg

str_write:                  ; --
    msg -1                  ; char
    actor self              ; char callback=SELF
    push #?                 ; char callback to_cancel=#?
    pair 2                  ; req=to_cancel,callback,char
    state 2                 ; req out
    ref std.send_msg

; stream-requestor interface to a blob
str_blob:                   ; wofs,rofs,blob <- can,cb,req | data,cb
    msg 1                   ; data
    eq #t                   ; data==#t
    if winc_blob            ; --
    msg 1                   ; data
    typeq #fixnum_t         ; is_fix(data)
    if rinc_blob            ; --
    msg -2                  ; req
    eq #?                   ; req==#?
    if read_blob            ; --
    msg -2                  ; req
    typeq #fixnum_t         ; is_fix(req)
    if write_blob           ; --
    push #?                 ; #?
    push #f                 ; #? #f
    pair 1                  ; #f,#?
    msg 2                   ; #f,#? cb
    ref std.send_msg
read_blob:
    state 2                 ; rofs
    state 1                 ; rofs wofs
    cmp lt                  ; rofs<wofs
    if_not read_end         ; --
    state 2                 ; rofs
    actor self              ; rofs SELF
    msg 2                   ; rofs SELF cb
    pair 1                  ; rofs cb,SELF
    push k_blob_r           ; rofs cb,SELF k_blob_r
    actor create            ; rofs cust=k_blob_r.cb,SELF
    pair 1                  ; cust,rofs
    state -2                ; cust,rofs blob
    ref std.send_msg
read_end:
    push #nil               ; #nil
    push #t                 ; #nil #t
    pair 1                  ; #t,#nil
    msg 2                   ; #t,#nil cb
    ref std.send_msg
rinc_blob:
    state 0                 ; wofs,rofs,blob
    part 2                  ; blob rofs wofs
    roll 2                  ; blob wofs rofs
    push 1                  ; blob wofs rofs 1
    alu add                 ; blob wofs rofs+1
    roll -2                 ; blob rofs+1 wofs
    pair 2                  ; state'=wofs,rofs+1,blob
update_blob:                ; state'
    push str_blob           ; state' str_blob
    actor become            ; --
    msg 1                   ; data
    push #t                 ; data #t
    pair 1                  ; #t,data
    msg -1                  ; #t,data cb
    ref std.send_msg
write_blob:
    msg -2                  ; byte
    state 1                 ; byte wofs
    actor self              ; byte wofs SELF
    msg 2                   ; byte wofs SELF cb
    pair 1                  ; byte wofs cb,SELF
    push k_blob_w           ; byte wofs cb,SELF k_blob_w
    actor create            ; byte wofs cust=k_blob_w.cb,SELF
    pair 2                  ; cust,wofs,byte
    state -2                ; cust,wofs,byte blob
    ref std.send_msg
winc_blob:
    state 0                 ; wofs,rofs,blob
    part 2                  ; blob rofs wofs
    push 1                  ; blob rofs wofs 1
    alu add                 ; blob rofs wofs+1
    pair 2                  ; state'=wofs+1,rofs,blob
    ref update_blob

k_blob_r:                   ; cb,sblob <- byte | #?
    msg 0                   ; msg
    eq #?                   ; msg==#?
    if k_fail k_ok          ; --
k_blob_w:                   ; cb,sblob <- #t | #f
    msg 0                   ; msg
    if k_ok k_fail          ; --
k_ok:                       ; --
    state 1                 ; cb
    msg 0                   ; cb value
    pair 1                  ; value,cb
    state -1                ; value,cb sblob
    ref std.send_msg
k_fail:                     ; --
    msg 0                   ; msg
    push #f                 ; msg #f
    pair 1                  ; #f,msg
    state 1                 ; #f,msg cb
    ref std.send_msg

; blob interface to a #nil-terminated list
blob_list:                  ; list <- cust,req
    msg -1                  ; req
    eq #?                   ; req==#?
    if list_size            ; --
    msg -1                  ; req
    typeq #fixnum_t         ; is_fix(req)
    if list_read            ; --
    ref std.rv_false        ; write always fails

list_size:
    state 0                 ; list
    call list_len           ; size=len
    ref std.cust_send

list_read:
    msg 0                   ; cust,ofs
    part 1                  ; ofs cust
    state 0                 ; ofs cust list
list_read_loop:
    dup 1                   ; ofs cust list list
    typeq #pair_t           ; ofs cust list is_pair(list)
    if_not std.rv_undef     ; ofs cust list
    part 1                  ; ofs cust rest first
    pick 4                  ; ofs cust rest first ofs
    eq 0                    ; ofs cust rest first ofs==0
    if list_read_done       ; ofs cust rest first
    drop 1                  ; ofs cust rest
    roll 3                  ; cust rest ofs
    push 1                  ; cust rest ofs 1
    alu sub                 ; cust rest ofs-1
    roll -3                 ; ofs-1 cust rest
    ref list_read_loop
list_read_done:             ; ofs cust rest first
    roll 3                  ; ofs rest first cust
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

; main program execution stages
stage_1:                    ; {caps} <- _
    push hello              ; str
    state 0                 ; str {caps}
    push dev.io_key         ; str {caps} io_key
    dict get                ; str io_dev
    state 0                 ; str io_dev {caps}
    push stage_2            ; str io_dev {caps} stage_2
    actor create            ; str out=io_dev cb=stage_2.{caps}
    pair 2                  ; cb,out,str
    push list_out           ; cb,out,str list_out
    actor create            ; tgt=list_out.cb,out,str
tgt_start:                  ; tgt
    push #?                 ; tgt value=#?
    push #t                 ; tgt #? ok=#t
    pair 1                  ; tgt result=ok,value
    roll 2                  ; result tgt
    ref std.send_msg

stage_1a:                   ; {caps} <- _
    push http_request       ; list
    call list_len           ; size=len
    state 0                 ; size {caps}
    push stage_1b           ; size {caps} stage_1b
    actor create            ; size cust=stage_1b.{caps}
    pair 1                  ; cust,size
    state 0                 ; cust,size {caps}
    push dev.blob_key       ; cust,size {caps} blob_key
    dict get                ; cust,size blob_dev
    ref std.send_msg

stage_1b:                   ; {caps} <- blob
    push http_request       ; str
    msg 0                   ; str blob
    push 0                  ; str blob 0
    push 0                  ; str blob 0 0
    pair 2                  ; str 0,0,blob
    push str_blob           ; str 0,0,blob str_blob
    actor create            ; str out=str_blob.0,0,blob
;    dup 1                   ; str out in

    ; sliced input stream
    msg 0                   ; ... blob
    push 17                 ; ... blob len=17
    push 16                 ; ... blob len base=16
    pair 2                  ; ... base,len,blob
    push blob_slice         ; ... base,len,blob blob_slice
    actor create            ; ... sblob=blob_slice.base,len,blob
    push 0                  ; ... sblob rofs=0
    push 17                 ; ... sblob rofs wofs=17
    pair 2                  ; ... wofs,rofs,sblob
    push str_blob           ; ... wofs,rofs,sblob str_blob
    actor create            ; ... in=str_blob.wofs,rofs,sblob

    state 0                 ; str out in {caps}
    pair 1                  ; str out {caps},in
    push stage_1c           ; str out {caps},in stage_1c
    actor create            ; str out cb=stage_1c.{caps},in
    pair 2                  ; cb,out,str
    push list_out           ; cb,out,str list_out
    actor create            ; tgt=list_out.cb,out,str
    ref tgt_start

stage_1c:                   ; {caps},in <- result
    state -1                ; in
    state 1                 ; in {caps}
    push dev.io_key         ; in {caps} io_key
    dict get                ; in out=io_dev
    state 1                 ; in out {caps}
    push stage_2            ; in out {caps} stage_2
    actor create            ; in out cb=stage_2.{caps}
    pair 2                  ; cb,out,in
    push str_copy           ; cb,out,in str_copy
    actor create            ; tgt=str_copy.cb,out,in
    ref tgt_start

stage_2:                    ; {caps} <- result
    push nl                 ; nl
    push 1337               ; nl 1337
    call num_to_dec         ; str="1337"+nl
    state 0                 ; str {caps}
    push dev.io_key         ; str {caps} io_key
    dict get                ; str io_dev
    state 0                 ; str io_dev {caps}
    push stage_3a           ; str io_dev {caps} stage_3a
    actor create            ; str out=io_dev cb=stage_3a.{caps}
    pair 2                  ; cb,out,str
    push list_out           ; cb,out,str list_out
    actor create            ; tgt=list_out.cb,out,str
    ref tgt_start

stage_3:                    ; {caps} <- result
    push http_response      ; str
    state 0                 ; str {caps}
    push dev.io_key         ; str {caps} io_key
    dict get                ; str io_dev
    state 0                 ; str io_dev {caps}
    push dev.debug_key      ; str io_dev {caps} debug_key
    dict get                ; str out=io_dev cb=debug_dev
    pair 2                  ; cb,out,str
    push list_out           ; cb,out,str list_out
    actor create            ; tgt=list_out.cb,out,str
    ref tgt_start

create_str_list:            ; ( list -- str )
    roll -2                 ; k list
    dup 1                   ; k list list
    push blob_list          ; k list list blob_list
    actor create            ; k list blob=blob_list.list
    push 0                  ; k list blob rofs=0
    roll 3                  ; k blob rofs list
    call list_len           ; k blob rofs wofs=len
    pair 2                  ; k wofs,rofs,blob
    push str_blob           ; k wofs,rofs,blob str_blob
    actor create            ; k in=str_blob.wofs,rofs,blob
    ref std.return_value

create_len_blob:            ; ( list -- len,blob )
    roll -2                 ; k list
    dup 1                   ; k list list
    push blob_list          ; k list list blob_list
    actor create            ; k list blob=blob_list.list
    roll 2                  ; k blob list
    call list_len           ; k blob len
    pair 1                  ; k len,blob
    ref std.return_value

stage_3a:                   ; {caps} <- result
    push #nil               ; #nil
    push content            ; #nil content
    call create_len_blob    ; #nil len,blob
    push http_response      ; #nil len,blob response
    call create_len_blob    ; #nil len1,blob1 len0,blob0

    part 1                  ; #nil len1,blob1 blob0 len0
    pick 3                  ; #nil len1,blob1 blob0 len0 len1,blob1
    nth 1                   ; #nil len1,blob1 blob0 len0 len1
    alu sub                 ; #nil len1,blob1 blob0 len0-len1
    pair 1                  ; #nil len1,blob1 len0-len1,blob0
    pair 2                  ; blobs=(len0-len1,blob0),(len1,blob1),#nil
    push blob_concat        ; blobs blob_concat
    actor create            ; blob=blob_concat.blobs

    push 0                  ; blob rofs=0
    push http_response      ; blob rofs list
    call list_len           ; blob rofs wofs=len
    pair 2                  ; wofs,rofs,blob
    push str_blob           ; wofs,rofs,blob str_blob
    actor create            ; in=str_blob.wofs,rofs,blob

    state 0                 ; in {caps}
    push dev.io_key         ; in {caps} io_key
    dict get                ; in out=io_dev

    state 0                 ; in out {caps}
    push dev.debug_key      ; in out {caps} debug_key
    dict get                ; in out cb=debug_dev

    pair 2                  ; cb,out,in
    push str_copy           ; cb,out,in str_copy
    actor create            ; tgt=str_copy.cb,out,in
    ref tgt_start

boot:                       ; _ <- {caps}
    push #?                 ; value=#?
    push #t                 ; value ok=#t
    pair 1                  ; result=ok,value
    msg 0                   ; result {caps}
    push stage_1a           ; result {caps} stage_1a
    actor create            ; result stage_1a.{caps}
    ref std.send_msg

.export
    boot
