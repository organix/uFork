;
; peer chat demo
;

.import
    std: "/lib/std.asm"
    dev: "/lib/dev.asm"

room_key:
    ref 1000

; Start initial services.

start:                  ; (debug_dev io_dev timer_dev room_id) <- ()

; The petname of the party hosting the room is passed in the boot capabilities.
; If it is 0, the room is local and we are hosting it. Otherwise the room is
; remote and we are joining it.

    state 4             ; room_id
    if join host        ; room_id debug_dev

; For now, just send the room id to the debug device.

join:                   ; --
    state 4             ; room_id
    state 1             ; room_id debug_dev
    ref std.send_msg

; SELF will become the party tx actor (circular anchor)

host:                   ; --
    ; build line out
    state 2             ; io_dev
    push line_out       ; io_dev line_out
    new 1               ; l_out=line_out.(io_dev)

    ; build party out
    push party_out      ; l_out party_out
    new 1               ; p_out=party_out.(l_out)

    ; build party rx
    push 1              ; p_out seq=1
    my self             ; p_out seq tx=SELF
    state 3             ; p_out seq tx timer=timer_dev
    roll 4              ; seq tx timer cust=p_out
    push link_rx        ; seq tx timer cust link_rx
    new 4               ; p_rx=link_rx.(cust timer tx seq)

    ; build room tx
    deque new           ; p_rx msgs
    push 1              ; p_rx msgs seq=1
    push 0              ; p_rx msgs seq ack=0
    state 3             ; p_rx msgs seq ack timer=timer_dev
    roll 5              ; msgs seq ack timer link=p_rx
    push link_tx        ; msgs seq ack timer link link_tx
    new 5               ; r_tx=link_tx.(link timer ack seq msgs)

    ; build room
    push #nil           ; r_tx parties={}
    push room           ; r_tx parties={} room
    new -1              ; r_tx room.{parties}
;room:                   ; {party:tx, ...parties} <- (tx party . content) | (tx party)

    ; build room in
    pick 2              ; r_tx room tx=r_tx
    push 0              ; r_tx room tx party=0
    push room_in        ; r_tx room tx party room_in
    new 3               ; r_tx in=room_in.(room tx party)
;room_in:                ; (room tx party) <- content

    ; build room rx
    push 1              ; r_tx in seq=1
    roll 3              ; in seq tx=r_tx
    state 3             ; in seq tx timer=timer_dev
    roll 4              ; seq tx timer cust=in
    push link_rx        ; seq tx timer cust link_rx
    new 4               ; r_rx=link_rx.(cust timer tx seq)

    ; become party tx
    deque new           ; r_rx msgs
    push 1              ; r_rx msgs seq=1
    push 0              ; r_rx msgs seq ack=0
    state 3             ; r_rx msgs seq ack timer=timer_dev
    roll 5              ; msgs seq ack timer link=r_rx
    push link_tx        ; msgs seq ack timer link link_tx
    beh 5               ; --  // link_tx.(link timer ack seq msgs)

    ; build party in
    my self             ; p_tx=SELF
    push party_in       ; p_tx party_in
    new 1               ; p_in=party_in.(p_tx)

    ; build line in
    deque new           ; p_in line
    state 2             ; p_in line io_dev
    roll 3              ; line io_dev cust=p_in
    push line_in        ; line io_dev cust line_in
    new 3               ; callback=line_in.(cust io_dev line)

    ; register read callback
    push #?             ; callback to_cancel=#?
    state 2             ; callback to_cancel io_dev
    send 2              ; --

    ref std.commit

party_in:               ; (tx) <- content
    msg 0               ; content
    push tx_msg         ; content tx_msg
    pair 1              ; (tx_msg . content)
    state 1             ; (tx_msg . content) tx
    ref std.send_msg

party_out:              ; (l_out) <- (party . content)
    msg -1              ; content
    state 1             ; content l_out
    ref std.send_msg

room_in:                ; (room tx party) <- content
    msg 0               ; content
    state 2             ; content tx
    state 3             ; content tx party
    pair 2              ; (tx party . content)
    state 1             ; (tx party . content) room
    ref std.send_msg

;
; Link transmitter
;
; Transmitter state:
;   link: capability for network transport
;   timer: capability for timer service
;   ack: last message number successfully received (by rx)
;   seq: next message number to transmit
;   msgs: queue of unackowledged messages
;

tx_msg:                 ; (tx_msg . content)
    ref 1
