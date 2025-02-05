.import
    blob: "https://ufork.org/lib/blob.asm"
    dev: "https://ufork.org/lib/dev.asm"
    http: "https://ufork.org/lib/http_data.asm"
    io: "https://ufork.org/lib/blob_io.asm"
    std: "https://ufork.org/lib/std.asm"

boot:                       ; _ <- {caps}

; Select next stage

    msg 0                   ; {caps}
    push stage_1            ; {caps} stage
;    push stage_9            ; {caps} stage
    actor become            ; --

; Initialize test get-request blob

    push http.get_req       ; list=get_req
    actor self              ; list cust=SELF
    pair 1                  ; cust,list
    msg 0                   ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg

stage_1:                    ; {caps} <- blob
    state 0                 ; {caps}
    push stage_1a           ; {caps} stage_1a
    actor become

; Create a blob-stream source to mimic an inbound connection

    msg 0                   ; blob
;    push 1024               ; blob size=1024
    push 10                 ; blob size=10
    push 0                  ; blob size offset=0
    pair 2                  ; offset,size,blob
    push io.strsource       ; offset,size,blob strsource
    actor create            ; src=strsource.offset,size,blob
    actor self              ; src SELF
    ref std.send_msg

stage_1a:                   ; {caps} <- src

; Create a virtual blob to be filled from the blob-stream source

    actor self              ; cb=SELF
    msg 0                   ; cb src
    pick -2                 ; src cb src
    push #nil               ; src cb src blob=#nil
    pair 2                  ; src blob,src,cb
    push io.blobstr         ; src blob,src,cb blobstr
    actor create            ; src blob'=blobstr.blob,src,cb

; Start concurrent PEG parsing of the virtual blob
; [FIXME: consider adding a short delay here...]

    dup 1                   ; src blob' blob'
    state 0                 ; src blob' blob' {caps}
    push stage_2            ; src blob' blob' {caps} stage_2
    actor create            ; src blob' blob' stage_2.{caps}
    actor send              ; src blob'

; Remember the virtual blob for processing in the next stage

    state 0                 ; src blob' {caps}
    pick 2                  ; src blob' {caps} blob'
    pair 1                  ; src blob' blob',{caps}
    push stage_1b           ; src blob' blob',{caps} stage_1b
    actor become            ; src blob'

; Begin reading from the source to prime the pump

    push #?                 ; src blob' req=#?
    roll 2                  ; src req cb=blob'
    push #?                 ; src req cb can=#?
    pair 2                  ; src can,cb,req
    roll 2                  ; can,cb,req src
    ref std.send_msg

stage_1b:                   ; blob',{caps} <- ok,value | #?

; Report stream progress

    state -1                ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; cust=debug_dev
    state 1                 ; cust blob' // size request
    actor send              ; --
    msg 0                   ; msg
    eq #?                   ; msg==#?
    if std.commit

; Pass completed blob to next stage

    state -1                ; {caps}
;    push stage_2            ; {caps} stage_2
;    push stage_9            ; {caps} stage_9
    push std.sink_beh       ; {caps} sink_beh
    actor become            ; --
    state 1                 ; blob'
    actor self              ; blob' SELF
    ref std.send_msg

stage_2:                    ; {caps} <- blob
    state 0                 ; {caps}
    push stage_2a           ; {caps} stage_2a
    actor become            ; --

; Attempt to match "GET" command prefix

    msg 0                   ; blob
    push 0                  ; blob ofs=0
    actor self              ; blob ofs cust=SELF
    pair 2                  ; cust,ofs,blob
    call new_get_ptrn       ; cust,ofs,blob ptrn
    ref std.send_msg

stage_2a:                   ; {caps} <- base,len,blob
    state 0                 ; {caps}
    push stage_5            ; {caps} stage_5
    actor become            ; --

; Attempt to match the requested "path" token
; [FIXME: verify that "GET" matched successfully...]

    msg 0                   ; base,len,blob
    part 2                  ; blob len base
    alu add                 ; blob ofs=len+base
    actor self              ; blob ofs cust=SELF
    pair 2                  ; cust,ofs,blob
    call new_token_ptrn     ; cust,ofs,blob ptrn
    ref std.send_msg

stage_5:                    ; {caps} <- base,len,blob

; Report PEG parser results

    msg 0                   ; base,len,blob
    state 0                 ; base,len,blob {caps}
    push dev.debug_key      ; base,len,blob {caps} debug_key
    dict get                ; base,len,blob debug_dev
    actor send              ; --

