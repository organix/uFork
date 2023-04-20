; looping and self-reference

.import
    std: "./std.asm"

loop:
    drop 0 loop         ; no-op loop

boot:
    msg 0               ; {caps}
    push std.resend     ; {caps} std.resend
    new 0               ; {caps} a_resend
    send 0              ; --
    push loop           ; loop
    new 0               ; a_loop
    ref std.send_0

.export
    boot