tx_ack:                 ; (tx_ack ack' seq')
    ref -1
tx_time:                ; (tx_time seq')
    ref 0

link_tx:                ; (link timer ack seq msgs) <- tx_evt
    msg 1               ; opr
    eq tx_msg           ; opr==tx_msg
    if link_tx_msg      ; --
    msg 1               ; opr
    eq tx_ack           ; opr==tx_ack
    if link_tx_ack      ; --
    msg 1               ; opr
    eq tx_time          ; opr==tx_time
    if link_tx_time     ; --
    ref std.abort       ; // unknown operation

link_tx_msg:            ; (link timer ack seq msgs) <- (tx_msg . content)
    ; add message to queue
    state 5             ; msgs
    msg -1              ; msgs content
    state 4             ; msgs content seq
    pair 1              ; msgs (seq . content)
    deque put           ; msgs'

    ; increment seq number
    dup 1               ; msgs' msgs'
    state 4             ; msgs' msgs' seq
    push 1              ; msgs' msgs' seq 1
    alu add             ; msgs' msgs' seq+1

    ; update actor state
    state 3             ; msgs' msgs' seq+1 ack
    state 2             ; msgs' msgs' seq+1 ack timer
    state 1             ; msgs' msgs' seq+1 ack timer link
    my beh              ; msgs' msgs' seq+1 ack timer link beh
    beh 5               ; msgs'

    ; if the queue was empty previously,
    state 5             ; msgs' msgs
    deque empty         ; msgs' is_empty(msgs)
    if_not std.commit   ; msgs'

    ; then send message to rx
    deque pop           ; msgs (seq . content)
    state 3             ; msgs (seq . content) ack
    pair 1              ; msgs (ack seq . content)
    state 1             ; msgs (ack seq . content) link
    ref std.send_msg

link_tx_ack:            ; (link timer ack seq msgs) <- (tx_ack ack' seq')
    ; update ack from seq'
    my state            ; msgs seq ack timer link
    roll 3              ; msgs seq timer link ack
    drop 1              ; msgs seq timer link
    msg 3               ; msgs seq timer link seq'
    roll -3             ; msgs seq ack=seq' timer link

    ; ack queued message?
    pick 5              ; msgs seq ack timer link msgs
    deque pop           ; ... msgs' (seq . content)
    part 1              ; ... msgs' content seq
    msg 2               ; ... msgs' content seq ack'
    cmp eq              ; ... msgs' content seq==ack'
    if tx_ack_1         ; msgs seq ack timer link msgs' content
    drop 2              ; msgs seq ack timer link
    ref tx_ack_2

tx_ack_1:               ; msgs seq ack timer link msgs' content
    ; remove message from queue
    drop 1              ; msgs seq ack timer link msgs'
    roll -5             ; ... msgs' seq ack timer link

    ; if the queue is not empty,
    pick 5              ; ... msgs' seq ack timer link msgs'
    deque empty         ; ... msgs' seq ack timer link is_empty(msgs)
    if tx_ack_2         ; ... msgs' seq ack timer link

    ; then send another message to rx
    deque pop           ; ... msgs'' (seq . content)
    state 3             ; ... msgs'' (seq . content) ack
    pair 1              ; ... msgs'' (ack seq . content)
    state 1             ; ... msgs'' (ack seq . content) link
    send -1             ; ... msgs''
    drop 1              ; ... msgs' seq ack timer link

tx_ack_2:               ; msgs seq ack timer link
    ; update tx state
    my beh              ; msgs seq ack timer link beh
    beh 5               ; --
    ref std.commit

link_tx_time:           ; (link timer ack seq msgs) <- (tx_time seq')
    ; check timer message number
    state 4             ; seq
    msg 2               ; seq seq'
    cmp eq              ; seq==seq'
    if tx_time_1        ; --

    ; reset timer
    push #nil           ; ()
    state 4             ; () seq
    push tx_time        ; () seq tx_time
    pair 2              ; msg=(tx_time seq)
    my self             ; msg target=SELF
    push 1000           ; msg target delay=1000ms
    state 2             ; msg target delay timer
    send 3              ; --
    ref std.commit

tx_time_1:
    ; check for empty queue
    state 5             ; msgs
    deque empty         ; is_empty(msgs)
    if_not tx_time_2    ; --

    ; send empty message
    push tx_msg         ; tx_msg
    my self             ; tx_msg SELF
    send 1              ; --
    ref std.commit

tx_time_2:
    ; resend queued message
    state 5             ; msgs
    deque pop           ; msgs (seq . content)
    state 3             ; msgs (seq . content) ack
    pair 1              ; msgs (ack seq . content)
    state 1             ; msgs (ack seq . content) link
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

link_rx:                ; (cust timer tx seq) <- (ack seq' . content)
    ; check inbound message number
    state 4             ; seq
    msg 2               ; seq seq'
    cmp eq              ; seq==seq'
    if_not std.commit   ; // ignore unexpected message

    ; forward ack to tx
    msg 2               ; seq'
    msg 1               ; seq' ack
    push tx_ack         ; seq' ack tx_ack
    state 3             ; seq' ack tx_ack tx
    send 3              ; --

    ; increment expected message number
    state 4             ; seq
    push 1              ; seq 1
    alu add             ; seq+1
    state 3             ; seq+1 tx
    state 2             ; seq+1 tx timer
    state 1             ; seq+1 tx timer cust
    my beh              ; seq+1 tx timer cust beh
    beh 4               ; --

    ; forward message to cust
    msg -2              ; content
    state 1             ; content cust
    ref std.send_msg

;
; Chat room (central mediator)
;

room:                   ; {party:tx, ...parties} <- (tx party . content) | (tx party)
    msg -2              ; content
    if_not room_del     ; --

    ; check for new party...
    state 0             ; {parties}
    msg 2               ; {parties} party
    dict has            ; known?
    if_not room_add     ; --

    msg -1              ; (party . content)
    state 0             ; (party . content) {parties}

room_cast:              ; msg=(party . content) {parties}
    ; broadcast message to room
    dup 1               ; msg {parties} {parties}
    typeq #dict_t       ; msg {parties} is_dict({parties})
    if_not std.commit   ; msg {parties}  // done broadcasting...

    dup 1               ; msg {parties} {parties}
    get Y               ; msg {parties} tx
    pick 3              ; msg {parties} tx msg
    roll 2              ; msg {parties} msg tx
    send -1             ; msg {parties}
    get Z               ; msg rest
    ref room_cast

room_add:               ; --
    ; add party to room
    state 0             ; {parties}
    msg 2               ; {parties} party
    msg 1               ; {parties} party tx
    dict add            ; {party:tx, ...parties}

    ; update room state
    dup 1               ; {parties'} {parties'}
    my beh              ; {parties'} {parties'} beh
    beh -1              ; {parties'}

    ; broadcast to updated parties
    msg -1              ; {parties'} (party . content)
    roll 2              ; (party . content) {parties'}
    ref room_cast

room_del:               ; --
    ; delete party from room
    state 0             ; {party:tx, ...parties}
    msg 2               ; {party:tx, ...parties} party
    dict del            ; {parties'}

    ; update room state
    dup 1               ; {parties'} {parties'}
    my beh              ; {parties'} {parties'} beh
    beh -1              ; {parties'}

    ; broadcast "left" announcement
    push txt_left       ; {parties'} txt_left
    msg 2               ; {parties'} txt_left party
    pair 1              ; {parties'} (party . txt_left)
    roll 2              ; (party . txt_left) {parties'}
    ref room_cast

txt_joined:
    pair_t 'J'
    pair_t 'O'
    pair_t 'I'
    pair_t 'N'
    pair_t 'E'
    pair_t 'D'
    pair_t '.'
    pair_t '\n'
    ref #nil

txt_left:
    pair_t 'L'
    pair_t 'E'
    pair_t 'F'
    pair_t 'T'
    pair_t '.'
    pair_t '\n'
    ref #nil

;
; Line buffer and utilities
;

; An infinite loop will consume cycles, but no memory or events

loop_forever:
    dup 0 loop_forever

; The "ticker" sends itself an incrementing number forever.

ticker:                 ; () <- n
    msg 0               ; n
    push 1              ; n 1
    alu add             ; n+1
    my self             ; n+1 SELF
    ref std.send_msg    ; --

; Accumulate characters one-at-a-time until '\n'.
; When a `line` is complete, send it to `cust`.

line_in:                ; (cust io_dev line) <- result
    ; check for error
    msg -1              ; error
    if std.commit       ; --

    ; request next char
    my self             ; callback=SELF
    push #?             ; callback to_cancel=#?
    state 2             ; callback to_cancel io_dev
    send 2              ; --

    ; add char to line
    state 3             ; line
    msg 1               ; line char
    deque put           ; line'

    ; check for newline
    msg 1               ; line' char
    eq '\n'             ; line' char=='\n'
    if_not line_upd     ; line'

    ; send line to cust
    state 1             ; line' cust
    send -1             ; --
    deque new           ; line

line_upd:               ; line'
    ; update state
    state 2             ; line' io_dev
    state 1             ; line' io_dev cust
    my beh              ; line' io_dev cust beh
    beh 3               ; --
    ref std.commit

; Buffer lines of output, sending characters one-at-a-time.
; Initially, no current line or lines to send.

line_out:               ; (io_dev) <- result | line'
    ; distinguish result from line'
    msg 1               ; first
    eq #unit            ; first==#unit
    if std.commit       ; --  // unexpected result!

    ; extract char from line
    msg 0               ; line
    deque pop           ; line' char

line_snd:               ; line' char
    ; send char to output
    my self             ; line' char callback=SELF
    push #?             ; line' char callback to_cancel=#?
    state 1             ; line' char callback to_cancel io_dev
    send 3              ; line'

    ; line empty?
    dup 1               ; line' line'
    deque empty         ; line' is_empty(line')
    if_not line_rem     ; line'

    ; no more chars in line
    state 1             ; ... io_dev
    push line_out       ; ... io_dev line_out
    beh 1               ; --
    ref std.commit

line_rem:               ; line'
    ; chars remaining in line
    state 1             ; line' io_dev
    push line_buf       ; line' io_dev line_buf
    beh 2               ; --
    ref std.commit

; Writing current line, no additional lines buffered.

line_buf:               ; (io_dev line) <- result | line'
    ; distinguish result from line'
    msg 1               ; first
    eq #unit            ; first==#unit
    if_not line_add     ; --

    ; extract char from line
    state 2             ; line
    deque pop           ; line' char
    ref line_snd

line_add:               ; --
    ; additional buffered lines
    deque new           ; lines
    msg 0               ; lines line
    deque put           ; lines'
    my state            ; lines' line io_dev
    push line_bufs      ; lines' line io_dev line_bufs
    beh 3               ; --
    ref std.commit

; Writing current line, one or more lines buffered.

line_bufs:              ; (io_dev line lines) <- result | line'
    ; distinguish result from line'
    msg 1               ; first
    eq #unit            ; first==#unit
    if line_chr         ; --

    ; add line' to lines
    state 3             ; lines
    msg 0               ; lines line
    deque put           ; lines'
    state 2             ; lines' line
    state 1             ; lines' line io_dev
    push line_bufs      ; lines' line io_dev line_bufs
    beh 3               ; --
    ref std.commit

line_chr:               ; --
    ; extract char from line
    state 2             ; line
    deque pop           ; line char

    ; send char to output
    my self             ; line char callback=SELF
    push #?             ; line char callback to_cancel=#?
    state 1             ; line char callback to_cancel io_dev
    send 3              ; line

    ; line empty?
    dup 1               ; line line
    deque empty         ; line is_empty(line)
    if_not line_chrs    ; line

    ; get next line
    drop 1              ; --
    state 3             ; lines
    deque pop           ; lines line
    pick 2              ; lines line lines
    deque empty         ; lines line is_empty(lines)
    if_not line_more    ; lines line

    ; no more lines
    state 1             ; lines line io_dev
    push line_buf       ; lines line io_dev line_buf
    beh 2               ; lines
    ref std.commit

line_chrs:              ; line
    ; update state
    state 3             ; line lines
    roll -2             ; lines line

line_more:              ; lines line
    state 1             ; lines line io_dev
    push line_bufs      ; lines line io_dev line_bufs
    beh 3               ; --
    ref std.commit

; Capture required boot capabilities.

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push room_key       ; {caps} room_key
    dict get            ; room_id

    msg 0               ; room_id {caps}
    push dev.timer_key  ; room_id {caps} timer_key
    dict get            ; room_id timer_dev

    msg 0               ; room_id timer_dev {caps}
    push dev.io_key     ; room_id timer_dev {caps} io_key
    dict get            ; room_id timer_dev io_dev

    msg 0               ; room_id timer_dev io_dev {caps}
    push dev.debug_key  ; room_id timer_dev io_dev {caps} debug_key
    dict get            ; room_id timer_dev io_dev debug_dev

    push start          ; room_id timer_dev io_dev debug_dev start
    new 3               ; start.(debug_dev io_dev timer_dev room_id)
    send 0              ; --
    ref std.commit

.export
    boot