; Create a blob-slice with just the "path" match

    state 0                 ; {caps}
    msg 0                   ; {caps} base,len,blob
    push blob.slice         ; {caps} base,len,blob slice
    actor create            ; {caps} path=slice.base,len,blob
    pair 1                  ; path,{caps}
    push stage_5a           ; path,{caps} stage_5a
    actor become            ; --

; Initialize content-length + end-of-headers blob

    push http.blankln       ; blankln='\r','\n','\r','\n',#nil
    msg 2                   ; blankln len
    call num_to_dec         ; list
    actor self              ; list cust=SELF
    pair 1                  ; cust,list
    state 0                 ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg

stage_5a:                   ; path,{caps} <- length
    state 0                 ; path,{caps}
    msg 0                   ; path,{caps} length
    pair 1                  ; length,path,{caps}
    push stage_5b           ; length,path,{caps} stage_5b
    actor become            ; --

; Initialize test ok-response blob

    push http.ok_rsp        ; list=ok_rsp
    actor self              ; list cust=SELF
    pair 1                  ; cust,list
    state -1                ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg

stage_5b:                   ; length,path,{caps} <- ok_rsp
    state -2                ; {caps}
    push stage_9            ; {caps} stage_9
    actor become            ; --

; Begin composing blob-pairs from the tail

    state 2                 ; tail=path
    state 1                 ; tail head=length
    pair 1                  ; head,tail
    push blob.pair          ; head,tail pair
    actor create            ; tail'=pair.head,tail

; A slice of the "OK" response up to the "Content-length:" value

    msg 0                   ; tail' blob=ok_rsp
    push 59                 ; tail' blob len=59
    push 0                  ; tail' blob len base=0
    pair 2                  ; tail' base,len,blob
    push blob.slice         ; tail' base,len,blob slice
    actor create            ; tail' head=slice.base,len,blob
    pair 1                  ; head,tail'
    push blob.pair          ; head,tail' pair
    actor create            ; blob=pair.head,tail'
    actor self              ; blob SELF
    ref std.send_msg

stage_9:                    ; {caps} <- blob

; Select display strategy for blob

    state 0                 ; {caps}
;    push blob_debug         ; {caps} blob_debug
;    push blob_size          ; {caps} blob_size
    push blob_print         ; {caps} blob_print
;    push blob_source        ; {caps} blob_source
    actor become            ; --

; Forward blob to next stage

    msg 0                   ; blob
    actor self              ; blob SELF
    ref std.send_msg

blob_debug:                 ; {caps} <- blob
    msg 0                   ; blob
    state 0                 ; blob {caps}
    push dev.debug_key      ; blob {caps} debug_key
    dict get                ; blob debug_dev
    ref std.send_msg

blob_size:                  ; {caps} <- blob
    state 0                 ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; cust=debug_dev
    msg 0                   ; debug_dev blob
    ref std.send_msg

blob_print:                 ; {caps} <- blob
    msg 0                   ; blob
    state 0                 ; blob {caps}
    push k_blob_print       ; blob {caps} k_blob_print
    actor create            ; blob cust=k_blob_print.{caps}
    pair 1                  ; cust,blob
    push #?                 ; cust,blob #?
    push io.reader_factory  ; cust,blob #? reader_factory
    actor create            ; cust,blob reader_factory._
    ref std.send_msg
k_blob_print:               ; {caps} <- in
    msg 0                   ; in
    state 0                 ; in {caps}
    push dev.io_key         ; in {caps} io_key
    dict get                ; in out=io_dev
    state 0                 ; in out {caps}
    push dev.debug_key      ; in out {caps} debug_key
    dict get                ; in out cb=debug_dev
    pair 2                  ; cb,out,in
    push io.stream_copy     ; cb,out,in stream_copy
    actor create            ; tgt=stream_copy.cb,out,in
tgt_start:                  ; tgt
    push #?                 ; tgt value=#?
    push #t                 ; tgt #? ok=#t
    pair 1                  ; tgt result=ok,value
    roll 2                  ; result tgt
    ref std.send_msg

blob_source:                ; {caps} <- blob
    state 0                 ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; cust=debug_dev
    push 4096               ; cust len=4096
;    push 13                 ; cust len=13
    push 0                  ; cust len base=0
;    push 7                  ; cust len base=7
;    push 21                 ; cust len base=21
;    push 42                 ; cust len base=42
    pair 2                  ; base,len,cust
    msg 0                   ; base,len,cust blob
    ref std.send_msg

.export
    boot
