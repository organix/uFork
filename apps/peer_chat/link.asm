; A reliable bi-directional communication channel.
; Refer to ./README.md for an explanation of the protocol.

.import
    std: "https://ufork.org/lib/std.asm"

tx_msg:                     ; (tx_msg . content)
    ref 1
tx_ack:                     ; (tx_ack ack' . seq')
    ref -1
tx_tmo:                     ; (tx_tmo . seq')
    ref 0

tx_timeout:
    ref 1000                ; 1000ms
rx_timeout:
    ref 3000                ; 3sec

;
; Link transmitter
;
; Transmitter state:
;   link: capability for network transport
;   timer: capability for timer service
;   ack: last message number successfully received (by rx)
;   seq: next message number to transmit
;   msgs: queue of unacknowledged messages
;

tx_beh:                     ; (link timer ack seq . msgs) <- tx_evt
    msg 1                   ; opr
    eq tx_msg               ; opr==tx_msg
    if tx_msg_tail          ; --
    msg 1                   ; opr
    eq tx_ack               ; opr==tx_ack
    if tx_ack_tail          ; --
    msg 1                   ; opr
    eq tx_tmo               ; opr==tx_tmo
    if tx_tmo_tail          ; --

    ; unknown operation
    push #?                 ; #?
    push std.sink_beh       ; #? sink_beh
    actor become            ; --  // become inert
    ref std.commit

tx_msg_tail:                ; (link timer ack seq . msgs) <- (tx_msg . content)
    ; add message to queue
    state -4                ; msgs
    msg -1                  ; msgs content
    state 4                 ; msgs content seq
    pair 1                  ; msgs (seq . content)
    deque put               ; msgs'

    ; increment seq number
    dup 1                   ; msgs' msgs'
    state 4                 ; msgs' msgs' seq
    push 1                  ; msgs' msgs' seq 1
    alu add                 ; msgs' msgs' seq+1

    ; update actor state
    state 3                 ; msgs' msgs' seq+1 ack
    state 2                 ; msgs' msgs' seq+1 ack timer
    state 1                 ; msgs' msgs' seq+1 ack timer link
    pair 4                  ; msgs' tx_state=(link timer ack seq+1 . msgs')
    push tx_beh             ; msgs' tx_state tx_beh
    actor become            ; msgs'

    ; if the queue was empty previously,
    state -4                ; msgs' msgs
    deque empty             ; msgs' is_empty(msgs)
    if_not std.commit       ; msgs'

    ; then send message to rx
    deque pop               ; msgs (seq . content)
    state 3                 ; msgs (seq . content) ack
    pair 1                  ; msgs (ack seq . content)
    state 1                 ; msgs (ack seq . content) link
    ref std.send_msg

tx_ack_tail:                ; (link timer ack seq . msgs) <- (tx_ack ack' . seq')
    ; update ack from seq'
    state 0                 ; (link timer ack seq . msgs)
    part 4                  ; msgs seq ack timer link
    roll 3                  ; msgs seq timer link ack
    drop 1                  ; msgs seq timer link
    msg -2                  ; msgs seq timer link seq'
    roll -3                 ; msgs seq ack=seq' timer link

    ; ack queued message?
    pick 5                  ; msgs seq ack timer link msgs
    deque pop               ; ... msgs' (seq . content)
    part 1                  ; ... msgs' content seq
    msg 2                   ; ... msgs' content seq ack'
    cmp eq                  ; ... msgs' content seq==ack'
    if tx_ack_1             ; msgs seq ack timer link msgs' content
    drop 2                  ; msgs seq ack timer link
    ref tx_ack_2

tx_ack_1:                   ; msgs seq ack timer link msgs' content
    ; remove message from queue
    drop 1                  ; msgs seq ack timer link msgs'
    roll -5                 ; ... msgs' seq ack timer link

    ; if the queue is not empty,
    pick 5                  ; ... msgs' seq ack timer link msgs'
    deque empty             ; ... msgs' seq ack timer link is_empty(msgs)
    if tx_ack_2             ; ... msgs' seq ack timer link

    ; then send another message to rx
    pick 5                  ; ... msgs' seq ack timer link msgs'
    deque pop               ; ... msgs' seq ack timer link msgs'' (seq . content)
    pick 5                  ; ... msgs' seq ack timer link msgs'' (seq . content) ack
    pair 1                  ; ... msgs' seq ack timer link msgs'' (ack seq . content)
    pick 3                  ; ... msgs' seq ack timer link msgs'' (ack seq . content) link
    actor send              ; ... msgs' seq ack timer link msgs''
    drop 1                  ; ... msgs' seq ack timer link

