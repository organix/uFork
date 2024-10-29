; looping and self-reference

.import
    std: "https://ufork.org/lib/std.asm"

loop:
    drop 0 loop             ; no-op loop

boot:
    push #?                 ; #?
    msg 0                   ; #? {caps}
    push #?                 ; #? {caps} #?
    push std.resend         ; #? {caps} #? std.resend
    actor create            ; #? {caps} a_resend
    actor send              ; --
    push #?                 ; #?
    push #?                 ; #? #?
    push loop               ; #? #? loop
    actor create            ; #? a_loop
    ref std.send_msg

.export
    boot
