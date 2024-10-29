; A simple "Hello, World!" example

.import
    dev: "https://ufork.org/lib/dev.asm"

hello:                      ; (+72 +101 +108 +108 +111 +63 +10)
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
    push dev.debug_key      ; value {caps} dev.debug_key
    dict get                ; value debug_dev
;    msg 0               ; ... debug_dev {caps}
;    push dev.clock_key  ; ... debug_dev {caps} dev.clock_key
;    dict get            ; ... cust=debug_dev clock_dev
    actor send              ; --
    end commit

.export
    boot
