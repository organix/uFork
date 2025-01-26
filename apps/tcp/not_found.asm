; A uFork program that listens for TCP connections, sending each connection
; a "404 Not Found" HTTP response, then closing it.

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"
    blob: "https://ufork.org/lib/blob.asm"
    http: "https://ufork.org/lib/http_data.asm"

petname:                    ; the bind address
    ref 0

boot:                       ; _ <- {caps}

; Initialize static-content blob

    push http.not_found_rsp ; list=http_request
    msg 0                   ; list {caps}
    push listen             ; list {caps} listen
    actor create            ; list cust=listen.{caps}
    pair 1                  ; cust,list
    msg 0                   ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg

listen:                     ; {caps} <- blob

; Send a listen request to the TCP device.

    msg 0                   ; blob
;    push #?                 ; blob #?
;    push std.sink_beh       ; blob #? sink_beh
;    actor create            ; blob log=sink_beh.#?
    state 0                 ; blob {caps}
    push dev.debug_key      ; blob {caps} debug_key
    dict get                ; blob log=debug_dev
    pair 1                  ; log,blob

    dup 1                   ; log,blob log,blob
    push listening          ; log,blob log,blob listening
    actor become            ; log,blob

    push open_beh           ; log,blob open_beh
    actor create            ; on_open=open_beh.log,blob
    push petname            ; on_open petname
    actor self              ; on_open petname callback=SELF
    push #?                 ; on_open petname callback to_cancel=#?
    pair 3                  ; listen_req=to_cancel,callback,petname,on_open
    state 0                 ; listen_req {caps}
    push dev.tcp_key        ; listen_req {caps} tcp_key
    dict get                ; listen_req tcp_dev
    ref std.send_msg

listening:                  ; log,blob <- ok,value

; Log result of listen request

    state -1                ; blob
    msg 0                   ; blob ok,value
    pair 1                  ; (ok,value),blob
    state 1                 ; (ok,value),blob log
    ref std.send_msg

open_beh:                   ; log,blob <- conn

; Send the blob over the connection.

    state 0                 ; log,blob
    part 1                  ; blob log
    msg 0                   ; blob log conn
    pair 1                  ; blob conn,log
    push close_beh          ; blob conn,log close_beh
    actor create            ; blob callback=close_beh.conn,log
    push #?                 ; blob callback to_cancel=#?
    pair 2                  ; write_req=to_cancel,callback,blob
    msg 0                   ; write_req conn
    ref std.send_msg

close_beh:                  ; conn,log <- ok,value

; Log result of write request

    msg 0                   ; ok,value
    state -1                ; ok,value log
    actor send              ; --

; Close the connection.

    push #nil               ; #nil
    state -1                ; #nil callback=log
    push #?                 ; #nil callback to_cancel=#?
    pair 2                  ; close_req=to_cancel,callback,#nil
    state 1                 ; close_req conn
    ref std.send_msg

.export
    boot
