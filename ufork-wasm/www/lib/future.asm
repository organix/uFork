;;;
;;; single-assignement data-flow variable
;;;

.import
    std: "./std.asm"
    lib: "./lib.asm"
    dev: "./dev.asm"

;;  (define future-beh
;;      (lambda (rcap wcap)
;;          (BEH (tag . arg)
;;              (cond
;;                  ((eq? tag rcap)
;;                      (BECOME (wait-beh (list arg) rcap wcap)))
;;                  ((eq? tag wcap)
;;                      (BECOME (value-beh rcap arg))) ))))
beh:
future_beh:             ; (rcap wcap) <- (tag . arg)
    msg 1               ; tag
    state 1             ; tag rcap
    cmp eq              ; tag==rcap
    if_not future_1     ; --
future_0:
    state 0             ; (rcap wcap)
    push #nil           ; (rcap wcap) ()
    msg -1              ; (rcap wcap) () cust=arg
    pair 1              ; (rcap wcap) (cust)
    pair 1              ; ((cust) rcap wcap)
    push wait_beh       ; ((cust) rcap wcap) wait-beh
    beh -1              ; --
    ref std.commit
future_1:
    msg 1               ; tag
    state 2             ; tag wcap
    cmp eq              ; tag==wcap
    if_not std.abort    ; --
future_2:
    msg -1              ; value=arg
    state 1             ; value rcap
    push value_beh      ; value rcap value-beh
    beh 2               ; --
    ref std.commit

;;  (define wait-beh
;;      (lambda (waiting rcap wcap)
;;          (BEH (tag . arg)
;;              (cond
;;                  ((eq? tag rcap)
;;                      (BECOME (wait-beh (cons arg waiting) rcap wcap)))
;;                  ((eq? tag wcap)
;;                      (send-to-all waiting arg)
;;                      (BECOME (value-beh rcap arg))) ))))
wait_beh:               ; (waiting rcap wcap) <- (tag . arg)
    msg 1               ; tag
    state 2             ; tag rcap
    cmp eq              ; tag==rcap
    if_not wait_1       ; --
wait_0:
    my state            ; wcap rcap waiting
    msg -1              ; wcap rcap waiting cust=arg
    pair 1              ; wcap rcap (cust . waiting)
    push wait_beh       ; wcap rcap (cust . waiting) wait-beh
    beh 3               ; --
    ref std.commit
wait_1:
    msg 1               ; tag
    state 3             ; tag wcap
    cmp eq              ; tag==wcap
    if_not std.abort    ; --
    state 1             ; waiting
wait_2:
    dup 1               ; waiting waiting
    typeq #pair_t       ; waiting is_pair(waiting)
    if_not wait_4       ; waiting
wait_3:
    part 1              ; rest first
    msg -1              ; rest first value=arg
    roll 2              ; rest value=arg first
    send -1             ; waiting=rest
    ref wait_2
wait_4:
    msg -1              ; waiting value=arg
    state 2             ; waiting value rcap
    push value_beh      ; waiting value rcap value-beh
    beh 2               ; waiting
    ref std.commit

;;  (define value-beh
;;      (lambda (rcap value)
;;          (BEH (tag . arg)
;;              (cond
;;                  ((eq? tag rcap)
;;                      (SEND arg value))) )))
value_beh:              ; (rcap value) <- (tag . arg)
    msg 1               ; tag
    state 1             ; tag rcap
    cmp eq              ; tag==rcap
    if_not std.abort    ; --
    state 2             ; value
    msg -1              ; value cust=arg
    ref std.send_msg

; unit test suite
boot:                   ; () <- {caps}
    push 1              ; wcap
    push 0              ; wcap rcap
    push future_beh     ; wcap rcap future-beh
    new 2               ; future.(rcap wcap)
    msg 0               ; future {caps}
    push dev.debug_key  ; future {caps} dev.debug_key
    dict get            ; future debug_dev

    push 42             ; future debug_dev 42
    push 1              ; future debug_dev 42 wcap
    pair 1              ; future debug_dev (wcap . 42)
    pick 3              ; future debug_dev (wcap . 42) future
    send -1             ; future debug_dev

    push -1             ; future debug_dev -1
    pick 2              ; future debug_dev -1 debug_dev
    push lib.label_beh  ; future debug_dev -1 debug_dev label-beh
    new 2               ; future debug_dev label-1.(debug_beh -1)
    push 0              ; future debug_dev label-1 rcap
    pair 1              ; future debug_dev (rcap . label-1)
    pick 3              ; future debug_dev (rcap . label-1) future
    send -1             ; future debug_dev

    push -2             ; future debug_dev -2
    pick 2              ; future debug_dev -2 debug_dev
    push lib.label_beh  ; future debug_dev -2 debug_dev label-beh
    new 2               ; future debug_dev label-2.(debug_beh -2)
    push 0              ; future debug_dev label-2 rcap
    pair 1              ; future debug_dev (rcap . label-2)
    pick 3              ; future debug_dev (rcap . label-2) future
    send -1             ; future debug_dev

    ref std.commit

.export
    beh
    boot
