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
    pair 4              ; (#listen #? listening @bob . greeter)
    msg 0               ; (#listen #? listening @bob . greeter) {caps}
    push dev.awp_key    ; (#listen #? listening @bob . greeter) {caps} awp_key
    dict get            ; (#listen #? listening @bob . greeter) awp_dev
    ref std.send_msg

; Once Bob is successfully listening, Alice requests an introduction.

listening_beh:          ; {caps} <- (stop . reason)
    msg -1              ; reason
    is_eq #?            ; --
    push 42             ; hello
    push alice_address  ; hello @alice
    push bob_address    ; hello @alice @bob
    pair 1              ; hello info=(@bob . @alice)
    state 0             ; hello info {caps}
    push introduced_beh ; hello info {caps} introduced_beh
    new -1              ; hello info introduced
    push #?             ; hello info introduced #?
    push dev.intro_tag  ; hello info introduced #? #intro
    pair 4              ; (#intro #? introduced info . hello)
    state 0             ; (#intro #? introduced info . hello) {caps}
    push dev.awp_key    ; (#intro #? introduced info . hello) {caps} awp_key
    dict get            ; (#intro #? introduced info . hello) awp_dev
    ref std.send_msg

; Bob's greeter authenticates Alice and responds with a ping capability.

greeter_beh:            ; () <- (cancel result connection_info . hello)
    msg 3               ; connection_info
    is_eq alice_address ; --
    msg -3              ; hello
    is_eq 42            ; --
    push #?             ; #?
    push ping_beh       ; #? ping_beh
    new 0               ; #? ping
    pair 1              ; (ping . #?)
    msg 2               ; (ping . #?) result
    ref std.send_msg

; Alice sends the ping actor her own pong capability.

introduced_beh:         ; {caps} <- (ping . reason)
    msg -1              ; reason
    is_eq #?            ; --
    state 0             ; {caps}
    push pong_beh       ; {caps} pong_beh
    new -1              ; pong
    msg 1               ; pong ping
    ref std.send_msg

; Bob's ping actor sends a message to the pong actor.

ping_beh:               ; () <- pong
    push #f             ; #f
    push #t             ; #f #t
    push #?             ; #f #t #?
    push 123            ; #f #t #? 123
    msg 0               ; #f #t #? 123 pong
    send 4              ; --
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
