; A behavior that delays the sending of a message to an actor.

; The initial stack holds the clock device. The message is a list containing the
; delay in millseconds, the target actor, and the message.

.import
    std: "./std.asm"
    dev: "./dev.asm"

; The timer actor begins by asking the clock device for the current time. The
; current time is stored as the start time.

beh:                    ; clock
    dup 1               ; clock clock
    msg 3               ; clock clock message
    msg 2               ; clock clock message target
    msg 1               ; clock clock message target delay
    push wait_beh       ; clock clock message target delay wait_beh
    beh 4               ; clock
    ref ask

wait_beh:               ; clock message target delay
    msg 0               ; clock message target delay start
    pick 5              ; clock message target delay start clock
    roll -6             ; clock clock message target delay start
    push poll_beh       ; clock clock message target delay start poll_beh
    beh 5               ; clock
    ref ask

; Once the start time is known, the actor repeatedly polls the clock device
; until the time elapsed exceeds the delay, at which point the message is sent
; to the target and polling ceases.

poll_beh:               ; clock message target delay start
    msg 0               ; clock message target delay start now
    roll 2              ; clock message target delay now start
    alu sub             ; clock message target delay elapsed
    cmp le              ; clock message target fire?
    if std.send_0       ; clock message target
    drop 2              ; clock
    ref ask

ask:                    ; clock
    my self             ; clock SELF
    pick 2              ; clock SELF clock
    ref std.send_0

; The demo simply delays the printing of the number 1729 to the debug device.

boot:                   ;
    msg 0               ; {caps}
    dup 1               ; {caps} {caps}
    push dev.debug_key  ; {caps} {caps} dev.debug_key
    dict get            ; {caps} debug_dev
    roll 2              ; debug_dev {caps}
    push dev.clock_key  ; debug_dev {caps} dev.clock_key
    dict get            ; debug_dev clock_dev
    push beh            ; debug_dev clock_dev timer_beh
    new 1               ; debug_dev timer
    push 1729           ; debug_dev timer message
    roll -3             ; message debug_dev timer
    push 3000           ; message debug_dev timer delay
    roll 2              ; message debug_dev delay timer
    send 3              ;
    ref std.commit

.export
    beh
    boot
