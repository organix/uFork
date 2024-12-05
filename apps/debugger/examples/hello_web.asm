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

; stream `str` to `out` until `#nil`
; sending the final `result` to `cb`
str_out:                    ; cb,out,str <- result
    msg 1                   ; ok
    if_not str_end          ; --

    state -2                ; str
    typeq #pair_t           ; is_pair(str)
    if_not str_end

    state 0                 ; cb,out,str
    part 3                  ; rest first out cb
    roll 3                  ; rest out cb char=first
    actor self              ; rest out cb char callback=SELF
    push #?                 ; rest out cb char callback to_cancel=#?
    pair 2                  ; rest out cb req=to_cancel,callback,char
    state 2                 ; rest out cb req out
    actor send              ; rest out cb
    pair 2                  ; cb,out,rest
    push str_out            ; cb,out,rest str_out
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

stage_1:                    ; {caps} <- _
    push http_request       ; str
    state 0                 ; str {caps}
    push dev.io_key         ; str {caps} io_key
    dict get                ; str io_dev
    state 0                 ; str io_dev {caps}
    push stage_2            ; str io_dev {caps} stage_2
    actor create            ; str out=io_dev cb=stage_2.{caps}
    pair 2                  ; cb,out,str
    push str_out            ; cb,out,str str_out
    actor create            ; tgt=str_out.cb,out,str
tgt_start:                  ; tgt
    push #?                 ; tgt value=#?
    push #t                 ; tgt #? ok=#t
    pair 1                  ; tgt result=ok,value
    roll 2                  ; result tgt
    ref std.send_msg

stage_1a:                   ; {caps} <- _
    push 64                 ; size=64
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
    dup 1                   ; str out in
    state 0                 ; str out in {caps}
    pair 1                  ; str out {caps},in
    push stage_1c           ; str out {caps},in stage_1c
    actor create            ; str out cb=stage_1c.{caps},in
    pair 2                  ; cb,out,str
    push str_out            ; cb,out,str str_out
    actor create            ; tgt=str_out.cb,out,str
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
    push stage_3            ; str io_dev {caps} stage_3
    actor create            ; str out=io_dev cb=stage_3.{caps}
    pair 2                  ; cb,out,str
    push str_out            ; cb,out,str str_out
    actor create            ; tgt=str_out.cb,out,str
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
    push str_out            ; cb,out,str str_out
    actor create            ; tgt=str_out.cb,out,str
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
