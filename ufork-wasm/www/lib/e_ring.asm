; Joe Armstrong's Erlang challenge:
;   Create a ring of N processes
;   Send M simple messages around the ring
;   Increase N until out of resources

.import
    std: "./std.asm"

;;  LET countdown_builder_beh(n) = \(first, m).[
;;      IF $n = 1 [
;;          BECOME countdown_ring_0_beh(first)
;;          SEND m TO first  # start message passing phase
;;      ] ELSE [
;;          CREATE next WITH countdown_builder_beh(add(n, -1))
;;          BECOME countdown_ring_beh(next)
;;          SEND (first, m) TO next
;;      ]
;;  ]

build:                  ; n <- (first . m)
    state 0             ; n
    push 1              ; n 1
    cmp le              ; n<=1
    if build_0          ; --

    state 0             ; n
    push 1              ; n 1
    alu sub             ; n-1
    push build          ; n-1 build
    new -1              ; next=build.n-1
    dup 1               ; next next
    push ring           ; next next ring
    beh -1              ; next
    msg 0               ; next (first . m)
    roll 2              ; (first . m) next
    ref std.send_msg

build_0:
    msg 1               ; first
    push ring_0         ; first ring_0
    beh -1              ; --
    msg -1              ; m
    msg 1               ; m first
    ref std.send_msg

;;  LET countdown_ring_0_beh(first) = \m.[
;;  #    SEND m TO println
;;      IF $m = 1 [
;;          BECOME \_.[]
;;      ] ELSE [
;;          SEND add(m, -1) TO first
;;      ]
;;  ]

ring_0:                 ; first <- m
    msg 0               ; m
    eq 1                ; m==1
    if ring_end         ; --

    msg 0               ; m
    push 1              ; m 1
    alu sub             ; m-1
    state 0             ; m-1 first
    ref std.send_msg

ring_end:
    push std.sink_beh   ; sink_beh
    beh 0               ; --
    ref std.commit

;;  LET countdown_ring_beh(next) = \m.[
;;      SEND m TO next
;;  ]

ring:                   ; next <- m
    msg 0               ; m
    state 0             ; m next
    ref std.send_msg

;;  # CREATE countdown WITH countdown_builder_beh(123456)
;;  # SEND (countdown, 789) TO countdown

; Create a ring of n actors, and send a message around m times.

n:
    ref 5
m:
    ref 3

boot:                   ; () <- {caps}
    push n              ; n
    push build          ; n build
    new -1              ; first=build.n
    push m              ; first m
    pick 2              ; first m first
    pair 1              ; first (first . m)
    roll 2              ; (first . m) first
    ref std.send_msg

.export
    build
    boot
