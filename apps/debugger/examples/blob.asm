;
; Demonstrate features of the "blob" device
;

.import
    assert_eq: "https://ufork.org/lib/testing/assert_eq.asm"
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"

do_13:                      ; _ <- blob
    msg 0                   ; blob
    push write_13           ; blob write_13
    actor become            ; --
    push 42                 ; value=42
    push 7                  ; value offset=7
    my self                 ; value offset SELF
    pair 2                  ; write_req=(SELF offset . value)
    msg 0                   ; write_req blob
    actor send              ; --
    ref std.commit
write_13:                   ; blob <- ok
    msg 0                   ; ok
    assert #t               ; --
    push 7                  ; 7
    my self                 ; 7 SELF
    pair 1                  ; read_req=(SELF . 7)
    state 0                 ; read_req blob
    actor send              ; --
    push 42                 ; expect=42
    push assert_eq.beh      ; expect assert_eq_beh
    actor become            ; --
    ref std.commit

boot_0:                     ; _ <- {caps}
    push 13                 ; 13
    push #?                 ; 13 #?
    push do_13              ; 13 #? do_13
    actor create            ; 13 alloc_k=do_13.#?
    pair 1                  ; alloc_req=(alloc_k . 13)
    msg 0                   ; alloc_req {caps}
    push dev.blob_key       ; alloc_req {caps} blob_key
    dict get                ; alloc_req blob_dev
    actor send              ; --
    ref std.commit

boot:                       ; _ <- {caps}
    dup 0                   ; no-op
    ; ref boot_0              ; redirect to `boot_0` behavior

step_0:
    push #?                 ; #?
    msg 0                   ; #? {caps}
    push dev.debug_key      ; #? {caps} debug_key
    dict get                ; #? debug_dev
    msg 0                   ; #? debug_dev {caps}
    push dev.blob_key       ; #? debug_dev {caps} blob_key
    dict get                ; #? debug_dev blob_dev
    pair 1                  ; #? (blob_dev . debug_dev)
    push step_1             ; #? (blob_dev . debug_dev) step_1
    actor create            ; #? step_1.(blob_dev . debug_dev)
    actor send              ; --
    ref std.commit

step_1:                     ; (blob_dev . debug_dev) <- _
    push 7                  ; 7
    my self                 ; 7 SELF
    pair 1                  ; alloc_req=(SELF . 7)
    state 1                 ; alloc_req blob_dev
    actor send              ; --
    state 0                 ; (blob_dev . debug_dev)
    push step_2             ; (blob_dev . debug_dev) step_2
    actor become            ; --
    ref std.commit

step_2:                     ; (blob_dev . debug_dev) <- blob_1
    ; push 5                  ; 5
    ; my self                 ; 5 SELF
    ; pair 1                  ; alloc_req=(SELF . 5)
    ; state 1                 ; alloc_req blob_dev
    ; actor send              ; --
    ; state 0                 ; (blob_dev . debug_dev)
    ; msg 0                   ; (blob_dev . debug_dev) blob_1
    ; pair 1                  ; (blob_1 blob_dev . debug_dev)
    ; push step_3             ; (blob_1 blob_dev . debug_dev) step_3
    ; actor become            ; --
    ref std.commit

; step_3:                     ; (blob_1 blob_dev . debug_dev) <- blob_2
;     push 3                  ; 3
;     my self                 ; 3 SELF
;     pair 1                  ; alloc_req=(SELF . 3)
;     state 2                 ; alloc_req blob_dev
;     actor send              ; --
;     state 0                 ; (blob_1 blob_dev . debug_dev)
;     msg 0                   ; (blob_1 blob_dev . debug_dev) blob_2
;     pair 1                  ; (blob_2 blob_1 blob_dev . debug_dev)
;     push step_4             ; (blob_2 blob_1 blob_dev . debug_dev) step_4
;     actor become            ; --
;     ref std.commit

; step_4:                     ; (blob_2 blob_1 blob_dev . debug_dev) <- blob_3
;     state -1                ; (blob_1 blob_dev . debug_dev)  --- release blob_2
;     msg 0                   ; (blob_1 blob_dev . debug_dev) blob_3
;     pair 1                  ; (blob_3 blob_1 blob_dev . debug_dev)
;     push step_5             ; (blob_3 blob_1 blob_dev . debug_dev) step_5
;     actor become            ; --
;     push #?                 ; #?
;     my self                 ; #? SELF
;     actor send              ; --
;     ref std.commit

; step_5:                     ; (blob_3 blob_1 blob_dev . debug_dev) <- _
;     state -2                ; (blob_dev . debug_dev)  --- release blob_1
;     state 1                 ; (blob_dev . debug_dev) blob_3
;     pair 1                  ; (blob_3 blob_dev . debug_dev)
;     push step_6             ; (blob_3 blob_dev . debug_dev) step_6
;     actor become            ; --
;     push #?                 ; #?
;     my self                 ; #? SELF
;     actor send              ; --
;     ref std.commit

; step_6:                     ; (blob_3 blob_dev . debug_dev) <- _
;     state -1                ; (blob_dev . debug_dev)  --- release blob_3
;     push step_7             ; (blob_dev . debug_dev) step_7
;     actor become            ; --
;     push #?                 ; #?
;     my self                 ; #? SELF
;     actor send              ; --
;     ref std.commit

; step_7:                     ; (blob_dev . debug_dev) <- _
;     ref std.commit

.export
    boot
