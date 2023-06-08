; A demonstration of the AWP device.

; Alice requests an introduction from Bob. Bob's greeter sends her a ping
; capability, to whom Alice sends a pong capability. Alice's pong actor
; eventually receives a message and prints it to the debug device.

.import
    dev: "./dev.asm"
    std: "./std.asm"

alice_address:
    ref 1111
bob_address:
    ref 2222

; Bob starts listening.

boot:                   ; () <- {caps}
    push greeter_beh    ; greeter_beh
    new 0               ; greeter
    push bob_address    ; greeter @bob
    msg 0               ; greeter @bob {caps}
    push listening_beh  ; greeter @bob {caps} listening_beh
    new -1              ; greeter @bob listening
    push #?             ; greeter @bob listening #?
    push dev.listen_tag ; greeter @bob listening #? #listen
    msg 0               ; greeter @bob listening #? #listen {caps}
    push dev.awp_key    ; greeter @bob listening #? #listen {caps} awp_key
    dict get            ; greeter @bob listening #? #listen awp_dev
    send 5              ; --
    ref std.commit

; Once Bob is successfully listening, Alice requests an introduction.

listening_beh:          ; {caps} <- (stop . reason)
    msg -1              ; reason
    is_eq #nil          ; --
    push 42             ; password
    push alice_address  ; password @alice
    push bob_address    ; password @alice @bob
    pair 1              ; password info=(@bob . @alice)
    state 0             ; password info {caps}
    push introduced_beh ; password info {caps} introduced_beh
    new -1              ; password info introduced
    push #?             ; password info introduced #?
    push dev.intro_tag  ; password info introduced #? #intro
    state 0             ; password info introduced #? #intro {caps}
    push dev.awp_key    ; password info introduced #? #intro {caps} awp_key
    dict get            ; password info introduced #? #intro awp_dev
    send 5              ; --
    ref std.commit

; Bob's greeter authenticates Alice (although authentication should really only
; occur at the transport layer) and responds with a ping capability.

greeter_beh:            ; () <- (cancel result connection_info password)
    msg 3               ; connection_info
    is_eq alice_address ; --
    msg 4               ; password
    is_eq 42            ; --
    push ping_beh       ; ping_beh
    new 0               ; ping
    msg 2               ; ping result
    send 1              ; --
    ref std.commit

; Alice sends the ping actor her own pong capability.

introduced_beh:         ; {caps} <- (ping . reason)
    msg -1              ; reason
    is_eq #nil          ; --
    state 0             ; {caps}
    push pong_beh       ; {caps} pong_beh
    new -1              ; pong
    msg 1               ; pong ping
    ref std.send_msg

; Bob's ping actor sends a message to the pong actor.

ping_beh:               ; () <- pong
    push #f             ; #f
    push #t             ; #f #t
    push #unit          ; #f #t #unit
    push #?             ; #f #t #unit #?
    push 123            ; #f #t #unit #? 123
    msg 0               ; #f #t #unit #? 123 pong
    send 5              ; --
    ref std.commit

; The pong actor sends the message to the debug device.

pong_beh:               ; {caps} <- message
    msg 0               ; msg
    state 0             ; message {caps}
    push dev.debug_key  ; message {caps} debug_key
    dict get            ; message debug_dev
    ref std.send_msg

.export
    boot
