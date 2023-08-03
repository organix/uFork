;
; peer chat demo
;

.import
    std: "../../lib/std.asm"
    dev: "../../lib/dev.asm"

awp_store:
    ref 0
awp_petname:
    ref 0
room_key:
    ref 1000
tx_timeout:
    ref 1000            ; 1000ms
rx_timeout:
    ref 3000            ; 3sec

; Capture the required boot capabilities, then start the app by joining or
; hosting a room.

; The petname of the AWP party hosting the room (the room_id) is passed in the
; boot capabilities. If it is 0, the room is local and we are hosting it.
; Otherwise the room is remote and we are joining it.

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push room_key       ; {caps} room_key
    dict get            ; room_id

    msg 0               ; room_id {caps}
    push dev.awp_key    ; room_id {caps} awp_key
    dict get            ; room_id awp_dev

    msg 0               ; room_id awp_dev {caps}
    push dev.timer_key  ; room_id awp_dev {caps} timer_key
    dict get            ; room_id awp_dev timer_dev

    msg 0               ; room_id awp_dev timer_dev {caps}
    push dev.io_key     ; room_id awp_dev timer_dev {caps} io_key
    dict get            ; room_id awp_dev timer_dev io_dev

    msg 0               ; room_id awp_dev timer_dev io_dev {caps}
    push dev.debug_key  ; room_id awp_dev timer_dev io_dev {caps} debug_key
    dict get            ; room_id awp_dev timer_dev io_dev debug_dev

    pick 5              ; ... room_id
    if join             ; ...
    push host_beh       ; ... beh=host_beh
    ref start
join:
    push join_beh       ; ... beh=join_beh
start:
    new 5               ; beh.(debug_dev io_dev timer_dev awp_dev room_id)
    send 0              ; --
    ref std.commit

; Initially, SELF is the callback for the AWP introduction with the room. If
; that succeeds, it becomes party_rx.

join_beh:               ; (debug_dev io_dev timer_dev awp_dev room_id) <- () | (room_rx . error)
    msg 0               ; msg
    eq #nil             ; msg==()
    if_not intro_cb     ; --
    my self             ; party_rx=SELF

    ; build room->party message-limited transport
    ; push 17             ; rcvr=party_rx limit=17
    ; push cnt_fwd_beh    ; rcvr limit cnt_fwd_beh
    ; new 2               ; party_rx'=cnt_fwd_beh.(limit rcvr)

    ; build room->party logger
    state 1             ; rcvr=party_rx logr=debug_dev
    push log_fwd_beh    ; rcvr logr log_fwd_beh
    new 2               ; party_rx'=log_fwd_beh.(logr rcvr)

    ; request an introduction with the room
    dup 1               ; party_rx party_rx
    state 5             ; party_rx party_rx petname=room_id
    push awp_store      ; party_rx party_rx petname store
    roll 4              ; party_rx petname store callback=party_rx
    push #?             ; party_rx petname store callback #?
    push dev.intro_tag  ; party_rx petname store callback #? #intro
    state 4             ; party_rx petname store callback #? #intro awp_dev
    send 6              ; --

    ref std.commit

