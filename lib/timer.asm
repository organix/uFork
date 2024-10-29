; The timer actor delays the sending of a message to an actor. It is merely a
; proof of concept - you should use the timer device where available.

; The timer actor is created with a reference to the clock device. It accepts a
; request that is a list containing the delay in milliseconds, the target actor,
; and the message.

; It can be used multiple times.

.import
    std: "./std.asm"
    dev: "./dev.asm"

; Initially, the actor has no awareness of time. A customer is created to
; receive the current time from the clock device.

beh:
timer_beh:                  ; clock <- (delay target . message)
    msg 0                   ; msg
    state 0                 ; msg clock
    pair 1                  ; (clock . msg)
    push cust_beh           ; (clock . msg) cust_beh
    actor create            ; cust
    state 0                 ; cust clock
    ref std.send_msg

; Once the current time is known, it is added to the delay to yield the end
; time.

cust_beh:                   ; (clock delay target . message) <- now
    state -3                ; message
    state 3                 ; message target
    msg 0                   ; message target now
    state 2                 ; message target now delay
    alu add                 ; message target end_time
    state 1                 ; message target end_time clock
    pair 3                  ; (clock end_time target . message)
    push poll_beh           ; (clock end_time target . message) poll_beh
    actor become            ; --
    my self                 ; SELF
    state 1                 ; SELF clock
    ref std.send_msg

; The clock device is then repeatedly polled until the end time is reached, at
; which point the message is sent to the target.

poll_beh:                   ; (clock end_time target . message) <- now
    msg 0                   ; now
    state 2                 ; now end_time
    alu sub                 ; (now-end_time)
    push 0                  ; (now-end_time) 0
    cmp ge                  ; expired?
    if_not retry            ; --

    state -3                ; message
    state 3                 ; message target
    ref std.send_msg

retry:                      ; (clock ...)
    my self                 ; SELF
    state 1                 ; SELF clock
    ref std.send_msg

; The demo simply delays the sending of the numbers 42 and 1729 to the debug
; device.

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} dev.debug_key
    dict get                ; debug_dev
    msg 0                   ; debug_dev {caps}
    push dev.clock_key      ; debug_dev {caps} dev.clock_key
    dict get                ; debug_dev clock_dev
    push timer_beh          ; debug_dev clock_dev timer_beh
    actor create            ; debug_dev timer
    push 42                 ; debug_dev timer 42
    pick 3                  ; debug_dev timer 42 debug_dev
    push 1000               ; debug_dev timer 42 debug_dev 1000
    pair 2                  ; debug_dev timer (1000 debug_dev . 42)
    pick 2                  ; debug_dev timer (1000 debug_dev . 42) timer
    actor send              ; debug_dev timer
    push 1729               ; debug_dev timer 1729
    pick 3                  ; debug_dev timer 1729 debug_dev
    push 2000               ; debug_dev timer 1729 debug_dev 2000
    pair 2                  ; debug_dev timer (2000 debug_dev . 1729)
    pick 2                  ; debug_dev timer (2000 debug_dev . 1729) timer
    actor send              ; debug_dev timer
    ref std.commit

.export
    beh
    boot
