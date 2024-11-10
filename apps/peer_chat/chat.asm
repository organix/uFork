;
; peer chat demo
;

.import
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"
    line_buf: "https://ufork.org/lib/line_buffer.asm"
    link: "./link.asm"

awp_store:
    ref 0
awp_petname:
    ref 0
room_key:
    ref 1000

; Capture the required boot capabilities, then start the app by joining or
; hosting a room.

; The petname of the AWP party hosting the room (the room_id) is passed in the
; boot capabilities. If it is 0, the room is local and we are hosting it.
; Otherwise the room is remote and we are joining it.

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push room_key           ; {caps} room_key
    dict get                ; room_id
    dup 1                   ; room_id room_id

    msg 0                   ; room_id room_id {caps}
    push dev.awp_key        ; room_id room_id {caps} awp_key
    dict get                ; room_id room_id awp_dev

    msg 0                   ; room_id room_id awp_dev {caps}
    push dev.timer_key      ; room_id room_id awp_dev {caps} timer_key
    dict get                ; room_id room_id awp_dev timer_dev

    msg 0                   ; room_id room_id awp_dev timer_dev {caps}
    push dev.io_key         ; room_id room_id awp_dev timer_dev {caps} io_key
    dict get                ; room_id room_id awp_dev timer_dev io_dev

    msg 0                   ; room_id room_id awp_dev timer_dev io_dev {caps}
    push dev.debug_key      ; room_id room_id awp_dev timer_dev io_dev {caps} debug_key
    dict get                ; room_id room_id awp_dev timer_dev io_dev debug_dev

    pair 4                  ; room_id state=(debug_dev io_dev timer_dev awp_dev . room_id)
    roll 2                  ; state room_id
    if join                 ; state
    push host_beh           ; state beh=host_beh
    ref start
join:
    push join_beh           ; state beh=join_beh
start:
    actor create            ; beh.state
    push #?                 ; beh.state #?
    roll 2                  ; #? beh.state
    actor send              ; --
    ref std.commit

; Initially, SELF is the callback for the AWP introduction with the room. If
; that succeeds, it becomes party_rx.

