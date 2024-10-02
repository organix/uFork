; A demonstration of the AWP device.

; Alice requests an introduction from Bob. Bob's greeter sends her a ping
; capability, to whom Alice sends a pong capability. Alice's pong actor
; eventually receives a message and prints it to the debug device.

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

; Alice is acquainted with Bob.

alice_store:
    ref 0
bob_petname:
    ref 1

; Bob is not acquainted with Alice.

bob_store:
    ref 1

; Bob starts listening.

boot:                       ; () <- {caps}
    push greeter_beh        ; greeter_beh
    new 0                   ; greeter
    push bob_store          ; greeter bob
    msg 0                   ; greeter bob {caps}
    push listening_beh      ; greeter bob {caps} listening_beh
    new -1                  ; greeter bob listening
    push #?                 ; greeter bob listening to_cancel=#?
    push dev.listen_tag     ; greeter bob listening to_cancel #listen
    msg 0                   ; greeter bob listening to_cancel #listen {caps}
    push dev.awp_key        ; greeter bob listening to_cancel #listen {caps} awp_key
    dict get                ; greeter bob listening to_cancel #listen awp_dev
    send 5                  ; --
    ref std.commit

; Once Bob is successfully listening, Alice requests an introduction.

listening_beh:              ; {caps} <- (stop . error)
    msg -1                  ; error
    assert #nil             ; --
    msg 1                   ; stop
    typeq #actor_t          ; actor?(stop)
    assert #t               ; --
    push 42                 ; hello
    push bob_petname        ; hello @bob
    push alice_store        ; hello @bob alice
    state 0                 ; hello @bob alice {caps}
    push introduced_beh     ; hello @bob alice {caps} introduced_beh
    new -1                  ; hello @bob alice introduced
    push #?                 ; hello @bob alice introduced to_cancel=#?
    push dev.intro_tag      ; hello @bob alice introduced to_cancel #intro
    state 0                 ; hello @bob alice introduced to_cancel #intro {caps}
    push dev.awp_key        ; hello @bob alice introduced to_cancel #intro {caps} awp_key
    dict get                ; hello @bob alice introduced to_cancel #intro awp_dev
    send 6                  ; --
    ref std.commit

; Bob's greeter authenticates Alice, checks that they have been acquainted, then
; responds with a ping capability.

greeter_beh:                ; () <- (cancel result petname hello)
    msg 4                   ; hello
    assert 42               ; --
    msg 3                   ; petname
    assert 1                ; --
    push ping_beh           ; ping_beh
    new 0                   ; ping
    msg 2                   ; ping result
    send 1                  ; --
    ref std.commit

; Alice sends the ping actor her own pong capability.

introduced_beh:             ; {caps} <- (ping . error)
    msg -1                  ; error
    assert #nil             ; --
    state 0                 ; {caps}
    push pong_beh           ; {caps} pong_beh
    new -1                  ; pong
    msg 1                   ; pong ping
    ref std.send_msg

; Bob's ping actor sends a message to the pong actor.

ping_beh:                   ; () <- pong
    push #f                 ; #f
    push #t                 ; #f #t
    push #?                 ; #f #t #?
    push 123                ; #f #t #? 123
    msg 0                   ; #f #t #? 123 pong
    send 4                  ; --
    ref std.commit

; The pong actor sends the message to the debug device.

pong_beh:                   ; {caps} <- message
    msg 0                   ; msg
    state 0                 ; message {caps}
    push dev.debug_key      ; message {caps} debug_key
    dict get                ; message debug_dev
    ref std.send_msg

.export
    boot
