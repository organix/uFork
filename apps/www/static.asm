; HTTP static file server.

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

petname:                    ; the bind address
    ref 0

; TODO
; ../tcp/random.asm shows how to listen for TCP connections
; ../../vm/js/fs_dev_demo.hum shows how to read files from disk

boot:                       ; _ <- {caps}
    ref std.commit

.export
    boot
