; HTTP static file server.

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"
    blob: "https://ufork.org/lib/blob.asm"
    io: "https://ufork.org/lib/blob_io.asm"
    http: "https://ufork.org/lib/http_data.asm"

petname:                    ; the bind address
    ref 0

; TODO
; ../tcp/random.asm shows how to listen for TCP connections
; ../../vm/js/fs_dev_demo.hum shows how to read files from disk

boot:                       ; _ <- {caps}

; Select next stage

    msg 0                   ; {caps}
    push stage_1            ; {caps} stage
;    push stage_9            ; {caps} stage
    actor become            ; --

; Initialize test request-blob

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

stage_1b:                   ; blob',{caps} <- ok,value

; Report results after final read from source

    msg 0                   ; ok,value
    state 1                 ; ok,value blob'
    pair 1                  ; blob',ok,value
    state -1                ; blob',ok,value {caps}
    push dev.debug_key      ; blob',ok,value {caps} debug_key
    dict get                ; blob',ok,value debug_dev
    actor send              ; --

; Pass completed blob to next stage

    state -1                ; {caps}
    push stage_9            ; {caps} stage_9
    actor become            ; --
    state 1                 ; blob'
    actor self              ; blob' SELF
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