intro_cb:
    ; check for a successful introduction
    msg -1              ; error
    is_eq #nil          ; error==()!

    ; build party_tx
    deque new           ; msgs
    push 1              ; msgs seq=1
    push 0              ; msgs seq ack=0
    state 3             ; msgs seq ack timer=timer_dev
    msg 1               ; msgs seq ack timer link=room_rx
    push link_tx_beh    ; msgs seq ack timer link link_tx_beh
    new 5               ; party_tx=link_tx_beh.(link timer ack seq msgs)

    ; set party_tx_timer
    push #nil           ; party_tx ()
    push 1              ; party_tx () seq=1
    push tx_tmo         ; party_tx () seq tx_tmo
    pair 2              ; party_tx msg=(tx_tmo seq)
    pick 2              ; party_tx msg target=party_tx
    push tx_timeout     ; party_tx msg target delay=tx_timeout
    state 3             ; party_tx msg target delay timer_dev
    send 3              ; party_tx

    ; build line_out
    state 2             ; party_tx io_dev
    push line_out_beh   ; party_tx io_dev line_out_beh
    new 1               ; party_tx line_out=line_out_beh.(io_dev)

    ; build party_out
    push party_out_beh  ; party_tx line_out party_out_beh
    new 1               ; party_tx party_out=party_out_beh.(line_out)

    ; become party_rx
    push 1              ; party_tx party_out seq=1
    pick 3              ; party_tx party_out seq tx=party_tx
    state 3             ; party_tx party_out seq tx timer=timer_dev
    roll 4              ; party_tx seq tx timer cust=party_out
    push link_rx_beh    ; party_tx seq tx timer cust link_rx_beh
    beh 4               ; party_tx // link_rx_beh.(cust timer tx seq)

    ; set party_rx_timer
    push #unit          ; party_tx msg=#unit
    my self             ; party_tx msg target=SELF
    push rx_timeout     ; party_tx msg target delay=rx_timeout
    state 3             ; party_tx msg target delay timer_dev
    send 3              ; party_tx

    ; build party_in
    push party_in_beh   ; party_tx party_in_beh
    new 1               ; party_in=party_in_beh.(party_tx)

    ; build line_in
    deque new           ; party_in line
    state 2             ; party_in line io_dev
    roll 3              ; line io_dev cust=party_in
    push line_in_beh    ; line io_dev cust line_in_beh
    new 3               ; callback=line_in_beh.(cust io_dev line)

    ; register read callback
    push #?             ; callback to_cancel=#?
    state 2             ; callback to_cancel io_dev
    send 2              ; --

    ref std.commit

host_beh:               ; (debug_dev io_dev timer_dev awp_dev room_id) <- ()
    ; build the room.
    push #nil           ; parties={}
    push room_beh       ; parties={} room_beh
    new -1              ; room=room_beh.{parties}

    ; build the greeter that introduces joining parties to the room
    state 3             ; room timer_dev
    state 1             ; room timer_dev debug_dev
    push greeter_beh    ; room timer_dev debug_dev greeter_beh
    new 3               ; greeter=greeter_beh.(debug_dev timer_dev room)

    ; join the room directly (not via the AWP device)
    state 0             ; greeter state
    push join_beh       ; greeter state join_beh
    new -1              ; greeter party_rx=join_beh.state
    push awp_petname    ; greeter party_rx party=awp_petname
    pick 2              ; greeter party_rx party callback=party_rx
    push #?             ; greeter party_rx party callback to_cancel=#?
    pick 5              ; greeter party_rx party callback to_cancel greeter
    send 4              ; greeter

    ; listen for incoming connections
    push awp_store      ; greeter store
    push listen_cb_beh  ; greeter store listen_cb_beh
    new 0               ; greeter store callback=listen_cb_beh.()
    push #?             ; greeter store callback #?
    push dev.listen_tag ; greeter store callback #? #listen
    state 4             ; greeter store callback #? #listen awp_dev
    send 5              ; --

    ref std.commit

listen_cb_beh:          ; () <- (stop . error)
    msg -1              ; error
    is_eq #nil          ; error==()!
    ref std.commit

greeter_beh:            ; (debug_dev timer_dev room) <- (to_cancel callback party party_rx)
    ; build room_tx
    deque new           ; msgs
    push 1              ; msgs seq=1
    push 0              ; msgs seq ack=0
    state 2             ; msgs seq ack timer=timer_dev
    msg 4               ; msgs seq ack timer link=party_rx
    push link_tx_beh    ; msgs seq ack timer link link_tx_beh
    new 5               ; room_tx=link_tx_beh.(link timer ack seq msgs)

    ; set room_tx_timer
    push #nil           ; room_tx ()
    push 1              ; room_tx () seq=1
    push tx_tmo         ; room_tx () seq tx_tmo
    pair 2              ; room_tx msg=(tx_tmo seq)
    pick 2              ; room_tx msg target=room_tx
    push tx_timeout     ; room_tx msg target delay=tx_timeout
    state 2             ; room_tx msg target delay timer_dev
    send 3              ; room_tx

    ; build room_in
    msg 3               ; room_tx party
    pick 2              ; room_tx party tx=room_tx
    state 3             ; room_tx party tx room
    push room_in_beh    ; room_tx party tx room room_in_beh
    new 3               ; room_tx room_in=room_in_beh.(room tx party)

    ; send "joined" announcement
    push txt_joined     ; room_tx room_in txt_joined
    pick 2              ; room_tx room_in txt_joined room_in
    send -1             ; room_tx room_in

    ; build room_rx
    push 1              ; room_tx room_in seq=1
    roll 3              ; room_in seq tx=room_tx
    state 2             ; room_in seq tx timer=timer_dev
    roll 4              ; seq tx timer cust=room_in
    push link_rx_beh    ; seq tx timer cust link_rx_beh
    new 4               ; room_rx=link_rx_beh.(cust timer tx seq)

    ; set room_rx_timer
    push #unit          ; room_rx msg=#unit
    pick 2              ; room_rx msg target=room_rx
    push rx_timeout     ; room_rx msg target delay=rx_timeout
    state 2             ; room_rx msg target delay timer_dev
    send 3              ; room_rx

    ; build party->room message-limited transport
    ; push 13             ; rcvr=room_rx limit=13
    ; push cnt_fwd_beh    ; rcvr limit cnt_fwd_beh
    ; new 2               ; room_rx'=cnt_fwd_beh.(limit rcvr)

    ; build party->room logger
    state 1             ; rcvr=room_rx logr=debug_dev
    push log_fwd_beh    ; rcvr logr log_fwd_beh
    new 2               ; room_rx'=log_fwd_beh.(logr rcvr)

    ; complete the introduction
    msg 2               ; room_rx callback
    send 1              ; --

    ref std.commit

