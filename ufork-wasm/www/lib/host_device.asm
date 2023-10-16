; Test suite for the host device.

.import
    std: "./std.asm"

dummy_key:
    ref 1000
proxy_key:
    ref 1001

boot:                   ; () <- {caps}
    push -42            ; -42
    msg 0               ; -42 {caps}
    push proxy_key      ; -42 {caps} proxy_key
    dict get            ; -42 proxy
    send -1             ; --
    push 42             ; 42
    msg 0               ; 42 {caps}
    push dummy_key      ; 42 {caps} dummy_key
    dict get            ; 42 dummy_dev
    ref std.send_msg

.export
    boot
