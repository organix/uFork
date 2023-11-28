; The "race" requestor starts a list of 'requestors' in parallel. The value sent
; to the race requestor is sent to each of the requestors, and race's result is
; the result of the first requestor to successfully finish. All of the other
; requestors will be cancelled. If all of the requestors fail, then the race
; fails.

; TODO implement
