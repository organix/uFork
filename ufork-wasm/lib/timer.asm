; The timer actor delays the sending of a message to an actor. It can be used
; multiple times.

; The timer actor's initial stack holds the clock device. It accepts a message
; that is a list containing the delay in milliseconds, the target actor, and the
; message.

.import
    std: "./std.asm"
    dev: "./dev.asm"

; Initially, the actor has no awareness of time. A customer is created to
; receive the current time from the clock device.

beh:                    ; clock                        <- (delay target message)
    msg 3               ; clock message
    msg 2               ; clock message target
    pair 1              ; clock (target . message)
    pick 2              ; clock (target . message) clock
    msg 1               ; clock (target . message) clock delay
    push cust_beh       ; clock (target . message) clock delay cust_beh
    new 3               ; clock cust
    pick 2              ; clock cust clock
    ref std.send_0

; Once the current time is known, it is added to the delay to yield the end
; time.

cust_beh:               ; (target . message) clock delay                  <- now
    msg 0               ; ... now
    pick 2              ; ... now delay
    alu add             ; ... end_time
    pick 4              ; ... end_time (target . message)
    roll 2              ; ... (target . message) end_time
    pick 4              ; ... (target . message) end_time clock
    push poll_beh       ; ... (target . message) end_time clock poll_beh
    beh 3               ; ...
    my self             ; ... SELF
    pick 3              ; ... SELF clock
    ref std.send_0

; The clock device is then repeatedly polled until the end time is reached, at
; which point the message is sent to the target.

poll_beh:               ; (target . message) end_time clock               <- now
    msg 0               ; ... now
    pick 3              ; ... now end_time
    cmp ge              ; ... expired?
    if_not retry        ; ...
    pick 3              ; ... (target . message)
    part 1              ; ... message target
    ref std.send_0

retry:                  ; ... clock
    my self             ; ... clock SELF
    pick 2              ; ... clock SELF clock
    ref std.send_0

; The demo simply delays the sending of the numbers 42 and 1729 to the debug
; device.

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
    push 42             ; debug_dev timer 42
    pick 3              ; debug_dev timer 42 debug_dev
    push 1000           ; debug_dev timer 42 debug_dev 1000
    pick 4              ; debug_dev timer 42 debug_dev 1000 timer
    send 3              ; debug_dev timer
    push 1729           ; debug_dev timer 1729
    pick 3              ; debug_dev timer 1729 debug_dev
    push 2000           ; debug_dev timer 1729 debug_dev 2000
    pick 4              ; debug_dev timer 1729 debug_dev 2000 timer
    send 3              ; debug_dev timer
    ref std.commit

.export
    beh
    boot
