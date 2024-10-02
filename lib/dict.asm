;
; subroutines implementing an unbounded version of #dict_t
;

.import
    std: "./std.asm"
;    std: "https://ufork.org/lib/std.asm"

has:                        ; ( dict key k -- bool )
    roll -3                 ; k dict key
    roll 2                  ; k key dict
has_search:                 ; k key dict
    quad -4                 ; k key next value' key' type
    eq #dict_t              ; k key next value' key' type==#dict_t
    if_not has_none         ; k key next value' key'
    pick 4                  ; k key next value' key' key
    cmp eq                  ; k key next value' key'==key
    if has_found            ; k key next value'
    drop 1                  ; k key dict=next
    ref has_search
has_found:                  ; k key next value'
    drop 3                  ; k
    ref std.return_t
has_none:                   ; k key next value' key'
    drop 4                  ; k
    ref std.return_f

get:                        ; ( dict key k -- value )
    roll -3                 ; k dict key
    roll 2                  ; k key dict
get_search:                 ; k key dict
    quad -4                 ; k key next value' key' type
    eq #dict_t              ; k key next value' key' type==#dict_t
    if_not get_none         ; k key next value' key'
    pick 4                  ; k key next value' key' key
    cmp eq                  ; k key next value' key'==key
    if get_found            ; k key next value'
    drop 1                  ; k key dict=next
    ref get_search
get_found:                  ; k key next value'
    roll -4                 ; value' k key next
    drop 2                  ; value' k
    return                  ; value'
get_none:                   ; k key next value' key'
    drop 4                  ; k
    ref std.return_undef

add:                        ; ( dict key value k -- dict' )
    roll -4                 ; k dict key value
add_tail:                   ; k dict key value
    roll 2                  ; k dict value key
    push #dict_t            ; k dict value key #dict_t
    quad 4                  ; k dict'
    ref std.return_value

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
    ref std.return_value

; example usage
example:
    dict_t 1 #nil
    dict_t 2 #f
    dict_t 3 #t
    ref #nil

demo_del:
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
    drop 1
    ref std.commit

; self-checked demo
demo:
    push #?                 ; #?
    push #?                 ; #? #?
demo_0:
    call has                ; #f
    assert #f               ; --
    push #nil               ; ()
    push 0                  ; () 0
    dup 2                   ; () 0 () 0
    call has                ; () 0 #f
    assert #f               ; () 0
    call get                ; #?
    assert #?               ; --
demo_1:
    push #nil               ; ()
    push 0                  ; () 0
    push 42                 ; () 0 42
    call add                ; {0:42}
    pick 1                  ; {0:42} {0:42}
    push 0                  ; {0:42} {0:42} 0
    call get                ; {0:42} 42
    assert 42               ; {0:42}
demo_2:
    push 1                  ; {0:42} 1
    push -1                 ; {0:42} 1 -1
    call add                ; {1:-1, 0:42}
    dup 1                   ; {1:-1, 0:42} {1:-1, 0:42}
    push 0                  ; {1:-1, 0:42} {1:-1, 0:42} 0
    call get                ; {1:-1, 0:42} 42
    assert 42               ; {1:-1, 0:42}
demo_3:
    push 0                  ; {1:-1, 0:42} 0
    call del                ; {1:-1}
    dup 1                   ; {1:-1} {1:-1}
    push 0                  ; {1:-1} {1:-1} 0
    call get                ; {1:-1} #?
    assert #?               ; {1:-1}
demo_4:
    push 1                  ; {1:-1} 1
    push #f                 ; {1:-1} 1 #f
    call add                ; {1:#f, 1:-1}
    dup 1                   ; {1:#f, 1:-1} {1:#f, 1:-1}
    push 1                  ; {1:#f, 1:-1} {1:#f, 1:-1} 1
    push #t                 ; {1:#f, 1:-1} {1:#f, 1:-1} 1 #t
    call set                ; {1:#f, 1:-1} {1:#t, 1:-1}
    dup 1                   ; {1:#f, 1:-1} {1:#t, 1:-1} {1:#t, 1:-1}
    push 1                  ; {1:#f, 1:-1} {1:#t, 1:-1} {1:#t, 1:-1} 1
    call del                ; {1:#f, 1:-1} {1:#t, 1:-1} {1:-1}
    push 1                  ; {1:#f, 1:-1} {1:#t, 1:-1} {1:-1} 1
    call get                ; {1:#f, 1:-1} {1:#t, 1:-1} -1
    assert -1               ; {1:#f, 1:-1} {1:#t, 1:-1}
    push 1                  ; {1:#f, 1:-1} {1:#t, 1:-1} 1
    dict get                ; {1:#f, 1:-1} #t
    assert #t               ; {1:#f, 1:-1}
    push 1                  ; {1:#f, 1:-1} 1
    dict get                ; #f
    assert #f               ; --
    ref demo_del

; unit test suite
boot:                       ; () <- {caps}
;    msg 0                   ; {caps}
;    ref std.commit
;    end commit
    ref demo

.export
    has
    get
    add
    set
    del
    boot
