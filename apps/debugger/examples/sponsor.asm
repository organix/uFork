;
; Demonstrate "sponsor" mechanism
;

.import
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"

; Sponsor controller that refills all quotas

refill:                     ; (memory events . cycles) <- sponsor
    msg 0                   ; sponsor
    quad -4                 ; error=Z Y X T
    drop 3                  ; error
    dup 1                   ; error error
    eq std.E_CPU_LIM        ; error error==E_CPU_LIM
    if refill_0             ; error
    dup 1                   ; error error
    eq std.E_MEM_LIM        ; error error==E_MEM_LIM
    if refill_0             ; error
    dup 1                   ; error error
    eq std.E_MSG_LIM        ; error error==E_MSG_LIM
    if refill_0             ; error
    msg 0                   ; error sponsor
    sponsor stop            ; error --
    ref std.commit
refill_0:
    msg 0                   ; ... sponsor
    sponsor reclaim         ; ... sponsor
    state 1                 ; ... sponsor memory
    sponsor memory          ; ... sponsor
    state 2                 ; ... sponsor events
    sponsor events          ; ... sponsor
    state -2                ; ... sponsor cycles
    sponsor cycles          ; ... sponsor
    my self                 ; ... sponsor control=SELF
    sponsor start           ; ...
    ref std.commit

start:                      ; debug_dev <- _
    sponsor new             ; sponsor
    push 48                 ; sponsor 48
    sponsor memory          ; sponsor
    push 8                  ; sponsor 8
    sponsor events          ; sponsor
    push 64                 ; sponsor 64
    sponsor cycles          ; sponsor
    dup 1                   ; sponsor sponsor
    state 0                 ; sponsor sponsor debug_dev
    push control_1          ; sponsor sponsor debug_dev control_1
    actor create            ; sponsor sponsor control_1.debug_dev
    sponsor start           ; sponsor
    push #?                 ; sponsor msg=#?
    push #?                 ; sponsor msg #?
    push start_1            ; sponsor msg #? start_1
    actor create            ; sponsor msg actor=start_1.#?
    actor post              ; --
    ref std.commit

start_1:                    ; _ <- _
    push #?                 ; #?
    push #?                 ; #? #?
    push msg_bomb           ; #? #? msg_bomb
    actor create            ; #? msg_bomb.#?
    actor send              ; --
    push #?                 ; #?
    push #?                 ; #? #?
    push fork_bomb          ; #? #? fork_bomb
    actor create            ; #? fork_bomb.#?
    actor send              ; --
    push 0                  ; 0
    push #?                 ; 0 #?
    push count_to           ; 0 #? count_to
    actor create            ; 0 count_to.#?
    ref std.send_msg

control_1:                  ; debug_dev <- sponsor
    msg 0                   ; sponsor
    quad -4                 ; error=Z Y X T
    drop 3                  ; error
    msg 0                   ; error sponsor
    sponsor stop            ; error
    state 0                 ; error debug_dev
    ref std.send_msg

; An infinite loop will consume cycles, but no memory or events

loop_forever:
    dup 0 loop_forever

; Send yourself two messages for each one received.

msg_bomb:                   ; _ <- _
    push #?                 ; #?
    my self                 ; #? SELF
    actor send              ; --
    push #?                 ; #?
    my self                 ; #? SELF
    actor send              ; --
    ref std.commit

; Create and activate two clones for each message received.

fork_bomb:                  ; _ <- _
    push #?                 ; #?
    push #?                 ; #? #?
    push fork_bomb          ; #? #? fork_bomb
    actor create            ; #? fork_bomb.#?
    actor send              ; --
    push #?                 ; #?
    push #?                 ; #? #?
    push fork_bomb          ; #? #? fork_bomb
    actor create            ; #? fork_bomb.#?
    actor send              ; --
    ref std.commit

; Count up to a specified `limit` (forever, if `limit==#?`).

count_to:                   ; limit <- count
    state 0                 ; limit
    typeq #fixnum_t         ; typeof(limit)==#fixnum_t
    if_not count_next       ; --
    msg 0                   ; count
    state 0                 ; count limit
    cmp ge                  ; count>=limit
    if std.commit           ; --
count_next:
    msg 0                   ; count
    push 1                  ; count 1
    alu add                 ; count+1
    my self                 ; count+1 SELF
    ref std.send_msg

boot:                       ; _ <- {caps}
    push #?                 ; #?
    msg 0                   ; #? {caps}
    push dev.debug_key      ; #? {caps} debug_key
    dict get                ; #? debug_dev
    push start              ; #? debug_dev start
    actor create            ; #? start.debug_dev
    actor send              ; --

    sponsor new             ; sponsor
    push 1                  ; sponsor 1
    sponsor events          ; sponsor
    dup 1                   ; sponsor sponsor
    push 16                 ; sponsor sponsor cycles=8
    push 4                  ; sponsor sponsor cycles events=3
    push 8                  ; sponsor sponsor cycles events memory=5
    pair 2                  ; sponsor sponsor (memory events . cycles)
    push refill             ; sponsor sponsor (memory events . cycles) refill
    actor create            ; sponsor sponsor refill.(memory events . cycles)
    sponsor start           ; sponsor
    push #?                 ; sponsor msg=#?
    push #?                 ; sponsor msg #?
    push loop_forever       ; sponsor msg #? loop_forever
    actor create            ; sponsor msg actor=loop_forever.#?
    actor post              ; --

    ref std.commit

.export
    refill
    boot