party_in_beh:           ; (tx) <- content
    msg 0               ; content
    push tx_msg         ; content tx_msg
    pair 1              ; (tx_msg . content)
    state 1             ; (tx_msg . content) tx
    ref std.send_msg

party_out_beh:          ; (line_out) <- (party . content)
    msg -1              ; content
    msg 0               ; content (party . content)
    if_not party_lost   ; content

    ; prepend the line with the host's petname for the party
    ; (the host is '@', the other participants are 'A', 'B', 'C', etc)
    push ' '            ; content ' '
    deque push          ; content
    push ':'            ; content ':'
    deque push          ; content
    push '@'            ; content '@'
    msg 1               ; content '@' party
    alu add             ; content petname_char
    deque push          ; content
    state 1             ; content line_out
    ref std.send_msg

party_lost:
    push txt_lost       ; ... content=txt_lost
    state 1             ; ... content line_out
    ref std.send_msg

room_in_beh:            ; (room tx party) <- content
    msg 0               ; content
    state 3             ; content party
    state 2             ; content party tx
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
;   msgs: queue of unacknowledged messages
;

tx_msg:                 ; (tx_msg . content)
    ref 1
tx_ack:                 ; (tx_ack ack' seq')
    ref -1
tx_tmo:                 ; (tx_tmo seq')
    ref 0

link_tx_beh:            ; (link timer ack seq msgs) <- tx_evt
    msg 1               ; opr
    eq tx_msg           ; opr==tx_msg
    if link_tx_msg      ; --
    msg 1               ; opr
    eq tx_ack           ; opr==tx_ack
    if link_tx_ack      ; --
    msg 1               ; opr
    eq tx_tmo           ; opr==tx_tmo
    if link_tx_tmo      ; --

    ; unknown operation
    push std.sink_beh   ; sink_beh  // become inert
    beh 0               ; --
    ref std.commit

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
    pick 5              ; ... msgs' seq ack timer link msgs'
    deque pop           ; ... msgs' seq ack timer link msgs'' (seq . content)
    pick 5              ; ... msgs' seq ack timer link msgs'' (seq . content) ack
    pair 1              ; ... msgs' seq ack timer link msgs'' (ack seq . content)
    pick 3              ; ... msgs' seq ack timer link msgs'' (ack seq . content) link
    send -1             ; ... msgs' seq ack timer link msgs''
    drop 1              ; ... msgs' seq ack timer link

tx_ack_2:               ; msgs seq ack timer link
    ; update tx state
    my beh              ; msgs seq ack timer link beh
    beh 5               ; --
    ref std.commit

link_tx_tmo:            ; (link timer ack seq msgs) <- (tx_tmo seq')
    ; reset timer
    push #nil           ; ()
    state 4             ; () seq
    push tx_tmo         ; () seq tx_tmo
    pair 2              ; msg=(tx_tmo seq)
    my self             ; msg target=SELF
    push tx_timeout     ; msg target delay=tx_timeout
    state 2             ; msg target delay timer
    send 3              ; --

    ; check timer message number
    state 4             ; seq
    msg 2               ; seq seq'
    cmp eq              ; seq==seq'
    if_not std.commit   ; --

tx_tmo_1:
    ; check for empty queue
    state 5             ; msgs
    deque empty         ; is_empty(msgs)
    if_not tx_tmo_2     ; --

    ; send empty message
    push tx_msg         ; tx_msg
    my self             ; tx_msg SELF
    send 1              ; --
    ref std.commit

tx_tmo_2:
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

link_rx_beh:            ; (cust timer tx seq) <- (ack seq' . content) | #unit
    msg 0               ; msg
    eq #unit            ; msg==#unit
    if_not link_rx_1

    ; timeout
    state 0             ; state
    push lost_rx_beh    ; state lost_rx_beh
    beh -1              ; --

    ; reset timer
    push #unit          ; msg=#unit
    my self             ; msg target=SELF
    push rx_timeout     ; msg target delay=rx_timeout
    state 2             ; msg target delay timer
    send 3              ; --
    ref std.commit

link_rx_1:
    ; check inbound message number
    state 4             ; seq
    msg 2               ; seq seq'
    cmp eq              ; seq==seq'
    if_not std.commit   ; // ignore unexpected message

link_rx_2:
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
    push link_rx_beh    ; seq+1 tx timer cust link_rx_beh
    beh 4               ; --

    ; forward message to cust
    msg -2              ; content
    dup 1               ; content content
    eq #nil             ; content content==()
    if std.commit       ; content  // drop empty message
    state 1             ; content cust
    ref std.send_msg

; One timeout has occurred. Another means disconnect.

lost_rx_beh:            ; (cust timer tx seq) <- (ack seq' . content) | #unit
    msg 0               ; msg
    eq #unit            ; msg==#unit
    if_not lost_rx_1

    ; timeout
    push std.sink_beh   ; sink_beh  // become inert
    beh 0               ; --
    state 3             ; tx  // stop transmitter
    send 0              ; --
    state 1             ; cust  // lost signal
    send 0              ; --
    ref std.commit

lost_rx_1:
    ; check inbound message number
    state 4             ; seq
    msg 2               ; seq seq'
    cmp eq              ; seq==seq'
    if link_rx_2        ; --

    ; ignore unexpected message (but recover)
    state 0             ; state
    push link_rx_beh    ; state link_rx_beh
    beh -1              ; --
    ref std.commit

;
; Chat room (central mediator)
;

room_beh:               ; {party:tx, ...parties} <- (tx party . content) | (tx party)
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
    push tx_msg         ; msg {parties} tx msg tx_msg
    pair 1              ; msg {parties} tx (tx_msg . msg)
    roll 2              ; msg {parties} (tx_msg . msg) tx
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
    pair_t str_joined #nil
str_joined:
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
    pair_t str_left #nil
str_left:
    pair_t 'L'
    pair_t 'E'
    pair_t 'F'
    pair_t 'T'
    pair_t '.'
    pair_t '\n'
    ref #nil

txt_lost:
    pair_t str_lost #nil
str_lost:
    pair_t 'D'
    pair_t 'I'
    pair_t 'S'
    pair_t 'C'
    pair_t 'O'
    pair_t 'N'
    pair_t 'N'
    pair_t 'E'
    pair_t 'C'
    pair_t 'T'
    pair_t 'E'
    pair_t 'D'
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

; Pass messages unchanged, but also copy to log.
; FIXME: could be a combination of `tee` and `label`...

log_fwd_beh:            ; (logr rcvr) <- msg
    msg 0               ; msg
    my self             ; msg SELF
    pair 1              ; (SELF . msg)  // label log entry
    state 1             ; (SELF . msg) logr
    send -1             ; --
    msg 0               ; msg
    state 2             ; msg rcvr
    ref std.send_msg

; Pass messages unchanged (a limited number of times).

cnt_fwd_beh:            ; (limit rcvr) <- msg
    state 1             ; limit
    push 0              ; limit 0
    cmp gt              ; limit>0
    if_not std.commit   ; --
    my state            ; rcvr limit
    push 1              ; rcvr limit 1
    alu sub             ; rcvr limit-1
    my beh              ; rcvr limit-1 beh
    beh 2               ; --
    msg 0               ; msg
    state 2             ; msg rcvr
    ref std.send_msg

; Accumulate characters one-at-a-time until '\n'.
; When a `line` is complete, send it to `cust`.

line_in_beh:            ; (cust io_dev line) <- result
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

line_out_beh:           ; (io_dev) <- result | line'
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
    push line_out_beh   ; ... io_dev line_out_beh
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

.export
    boot
