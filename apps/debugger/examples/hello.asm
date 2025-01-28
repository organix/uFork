; A simple "Hello, World!" example

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

hello:                      ; +72,+101,+108,+108,+111,+63,+10,#nil
    pair_t 'H'
    pair_t 'e'
    pair_t 'l'
    pair_t 'l'
    pair_t 'o'
    pair_t '?'
    pair_t '\n'
    ref #nil

boot:                       ; _ <- {caps}
    push hello              ; value
    msg 0                   ; value {caps}
    push dev.debug_key      ; value {caps} debug_key
    dict get                ; value debug_dev
    actor send              ; --
    ref std.commit

.export
    boot
