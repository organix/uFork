; Infer the MIME type from a request path blob.

; The customer is sent the MIME type as a list of characters,
; or #? if not found.

.import
    blob: "https://ufork.org/lib/blob.asm"
    dev: "https://ufork.org/lib/dev.asm"
    peg: "https://ufork.org/lib/blob_peg.asm"
    std: "https://ufork.org/lib/std.asm"
    match_eof: "./match_eof.asm"
    match_string: "./match_string.asm"

css_mime:                   ; "text/css"
    pair_t 't'
    pair_t 'e'
    pair_t 'x'
    pair_t 't'
    pair_t '/'
css_ext:                    ; "css"
    pair_t 'c'
    pair_t 's'
    pair_t 's'
    ref #nil

html_mime:                  ; "text/html"
    pair_t 't'
    pair_t 'e'
    pair_t 'x'
    pair_t 't'
    pair_t '/'
html_ext:                   ; "html"
    pair_t 'h'
    pair_t 't'
    pair_t 'm'
    pair_t 'l'
    ref #nil

png_mime:                   ; "image/png"
    pair_t 'i'
    pair_t 'm'
    pair_t 'a'
    pair_t 'g'
    pair_t 'e'
    pair_t '/'
png_ext:                    ; "png"
    pair_t 'p'
    pair_t 'n'
    pair_t 'g'
    ref #nil

svg_mime:                   ; "image/svg+xml"
    pair_t 'i'
    pair_t 'm'
    pair_t 'a'
    pair_t 'g'
    pair_t 'e'
    pair_t '/'
    pair_t 's'
    pair_t 'v'
    pair_t 'g'
    pair_t '+'
    pair_t 'x'
    pair_t 'm'
    pair_t 'l'
    ref #nil
svg_ext:                    ; "svg"
    pair_t 's'
    pair_t 'v'
    pair_t 'g'
    ref #nil

map:                        ; {"css": "text/css", ...}
    dict_t css_ext css_mime
    dict_t html_ext html_mime
    dict_t png_ext png_mime
    dict_t svg_ext svg_mime
    ref #nil

;;  pre_ext = ([^.]*\.)* (FIXME: stop at query string)
new_pre_ext_ptrn:           ; ( -- pre_ext_ptrn )
    push #nil               ; k #nil
    push '.'                ; k #nil dot
    push peg.pred_eq        ; k #nil dot pred_eq
    actor create            ; k #nil dot_pred=pred_eq.dot
    push peg.match_one      ; k #nil dot_pred match_one
    actor create            ; k #nil dot_ptrn=match_one.dot_pred
    push '.'                ; k #nil dot_ptrn dot
    push peg.pred_eq        ; k #nil dot_ptrn dot pred_eq
    actor create            ; k #nil dot_ptrn dot_pred=pred_eq.dot
    push peg.pred_not       ; k #nil dot_ptrn dot_pred pred_not
    actor create            ; k #nil dot_ptrn nondot_pred=pred_not.dot_pred
    push peg.match_one      ; k #nil dot_ptrn nondot_pred match_one
    actor create            ; k #nil dot_ptrn nondot_ptrn=match_one.nondot_pred
    push peg.match_star     ; k #nil dot_ptrn nondot_ptrn match_star
    actor create            ; k #nil dot_ptrn nondots_ptrn=match_star.nondot_ptrn
    pair 2                  ; k list=nondots_ptrn,dot_ptrn,#nil
    push peg.match_seq      ; k list match_seq
    actor create            ; k segment_ptrn=match_seq.list
    push peg.match_star     ; k segment_ptrn match_star
    actor create            ; k pre_ext_ptrn=match_star.segment_ptrn
    ref std.return_value

;;  ext = string EOF (FIXME: ignore query string)
new_ext_ptrn:               ; ( ext -- ext_ptrn )
    roll -2                 ; k ext
    push #nil               ; k ext #nil
    call match_eof.new      ; k ext #nil eof_ptrn
    roll 3                  ; k #nil eof_ptrn ext
    call match_string.new   ; k #nil eof_ptrn string_ptrn
    pair 2                  ; k list=string_ptrn,eof_ptrn,#nil
    push peg.match_seq      ; k list match_seq
    actor create            ; k get_ptrn=match_seq.list
    ref std.return_value

