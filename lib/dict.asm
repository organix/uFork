;
; subroutines implementing an unbounded version of #dict_t
;

;.import
;    std: "./std.asm"
;    std: "https://ufork.org/lib/std.asm"

return_value:               ; k rv
    roll 2                  ; rv k
    return                  ; rv
return_undef:               ; k
    push #?                 ; k rv=#?
    ref return_value
return_nil:                 ; k
    push #nil               ; k rv=()
    ref return_value
return_f:                   ; k
    push #f                 ; k rv=#f
    ref return_value
return_t:                   ; k
    push #t                 ; k rv=#t
    ref return_value
return_unit:                ; k
    push #unit              ; k rv=#unit
    ref return_value
return_zero:                ; k
    push 0                  ; k rv=0
    ref return_value
return_one:                 ; k
    push 1                  ; k rv=1
    ref return_value

has:                        ; ( dict key k -- bool )
    roll -3                 ; k dict key
    roll 2                  ; k key dict
has_search:                 ; k key dict
    quad -4                 ; k key next value' key' type
    eq #dict_t              ; k key next value' key' type==#dict_t
    if_not has_f            ; k key next value' key'
    pick 4                  ; k key next value' key' key
    cmp eq                  ; k key next value' key'==key
    if has_t                ; k key next value'
    drop 1                  ; k key dict=next
    ref has_search
has_t:                      ; k key next value'
    drop 3                  ; k
    ref return_t
has_f:                      ; k key next value' key'
    drop 4                  ; k
    ref return_f

get:                        ; ( dict key k -- value )
    roll -3                 ; k dict key
    roll 2                  ; k key dict
get_search:                 ; k key dict
    quad -4                 ; k key next value' key' type
    eq #dict_t              ; k key next value' key' type==#dict_t
    if_not get_f            ; k key next value' key'
    pick 4                  ; k key next value' key' key
    cmp eq                  ; k key next value' key'==key
    if get_t                ; k key next value'
    drop 1                  ; k key dict=next
    ref get_search
get_t:                      ; k key next value'
    roll -4                 ; value' k key next
    drop 2                  ; value' k
    return                  ; value'
get_f:                      ; k key next value' key'
    drop 4                  ; k
    ref return_undef

add:                        ; ( dict key value k -- dict' )
    roll -4                 ; k dict key value
add_tail:                   ; k dict key value
    roll 2                  ; k dict value key
    push #dict_t            ; k dict value key #dict_t
    quad 4                  ; k dict'
    ref return_value

set:                        ; ( dict key value k -- dict' )
    roll -4                 ; k dict key value
    roll 3                  ; k key value dict
    pick 3                  ; k key value dict key
    call del                ; k key value dict'
    roll -3                 ; k dict' key value
    ref add_tail

del:                        ; ( dict key k -- dict' )
    roll -3                 ; k dict key
    push #nil               ; k dict key rev=()
    pick 3                  ; k orig key rev dict
del_rev:
    quad -4                 ; k orig key rev next value' key' type
    eq #dict_t              ; k orig key rev next value' key' type==#dict_t
    if_not del_none         ; k orig key rev next value' key'
    dup 1                   ; k orig key rev next value' key' key'
    pick 6                  ; k orig key rev next value' key' key' key
    cmp eq                  ; k orig key rev next value' key' key'==key
    if del_found            ; k orig key rev next value' key'
    roll 4                  ; k orig key next value' key' rev
    roll -3                 ; k orig key next rev value' key'
    push #dict_t            ; k orig key next rev value' key' #dict_t
    quad 4                  ; k orig key next rev'
    roll 2                  ; k orig key rev' next
    ref del_rev
del_found:                  ; k orig key rev next value' key'
    roll 6                  ; k key rev next value' key' orig
    drop 3                  ; k key rev dict'=next
    roll 2                  ; k key dict' rev
del_copy:
    quad -4                 ; k key dict' next value' key' type'
    eq #dict_t              ; k key dict' next value' key' type'==#dict_t
    if_not del_done         ; k key dict' next value' key'
    roll 4                  ; k key next value' key' dict'
    roll -3                 ; k key next dict' value' key'
    push #dict_t            ; k key next dict' value' key' #dict_t
    quad 4                  ; k key next dict''
    roll 2                  ; k key dict'' next
    ref del_copy
del_done:                   ; k key dict' next value' key'
    drop 3                  ; k key dict'
    roll -3                 ; dict' k key
    drop 1                  ; dict' k
    return                  ; dict'
del_none:                   ; k orig key rev next value' key'
    drop 5                  ; k orig
    ref return_value

example:
    dict_t 1 #nil
    dict_t 2 #f
    dict_t 3 #t
    ref #nil

; unit test suite
boot:                       ; () <- {caps}
;    msg 0                   ; {caps}
;    ref std.commit
    push example
    push -1
    call del
    push 2
    call del
    drop 1
    push example
    push 1
    call del
    drop 1
    push example
    push 3
    call del
    end commit

.export
    has
    get
    add
    set
    del
    boot
