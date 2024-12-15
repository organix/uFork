;
; Blob (binary large object) support routines
;

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"
    list: "https://ufork.org/lib/list.asm"

; initialized blob builder
; cust,list -> blob
init:                       ; blob_dev <- cust,list
    msg -1                  ; list
    call list.len           ; len
    msg 0                   ; len cust,list
    push init_blob          ; len cust,list init_blob
    actor create            ; len k
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

; blob interface to a blob sub-range
slice:                      ; base,len,blob <- cust,req
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

.export
    init
    slice
    concat