tx_ack_2:                   ; msgs seq ack timer link
    ; update tx state
    pair 4                  ; tx_state=(link timer ack seq . msgs)
    push tx_beh             ; tx_state tx_beh
    actor become            ; --
    ref std.commit

tx_tmo_tail:                ; (link timer ack seq . msgs) <- (tx_tmo . seq')
    ; reset timer
    state 4                 ; seq
    push tx_tmo             ; seq tx_tmo
    pair 1                  ; msg=(tx_tmo . seq)
    actor self              ; msg target=SELF
    push tx_timeout         ; msg target delay=tx_timeout
    pair 2                  ; timer_req=(delay target . msg)
    state 2                 ; timer_req timer
    actor send              ; --

    ; check timer message number
    state 4                 ; seq
    msg -1                  ; seq seq'
    cmp eq                  ; seq==seq'
    if_not std.commit       ; --

tx_tmo_1:
    ; check for empty queue
    state 5                 ; msgs
    deque empty             ; is_empty(msgs)
    if_not tx_tmo_2         ; --

    ; send empty message
    push #?                 ; #?
    push tx_msg             ; #? tx_msg
    pair 1                  ; (tx_msg . #?)
    actor self              ; (tx_msg . #?) SELF
    actor send              ; --
    ref std.commit

tx_tmo_2:
    ; resend queued message
    state 5                 ; msgs
    deque pop               ; msgs (seq . content)
    state 3                 ; msgs (seq . content) ack
    pair 1                  ; msgs (ack seq . content)
    state 1                 ; msgs (ack seq . content) link
    ref std.send_msg

;
; Link receiver
;
; Receiver state:
;   cust: capability for local delivery
;   timer: capability for timer service
;   tx: capability for tx
;   seq: next message number expected (to receive)
;

rx_beh:                     ; (cust timer tx . seq) <- #? | (ack seq' . content)
    msg 0                   ; msg
    eq #?                   ; msg==#?
    if_not rx_1

    ; timeout
    state 0                 ; state
    push lost_rx_beh        ; state lost_rx_beh
    actor become            ; --

    ; reset timer
    push #?                 ; msg=#?
    actor self              ; msg target=SELF
    push rx_timeout         ; msg target delay=rx_timeout
    pair 2                  ; timer_req=(delay target . msg)
    state 2                 ; timer_req timer
    actor send              ; --
    ref std.commit

rx_1:
    ; check inbound message number
    state -3                ; seq
    msg 2                   ; seq seq'
    cmp eq                  ; seq==seq'
    if_not std.commit       ; // ignore unexpected message

rx_2:
    ; forward ack to tx
    msg 2                   ; seq'
    msg 1                   ; seq' ack
    push tx_ack             ; seq' ack tx_ack
    pair 2                  ; (tx_ack ack . seq')
    state 3                 ; (tx_ack ack . seq') tx
    actor send              ; --

    ; increment expected message number
    state -3                ; seq
    push 1                  ; seq 1
    alu add                 ; seq+1
    state 3                 ; seq+1 tx
    state 2                 ; seq+1 tx timer
    state 1                 ; seq+1 tx timer cust
    pair 3                  ; (cust timer tx . seq+1)
    push rx_beh             ; (cust timer tx . seq+1) rx_beh
    actor become            ; --

    ; forward message to cust
    msg -2                  ; content
    dup 1                   ; content content
    eq #?                   ; content content==#?
    if std.commit           ; content  // drop empty message
    state 1                 ; content cust
    ref std.send_msg

; One timeout has occurred. Another means disconnect.

lost_rx_beh:                ; (cust timer tx . seq) <- #? | (ack seq' . content)
    msg 0                   ; msg
    eq #?                   ; msg==#?
    if_not lost_rx_1

    ; timeout
    push #?                 ; #?
    push std.sink_beh       ; #? sink_beh
    actor become            ; --  // become inert
    push #?                 ; #?
    state 3                 ; #? tx
    actor send              ; --  // stop transmitter
    push #?                 ; #?
    state 1                 ; #? cust
    actor send              ; --  // lost signal
    ref std.commit

lost_rx_1:
    ; check inbound message number
    state -3                ; seq
    msg 2                   ; seq seq'
    cmp eq                  ; seq==seq'
    if rx_2                 ; --

    ; ignore unexpected message (but recover)
    state 0                 ; state
    push rx_beh             ; state rx_beh
    actor become            ; --
    ref std.commit

.export
    tx_msg
    tx_ack
    tx_tmo
    tx_timeout
    rx_timeout
    tx_beh
    rx_beh
