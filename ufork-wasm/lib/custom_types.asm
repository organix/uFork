.import
    std: "./std.asm"
    dev: "./dev.asm"

nullary:
    type_t 0
nullary_quad:
    quad_1 nullary

unary:
    type_t 1
unary_quad:
    quad_2 unary 1

binary:
    type_t 2
binary_quad:
    quad_3 binary 1 2

ternary:
    type_t 3
ternary_quad:
    quad_4 ternary 1 2 3

pairlike_quad:
    quad_3 #pair_t 1 -1

; bad_quad:
;     quad_1 #fixnum_t

boot:
    msg 0               ; {caps}
    push dev.debug_key  ; {caps} debug_key
    dict get            ; debug_dev
    push nullary_quad   ; debug_dev nullary_quad
    pick 2              ; debug_dev nullary_quad debug_dev
    send -1             ; debug_dev
    push unary_quad     ; debug_dev unary_quad
    pick 2              ; debug_dev unary_quad debug_dev
    send -1             ; debug_dev
    push binary_quad    ; debug_dev binary_quad
    pick 2              ; debug_dev binary_quad debug_dev
    send -1             ; debug_dev
    push ternary_quad   ; debug_dev ternary_quad
    pick 2              ; debug_dev ternary_quad debug_dev
    send -1             ; debug_dev
    push pairlike_quad  ; debug_dev pairlike_quad
    pick 2              ; debug_dev pairlike_quad debug_dev
    send -1             ; debug_dev
    ; push bad_quad       ; debug_dev bad_quad
    ; pick 2              ; debug_dev bad_quad debug_dev
    ; send -1             ; debug_dev
    end commit

.export
    boot
