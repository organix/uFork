;;;
;;; single-assignement data-flow variable
;;;

.import
    std: "./std.asm"
    lib: "./lib.asm"

;;  (define future-beh
;;      (lambda (rcap wcap)
;;          (BEH (tag . arg)
;;              (cond
;;                  ((eq? tag rcap)
;;                      (BECOME (wait-beh rcap wcap (list arg))))
;;                  ((eq? tag wcap)
;;                      (BECOME (value-beh rcap arg))) ))))
future_beh:             ; rcap wcap
    msg 1               ; rcap wcap tag
    pick 3              ; rcap wcap tag rcap
    cmp eq              ; rcap wcap tag==rcap
    if_not future_1     ; rcap wcap
future_0:
    push #nil           ; rcap wcap ()
    msg -1              ; rcap wcap () arg
    pair 1              ; rcap wcap (arg)
    push wait_beh       ; rcap wcap (arg) wait-beh
    beh 3               ; wait-beh[rcap wcap (arg)]
    ref std.commit
future_1:
    msg 1               ; rcap wcap tag
    pick 2              ; rcap wcap tag wcap
    cmp eq              ; rcap wcap tag==wcap
    if_not std.abort    ; rcap wcap
future_2:
    drop 1              ; rcap
    msg -1              ; rcap value=arg
    push value_beh      ; rcap value=arg value-beh
    beh 2               ; value-beh[rcap value]
    ref std.commit

;;  (define wait-beh
;;      (lambda (rcap wcap waiting)
;;          (BEH (tag . arg)
;;              (cond
;;                  ((eq? tag rcap)
;;                      (BECOME (wait-beh rcap wcap (cons arg waiting))))
;;                  ((eq? tag wcap)
;;                      (send-to-all waiting arg)
;;                      (BECOME (value-beh rcap arg))) ))))
wait_beh:               ; rcap wcap waiting
    msg 1               ; rcap wcap waiting tag
    pick 4              ; rcap wcap waiting tag rcap
    cmp eq              ; rcap wcap waiting tag==rcap
    if_not wait_1       ; rcap wcap waiting
wait_0:
    msg -1              ; rcap wcap waiting arg
    pair 1              ; rcap wcap (arg . waiting)
    push wait_beh       ; rcap wcap (arg . waiting) wait-beh
    beh 3               ; wait-beh[rcap wcap (arg . waiting)]
    ref std.commit
wait_1:
    msg 1               ; rcap wcap waiting tag
    pick 3              ; rcap wcap waiting tag wcap
    cmp eq              ; rcap wcap waiting tag==wcap
    if_not std.abort    ; rcap wcap waiting
wait_2:
    dup 1               ; rcap wcap waiting waiting
    typeq #pair_t       ; rcap wcap waiting is_pair(waiting)
    if_not wait_4       ; rcap wcap waiting
wait_3:
    part 1              ; rcap wcap rest first
    msg -1              ; rcap wcap rest first value=arg
    roll 2              ; rcap wcap rest value=arg first
    send 0              ; rcap wcap rest
    ref wait_2
wait_4:
    drop 2              ; rcap
    msg -1              ; rcap value=arg
    push value_beh      ; rcap value=arg value-beh
    beh 2               ; value-beh[rcap value]
    ref std.commit

;;  (define value-beh
;;      (lambda (rcap value)
;;          (BEH (tag . arg)
;;              (cond
;;                  ((eq? tag rcap)
;;                      (SEND arg value))) )))
value_beh:              ; rcap value
    msg 1               ; rcap value tag
    pick 3              ; rcap value tag rcap
    cmp eq              ; rcap value tag==rcap
    if_not std.commit   ; rcap value
    pick 1              ; rcap value value
    msg -1              ; rcap value value cust=arg
    ref std.send_msg

; unit test suite
boot:                   ; () <- {caps}
    msg 0               ; {caps}
    ref std.commit

.export
    future_beh
    boot
