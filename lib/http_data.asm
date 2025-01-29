;
; Literal data for HTTP testing
;

;;; Example HTTP request
get_req:
;; GET /index.html HTTP/1.0
    pair_t 'G'
    pair_t 'E'
    pair_t 'T'
    pair_t ' '
    pair_t '/'
    pair_t 'i'
    pair_t 'n'
    pair_t 'd'
    pair_t 'e'
    pair_t 'x'
    pair_t '.'
    pair_t 'h'
    pair_t 't'
    pair_t 'm'
    pair_t 'l'
    pair_t ' '
    pair_t 'H'
    pair_t 'T'
    pair_t 'T'
    pair_t 'P'
    pair_t '/'
    pair_t '1'
    pair_t '.'
    pair_t '0'
    pair_t '\r'
    pair_t '\n'             ; size=26
req_hdrs:
;; Host: localhost
    pair_t 'H'
    pair_t 'o'
    pair_t 's'
    pair_t 't'
    pair_t ':'
    pair_t ' '
    pair_t 'l'
    pair_t 'o'
    pair_t 'c'
    pair_t 'a'
    pair_t 'l'
    pair_t 'h'
    pair_t 'o'
    pair_t 's'
    pair_t 't'
blankln:
    pair_t '\r'
    pair_t '\n'
crlf:
    pair_t '\r'
nl:
    pair_t '\n'
    ref #nil                ; size=26+19=45

;;; Example HTTP response
not_found_rsp:
;; HTTP/1.0 404 Not Found
    pair_t 'H'
    pair_t 'T'
    pair_t 'T'
    pair_t 'P'
    pair_t '/'
    pair_t '1'
    pair_t '.'
    pair_t '0'
    pair_t ' '
    pair_t '4'
    pair_t '0'
    pair_t '4'
    pair_t ' '
    pair_t 'N'
    pair_t 'o'
    pair_t 't'
    pair_t ' '
    pair_t 'F'
    pair_t 'o'
    pair_t 'u'
    pair_t 'n'
    pair_t 'd'
    pair_t '\r'
    pair_t '\n'
rsp_hdrs:
;; Content-Type: text/plain
    pair_t 'C'              ; offset=24
    pair_t 'o'
    pair_t 'n'
    pair_t 't'
    pair_t 'e'
    pair_t 'n'
    pair_t 't'
    pair_t '-'
    pair_t 'T'
    pair_t 'y'
    pair_t 'p'
    pair_t 'e'
    pair_t ':'
    pair_t ' '
    pair_t 't'              ; offset=38
    pair_t 'e'
    pair_t 'x'
    pair_t 't'
    pair_t '/'
    pair_t 'p'
    pair_t 'l'
    pair_t 'a'
    pair_t 'i'
    pair_t 'n'
    pair_t '\r'
    pair_t '\n'
;; Content-Length: 11
    pair_t 'C'              ; offset=50
    pair_t 'o'
    pair_t 'n'
    pair_t 't'
    pair_t 'e'
    pair_t 'n'
    pair_t 't'
    pair_t '-'
    pair_t 'L'
    pair_t 'e'
    pair_t 'n'
    pair_t 'g'
    pair_t 't'
    pair_t 'h'
    pair_t ':'
    pair_t ' '
    pair_t '1'              ; offset=66
    pair_t '1'
    pair_t '\r'
    pair_t '\n'
;;
    pair_t '\r'
    pair_t '\n'
content:
;; Not Found
    pair_t 'N'              ; offset=72
    pair_t 'o'
    pair_t 't'
    pair_t ' '
    pair_t 'F'
    pair_t 'o'
    pair_t 'u'
    pair_t 'n'
    pair_t 'd'
    ref crlf                ; offset=81

ok_rsp:
;; HTTP/1.0 200 OK
    pair_t 'H'
    pair_t 'T'
    pair_t 'T'
    pair_t 'P'
    pair_t '/'
    pair_t '1'
    pair_t '.'
    pair_t '0'
    pair_t ' '
    pair_t '2'
    pair_t '0'
    pair_t '0'
    pair_t ' '
    pair_t 'O'
    pair_t 'K'
    pair_t '\r'
    pair_t '\n'
    ref rsp_hdrs            ; offset=17

.export
    get_req
    req_hdrs
    blankln
    crlf
    nl
    not_found_rsp
    rsp_hdrs
    content
    ok_rsp
