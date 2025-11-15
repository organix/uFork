;;; Hewitt Go/Stop "Unbounded Integer" Example
;
; Theorem. An Actor machine can perform computations that a no λ expression,
; nondeterministic Turing Machine or pure Logic Program can implement because
; there is an always-halting Actor machine that can compute an integer of
; unbounded size (cf. [Clinger 1981]).

; This can be accomplished using an Actor with a variable count that is
; initially 0 and a variable continue initially True. The computation is begun
; by concurrently sending two requests to the Actor machine: a stop request
; that will return an integer and a go request that will return Void. The Actor
; machine operates as follows:

;  • When a stop request is received, return count and set continue to False for
;    the next request received.
;  • When a go request is received:
;    o If continue is True, increment count by 1, send this Actor machine a go
;      request in a hole of the region of mutual exclusion, and then return
;      Void.
;    o If continue is False, return Void.

.import
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"

;;  DEF unbounded(num) AS \msg.[
;;      CASE is_actor(msg) OF
;;      TRUE : [  # cust
;;          BECOME \_.[]  # sink_beh
;;          SEND num TO msg
;;      ]
;;      _ : [  # inc
;;          BECOME unbounded(add(num, msg))
;;          SEND msg TO SELF
;;      ]
;;      END
;;  ]
unbounded:                  ; num <- inc | cust
    msg 0                   ; msg
    typeq #actor_t          ; is_actor(msg)
    if ub_stop              ; --
    state 0                 ; num
    msg 0                   ; num inc
    dup 1                   ; num inc inc
    actor self              ; num inc inc SELF
    actor send              ; num inc
    alu add                 ; num+inc
    push unbounded          ; num+inc unbounded
    actor become            ; --
    ref std.commit
ub_stop:                    ; --
    state 0                 ; num
    msg 0                   ; num cust
    actor send              ; --
    push #?                 ; #?
    push std.sink_beh       ; #? sink_beh
    actor become            ; --
    ref std.commit

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; println=debug_dev
;;  CREATE counter WITH unbounded(0)
    push 0                  ; println 0
    push unbounded          ; println 0 unbounded
    actor create            ; println counter=unbounded.0
;;  SEND 1 TO counter
    push 1                  ; println counter 1
    pick 2                  ; println counter 1 counter
    actor send              ; println counter
;;  SEND println TO counter
;    dup 1                   ;; println counter counter
;    roll -3                 ;; counter println counter
;    actor send              ;; counter
;;#  SEND 2 TO counter
;    push 2                  ;; counter 2
;    roll -2                 ;; 2 counter
    actor send              ; --
    ref std.commit

.export
    boot