join_beh:                   ; (debug_dev io_dev timer_dev awp_dev . room_id) <- #? | (ok . room_rx/error)
    msg 0                   ; msg
    eq #?                   ; msg==#?
    if_not intro_cb         ; --
    actor self              ; party_rx=SELF

    ; build room->party message-limited transport
    ; push 17             ; rcvr=party_rx limit=17
    ; pair 1              ; (limit . rcvr)
    ; push cnt_fwd_beh    ; (limit . rcvr) cnt_fwd_beh
    ; actor create        ; party_rx'=cnt_fwd_beh.(limit . rcvr)

    ; build room->party logger
    state 1                 ; rcvr=party_rx logr=debug_dev
    pair 1                  ; (logr . rcvr)
    push log_fwd_beh        ; (logr . rcvr) log_fwd_beh
    actor create            ; party_rx'=log_fwd_beh.(logr . rcvr)

    ; request an introduction with the room
    dup 1                   ; party_rx party_rx
    state -4                ; party_rx party_rx petname=room_id
    push awp_store          ; party_rx party_rx petname store
    roll 4                  ; party_rx petname store callback=party_rx
    push #?                 ; party_rx petname store callback to_cancel=#?
    push dev.intro_tag      ; party_rx petname store callback to_cancel #intro
    pair 5                  ; intro_req=(#intro to_cancel callback store petname . party_rx)
    state 4                 ; intro_req awp_dev
    ref std.send_msg

intro_cb:
    ; check for a successful introduction
    msg 1                   ; ok
    assert #t               ; --

    ; build party_tx
    deque new               ; msgs
    push 1                  ; msgs seq=1
    push 0                  ; msgs seq ack=0
    state 3                 ; msgs seq ack timer=timer_dev
    msg -1                  ; msgs seq ack timer link=room_rx
    pair 4                  ; (link timer ack seq . msgs)
    push link.tx_beh        ; (link timer ack seq . msgs) link_tx_beh
    actor create            ; party_tx=link_tx_beh.(link timer ack seq . msgs)

    ; set party_tx_timer
    push 1                  ; party_tx seq=1
    push link.tx_tmo        ; party_tx seq tx_tmo
    pair 1                  ; party_tx msg=(tx_tmo . seq)
    pick 2                  ; party_tx msg target=party_tx
    push link.tx_timeout    ; party_tx msg target delay=tx_timeout
    pair 2                  ; party_tx timer_req=(delay target . msg)
    state 3                 ; party_tx timer_req timer_dev
    actor send              ; party_tx

    ; build line_out
    state 2                 ; party_tx io_dev
    push line_buf.out_beh   ; party_tx io_dev line_out_beh
    actor create            ; party_tx line_out=line_out_beh.io_dev

    ; build party_out
    push party_out_beh      ; party_tx line_out party_out_beh
    actor create            ; party_tx party_out=party_out_behline_out

    ; become party_rx
    push 1                  ; party_tx party_out seq=1
    pick 3                  ; party_tx party_out seq tx=party_tx
    state 3                 ; party_tx party_out seq tx timer=timer_dev
    roll 4                  ; party_tx seq tx timer cust=party_out
    pair 3                  ; party_tx (cust timer tx . seq)
    push link.rx_beh        ; party_tx (cust timer tx . seq) link_rx_beh
    actor become            ; party_tx // link_rx_beh.(cust timer tx . seq)

    ; set party_rx_timer
    push #?                 ; party_tx msg=#?
    actor self              ; party_tx msg target=SELF
    push link.rx_timeout    ; party_tx msg target delay=rx_timeout
    pair 2                  ; party_tx timer_req=(delay target . msg)
    state 3                 ; party_tx timer_req timer_dev
    actor send              ; party_tx

    ; build party_in
    push party_in_beh       ; party_tx party_in_beh
    actor create            ; party_in=party_in_beh.party_tx

    ; build line_in
    deque new               ; party_in line
    state 2                 ; party_in line io_dev
    roll 3                  ; line io_dev cust=party_in
    pair 2                  ; (cust io_dev . line)
    push line_buf.in_beh    ; (cust io_dev . line) line_in_beh
    actor create            ; callback=line_in_beh.(cust io_dev . line)

    ; register read callback
    push #?                 ; callback input=#?
    roll 2                  ; input callback
    push #?                 ; input callback to_cancel=#?
    pair 2                  ; io_req=(to_cancel callback . input)
    state 2                 ; io_req io_dev
    actor send              ; --

    ref std.commit

host_beh:                   ; (debug_dev io_dev timer_dev awp_dev . _) <- _
    ; build the room.
    push #nil               ; parties={}
    push room_beh           ; parties room_beh
    actor create            ; room=room_beh.{parties}

    ; build the greeter that introduces joining parties to the room
    state 3                 ; room timer_dev
    state 1                 ; room timer_dev debug_dev
    pair 2                  ; (debug_dev timer_dev . room)
    push greeter_beh        ; (debug_dev timer_dev . room) greeter_beh
    actor create            ; greeter=greeter_beh.(debug_dev timer_dev . room)

    ; join the room directly (not via the AWP device)
    state 0                 ; greeter state
    push join_beh           ; greeter state join_beh
    actor create            ; greeter party_rx=join_beh.state
    push awp_petname        ; greeter party_rx party=awp_petname
    pick 2                  ; greeter party_rx party callback=party_rx
    push #?                 ; greeter party_rx party callback to_cancel=#?
    pair 3                  ; greeter intro_result=(to_cancel callback party . party_rx)
    pick 2                  ; greeter intro_result greeter
    actor send              ; greeter

    ; listen for incoming connections
    push awp_store          ; greeter store
    push #?                 ; greeter store #?
    push listen_cb_beh      ; greeter store #? listen_cb_beh
    actor create            ; greeter store callback=listen_cb_beh.#?
    push #?                 ; greeter store callback to_cancel=#?
    push dev.listen_tag     ; greeter store callback to_cancel #listen
    pair 4                  ; listen_request=(#listen to_cancel callback store . greeter)
    state 4                 ; listen_request awp_dev
    actor send              ; --

    ref std.commit

listen_cb_beh:              ; _ <- (ok . stop/error)
    msg 1                   ; ok
    assert #t               ; --
    ref std.commit

greeter_beh:                ; (debug_dev timer_dev . room) <- (to_cancel callback party . party_rx)
    ; build room_tx
    deque new               ; msgs
    push 1                  ; msgs seq=1
    push 0                  ; msgs seq ack=0
    state 2                 ; msgs seq ack timer=timer_dev
    msg -3                  ; msgs seq ack timer link=party_rx
    pair 4                  ; (link timer ack seq . msgs)
    push link.tx_beh        ; (link timer ack seq . msgs) link_tx_beh
    actor create            ; room_tx=link_tx_beh.(link timer ack seq . msgs)

    ; set room_tx_timer
    push 1                  ; room_tx seq=1
    push link.tx_tmo        ; room_tx seq tx_tmo
    pair 1                  ; room_tx msg=(tx_tmo . seq)
    pick 2                  ; room_tx msg target=room_tx
    push link.tx_timeout    ; room_tx msg target delay=tx_timeout
    pair 2                  ; room_tx timer_req=(delay target . msg)
    state 2                 ; room_tx timer_req timer_dev
    actor send              ; room_tx

    ; build room_in
    msg 3                   ; room_tx party
    pick 2                  ; room_tx party tx=room_tx
    state -2                ; room_tx party tx room
    pair 2                  ; room_tx (room tx . party)
    push room_in_beh        ; room_tx (room tx . party) room_in_beh
    actor create            ; room_tx room_in=room_in_beh.(room tx . party)

    ; send "joined" announcement
    push txt_joined         ; room_tx room_in txt_joined
    pick 2                  ; room_tx room_in txt_joined room_in
    actor send              ; room_tx room_in

    ; build room_rx
    push 1                  ; room_tx room_in seq=1
    roll 3                  ; room_in seq tx=room_tx
    state 2                 ; room_in seq tx timer=timer_dev
    roll 4                  ; seq tx timer cust=room_in
    pair 3                  ; (cust timer tx . seq)
    push link.rx_beh        ; (cust timer tx . seq) link_rx_beh
    actor create            ; room_rx=link_rx_beh.(cust timer tx . seq)

    ; set room_rx_timer
    push #?                 ; room_rx msg=#?
    pick 2                  ; room_rx msg target=room_rx
    push link.rx_timeout    ; room_rx msg target delay=rx_timeout
    pair 2                  ; room_rx timer_req=(delay target . msg)
    state 2                 ; room_rx timer_req timer_dev
    actor send              ; room_rx

    ; build party->room message-limited transport
    ; push 13             ; rcvr=room_rx limit=13
    ; pair 1              ; (limit . rcvr)
    ; push cnt_fwd_beh    ; (limit . rcvr) cnt_fwd_beh
    ; actor create        ; room_rx'=cnt_fwd_beh.(limit . rcvr)

    ; build party->room logger
    state 1                 ; rcvr=room_rx logr=debug_dev
    pair 1                  ; (logr . rcvr)
    push log_fwd_beh        ; (logr . rcvr) log_fwd_beh
    actor create            ; room_rx'=log_fwd_beh.(logr . rcvr)

    ; complete the introduction
    push #t                 ; room_rx ok=#t
    pair 1                  ; result=(ok . room_rx)
    msg 2                   ; result callback
    actor send              ; --

    ref std.commit

party_in_beh:               ; tx <- content
    msg 0                   ; content
    push link.tx_msg        ; content tx_msg
    pair 1                  ; (tx_msg . content)
    state 0                 ; (tx_msg . content) tx
    ref std.send_msg

party_out_beh:              ; line_out <- (party . content)
    msg -1                  ; content
    msg 0                   ; content (party . content)
    if_not party_lost       ; content

    ; prepend the line with the host's petname for the party
    ; (the host is '@', the other participants are 'A', 'B', 'C', etc)
    push ' '                ; content ' '
    deque push              ; content
    push ':'                ; content ':'
    deque push              ; content
    push '@'                ; content '@'
    msg 1                   ; content '@' party
    alu add                 ; content petname_char
    deque push              ; content
    state 0                 ; content line_out
    ref std.send_msg

party_lost:
    push txt_lost           ; ... content=txt_lost
    state 1                 ; ... content line_out
    ref std.send_msg

room_in_beh:                ; (room tx . party) <- content
    msg 0                   ; content
    state -2                ; content party
    state 2                 ; content party tx
    pair 2                  ; (tx party . content)
    state 1                 ; (tx party . content) room
    ref std.send_msg

;
; Chat room (central mediator)
;

room_beh:                   ; {party:tx, ...parties} <- (tx party . content) | (tx party)
    msg -2                  ; content
    if_not room_del         ; --

    ; check for new party...
    state 0                 ; {parties}
    msg 2                   ; {parties} party
    dict has                ; known?
    if_not room_add         ; --

    msg -1                  ; (party . content)
    state 0                 ; (party . content) {parties}

room_cast:                  ; msg=(party . content) {parties}
    ; broadcast message to room
    dup 1                   ; msg {parties} {parties}
    typeq #dict_t           ; msg {parties} is_dict({parties})
    if_not std.commit       ; msg {parties}  // done broadcasting...

    quad -4                 ; msg next value key #dict_t
    drop 2                  ; msg next tx=value
    pick 3                  ; msg next tx msg
    push link.tx_msg        ; msg next tx msg tx_msg
    pair 1                  ; msg next tx (tx_msg . msg)
    roll 2                  ; msg next (tx_msg . msg) tx
    actor send              ; msg next
    ref room_cast

room_add:                   ; --
    ; add party to room
    state 0                 ; {parties}
    msg 2                   ; {parties} party
    msg 1                   ; {parties} party tx
    dict add                ; {party:tx, ...parties}

    ; update room state
    dup 1                   ; {parties'} {parties'}
    push room_beh           ; {parties'} {parties'} room_beh
    actor become            ; {parties'}

    ; broadcast to updated parties
    msg -1                  ; {parties'} (party . content)
    roll 2                  ; (party . content) {parties'}
    ref room_cast

room_del:                   ; --
    ; delete party from room
    state 0                 ; {party:tx, ...parties}
    msg 2                   ; {party:tx, ...parties} party
    dict del                ; {parties'}

    ; update room state
    dup 1                   ; {parties'} {parties'}
    push room_beh           ; {parties'} {parties'} room_beh
    actor become            ; {parties'}

    ; broadcast "left" announcement
    push txt_left           ; {parties'} txt_left
    msg 2                   ; {parties'} txt_left party
    pair 1                  ; {parties'} (party . txt_left)
    roll 2                  ; (party . txt_left) {parties'}
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

; Pass messages unchanged, but also copy to log.
; FIXME: could be a combination of `tee` and `label`...

log_fwd_beh:                ; (logr . rcvr) <- msg
    msg 0                   ; msg
    actor self              ; msg SELF
    pair 1                  ; (SELF . msg)  // label log entry
    state 1                 ; (SELF . msg) logr
    actor send              ; --
    msg 0                   ; msg
    state -1                ; msg rcvr
    ref std.send_msg

; Pass messages unchanged (a limited number of times).

cnt_fwd_beh:                ; (limit . rcvr) <- msg
    state 1                 ; limit
    push 0                  ; limit 0
    cmp gt                  ; limit>0
    if_not std.commit       ; --
    state -1                ; rcvr
    state 1                 ; rcvr limit
    push 1                  ; rcvr limit 1
    alu sub                 ; rcvr limit-1
    pair 1                  ; (limit-1 . rcvr)
    push cnt_fwd_beh        ; (limit-1 . rcvr) cnt_fwd_beh
    actor become            ; --
    msg 0                   ; msg
    state -1                ; msg rcvr
    ref std.send_msg

.export
    boot
