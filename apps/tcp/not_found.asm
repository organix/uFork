; A uFork program that listens for TCP connections, sending each connection
; a 404 Not Found HTTP response, then closing it.

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

petname:                    ; the bind address
    ref 0

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

list_size:                  ; --
    state 0                 ; list
    call list_len           ; size=len
    ref std.cust_send

; blob that must be read only once in sequential order
blob_once:                  ; list <- cust,req
    msg -1                  ; req
    eq #?                   ; req==#?
    if list_size            ; --
    msg -1                  ; req
    typeq #fixnum_t         ; is_fix(req)
    if_not std.rv_false     ; --
    state -1                ; rest
    push blob_once          ; rest blob_once
    actor become            ; --
    state 1                 ; first
    ref std.cust_send

boot:                       ; _ <- {caps}

; Send a listen request to the TCP device.

    push #?                 ; #?
    push std.sink_beh       ; #? sink_beh
    actor create            ; sink=sink_beh.#?
    pick 1                  ; sink on_close=sink
    msg 0                   ; sink on_close {caps}
    push on_open_beh        ; sink on_close {caps} on_open_beh
    actor create            ; sink on_close on_open=on_open_beh.{caps}
    push petname            ; sink on_close on_open petname
    pick 4                  ; sink on_close on_open petname callback=sink
    push #?                 ; sink on_close on_open petname callback to_cancel=#?
    pair 4                  ; sink listen_req=(to_cancel callback petname on_open . on_close)
    msg 0                   ; sink listen_req {caps}
    push dev.tcp_key        ; sink listen_req {caps} tcp_key
    dict get                ; sink listen_req tcp_dev
    ref std.send_msg

on_open_beh:                ; {caps} <- conn

; Create a read-once "blob" wrapping a static pair-list response.

    push http_response      ; http_response
    push blob_once          ; http_response blob_once
    actor create            ; blob=blob_once.http_response

; Send the blob over the connection.

    state 0                 ; blob {caps}
    msg 0                   ; blob {caps} conn
    pair 1                  ; blob conn,{caps}
    push close_beh          ; blob conn,{caps} close_beh
    actor create            ; blob callback=close_beh.conn,{caps}
    push #?                 ; blob callback to_cancel=#?
    pair 2                  ; write_req=(to_cancel callback . blob)
    state -1                ; write_req conn
    ref std.send_msg

close_beh:                  ; conn,{caps} <- _

; Close the connection.

    push #nil               ; #nil
;    push #?                 ; #nil #?
;    push std.sink_beh       ; #nil #? sink_beh
;    actor create            ; #nil callback=sink_beh.#?
    state -1                ; #nil {caps}
    push dev.debug_key      ; #nil {caps} debug_key
    dict get                ; #nil callback=debug_dev
    push #?                 ; #nil callback to_cancel=#?
    pair 2                  ; close_req=(to_cancel callback . #nil)
    state 1                 ; close_req conn
    ref std.send_msg

.export
    boot
