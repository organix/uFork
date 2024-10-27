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
    new -1                  ; #? {caps} a_resend
    send -1                 ; --
    push #?                 ; #?
    push #?                 ; #? #?
    push loop               ; #? #? loop
    new -1                  ; #? a_loop
    ref std.send_msg

.export
    boot
