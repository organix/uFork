; A uFork program that listens for TCP connections, sending each connection a
; random byte then closing it.

.import
    dev: "https://ufork.org/lib/dev.asm"
    fork: "https://ufork.org/lib/fork.asm"
    std: "https://ufork.org/lib/std.asm"

petname:                    ; the bind address
    ref 0

boot:                       ; _ <- {caps}

; Send a listen request to the TCP device.

    msg 0                   ; {caps}
    push on_open_beh        ; {caps} on_open_beh
    actor create            ; on_open=on_open_beh.{caps}
    push petname            ; on_open petname
    push #?                 ; on_open petname #?
    push std.sink_beh       ; on_open petname #? sink_beh
    actor create            ; on_open petname callback=sink_beh.#?
    push #?                 ; on_open petname callback to_cancel=#?
    pair 3                  ; listen_req=to_cancel,callback,petname,on_open
    msg 0                   ; listen_req {caps}
    push dev.tcp_key        ; listen_req {caps} tcp_key
    dict get                ; listen_req tcp_dev
    ref std.send_msg

on_open_beh:                ; {caps} <- conn

; Allocate a new blob, 1 byte wide. Whilst that is happening, generate a random
; byte.

    push 1                  ; size=1
    push 255                ; size limit=255
    pair 1                  ; fork_req=limit,size
    state 0                 ; fork_req {caps}
    push dev.blob_key       ; fork_req {caps} blob_key
    dict get                ; fork_req t_svc=blob_dev
    state 0                 ; fork_req t_svc {caps}
    push dev.random_key     ; fork_req t_svc {caps} random_key
    dict get                ; fork_req t_svc h_svc=random_dev
    msg 0                   ; fork_req t_svc h_svc conn
    push write_byte_beh     ; fork_req t_svc h_svc conn write_byte_beh
    actor create            ; fork_req t_svc h_svc cust=write_byte_beh.conn
    pair 2                  ; fork_req cust,h_svc,t_svc
    push fork.beh           ; fork_req cust,h_svc,t_svc fork_beh
    actor create            ; fork_req fork=fork_beh.cust,h_svc,t_svc
    ref std.send_msg

write_byte_beh:             ; conn <- byte,blob

; Populate the blob with the byte.

    msg 1                   ; byte
    push 0                  ; byte offset=0
    state 0                 ; byte offset conn
    msg -1                  ; byte offset conn blob
    pair 1                  ; byte offset blob,conn
    push write_blob_beh     ; byte offset blob,conn write_blob_beh
    actor create            ; byte offset cust=write_blob_beh.blob,conn
    pair 2                  ; write_req=cust,offset,byte
    msg -1                  ; write_req blob
    ref std.send_msg

write_blob_beh:             ; blob,conn <- ok

; Send the blob over the connection.

    state 1                 ; blob
    state -1                ; blob conn
    push close_beh          ; blob conn close_beh
    actor create            ; blob callback=close_beh.conn
    push #?                 ; blob callback to_cancel=#?
    pair 2                  ; write_req=to_cancel,callback,blob
    state -1                ; write_req conn
    ref std.send_msg

close_beh:                  ; conn <- _

; Close the connection.

    push #nil               ; #nil
    push #?                 ; #nil #?
    push std.sink_beh       ; #nil #? sink_beh
    actor create            ; #nil callback=sink_beh.#?
    push #?                 ; #nil callback to_cancel=#?
    pair 2                  ; close_req=to_cancel,callback,#nil
    state 0                 ; close_req conn
    ref std.send_msg

.export
    boot