beh:                        ; _ <- cust,path

; Find the starting position of the file extension in the path.

    msg -1                  ; blob=path
    push 0                  ; blob ofs=0
    msg 1                   ; blob ofs cust
    push ext                ; blob ofs cust ext
    actor create            ; blob ofs cust'=ext.cust
    pair 2                  ; cust',ofs,blob
    call new_pre_ext_ptrn   ; cust',ofs,blob pre_ext_ptrn
    ref std.send_msg

ext:                        ; cust <- base,len,blob

; Simulate a match failure to kick things off.

    msg 0                   ; base,len,blob  // match_star always matches
    part 2                  ; blob len base
    alu add                 ; blob ofs=base+len
    push #?                 ; blob ofs #?
    pair 2                  ; #?,ofs,blob
    push map                ; #?,ofs,blob map
    push #?                 ; #?,ofs,blob map mime=#?
    state 0                 ; #?,ofs,blob map mime cust
    pair 2                  ; #?,ofs,blob cust,mime,map
    push check              ; #?,ofs,blob cust,mime,map check
    actor create            ; #?,ofs,blob check.cust,mime,map
    ref std.send_msg

check:                      ; cust,mime,map <- base,len,blob | #?,ofs,blob

; Examine the results of 'ext_ptrn'.

    msg 1                   ; base
    typeq #fixnum_t         ; is_fix(base)
    if found                ; --

; If not a match, remove the next quad from the map dictionary. It contains
; the extension and the mime type, both as lists. Make a pattern out of the
; extension and attempt to match it against the blob.

    state -2                ; map
    typeq #dict_t           ; is_dict(map)
    if_not not_found        ; --
    state -2                ; map
    quad -4                 ; map' mime ext #dict_t
    drop 1                  ; map' mime ext
    roll -3                 ; ext map' mime
    state 1                 ; ext map' mime cust
    pair 2                  ; ext cust,mime,map'
    push check              ; ext cust,mime,map' check
    actor become            ; ext
    msg -1                  ; ext ofs,blob
    actor self              ; ext ofs,blob cust=SELF
    pair 1                  ; ext cust,ofs,blob
    roll 2                  ; cust,ofs,blob ext
    call new_ext_ptrn       ; cust,ofs,blob ext_ptrn
    ref std.send_msg
found:
    state 2                 ; reply=mime
    ref done
not_found:
    push #?                 ; reply=#?
done:
    state 1                 ; reply cust
    ref std.send_msg

; Test suite.

unknown:                    ; "/f.key"
    pair_t '/'
    pair_t 'f'
    pair_t '.'
    pair_t 'k'
    pair_t 'e'
    pair_t 'y'
    ref #nil

known:                      ; "/f.svg"
    pair_t '/'
    pair_t 'f'
    pair_t '.'
    ref svg_ext

test:                       ; judge <- {caps}
    push known              ; list=known
    ; push unknown            ; list=unknown
    state 0                 ; list judge
    push test_known         ; list judge test_known
    actor create            ; list cust=test_known.judge
    pair 1                  ; cust,list
    msg 0                   ; cust,list {caps}
    push dev.blob_key       ; cust,list {caps} blob_key
    dict get                ; cust,list blob_dev
    push blob.init          ; cust,list blob_dev init
    actor create            ; cust,list init.blob_dev
    ref std.send_msg
test_known:                 ; judge <- blob
    msg 0                   ; path=blob
    state 0                 ; path judge
    push test_done          ; path judge test_done
    actor create            ; path cust=test_done.judge
    pair 1                  ; cust,path
    push #?                 ; cust,path _
    push beh                ; cust,path _ beh
    actor create            ; cust,path beh._
    ref std.send_msg
test_done:                  ; judge <- type
    msg 0                   ; type
    eq svg_mime             ; type==svg_mime
    state 0                 ; type==svg_mime judge
    ref std.send_msg

.export
    beh
    test
