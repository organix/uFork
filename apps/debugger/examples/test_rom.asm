; Self-testing ROM image

rom:
; ( T           X           Y           Z           VALUE   NAME        )
; 0x0000 ,    0x0000 ,    0x0000 ,    0x0000 ,    ( ^0000   #?          )
; 0x0000 ,    0x0000 ,    0x0000 ,    0x0000 ,    ( ^0001   #nil        )
; 0x0000 ,    0x0000 ,    0x0000 ,    0x0000 ,    ( ^0002   #f          )
; 0x0000 ,    0x0000 ,    0x0000 ,    0x0000 ,    ( ^0003   #t          )
; 0x0000 ,    0x0000 ,    0x0000 ,    0x0000 ,    ( ^0004   #unit       )
; 0x000C ,    0x0001 ,    0x0001 ,    0x0000 ,    ( ^0005   EMPTY_DQ    )
; 0x0006 ,    0x8001 ,    0x0000 ,    0x0000 ,    ( ^0006   #type_t     )
; 0x0006 ,    0x0000 ,    0x0000 ,    0x0000 ,    ( ^0007   #fixnum_t   )
; 0x0006 ,    0x8002 ,    0x0000 ,    0x0000 ,    ( ^0008   #actor_t    )
; 0x0006 ,    0x8002 ,    0x0000 ,    0x0000 ,    ( ^0009   PROXY_T     )
; 0x0006 ,    0x8002 ,    0x0000 ,    0x0000 ,    ( ^000A   STUB_T      )
; 0x0006 ,    0x8003 ,    0x0000 ,    0x0000 ,    ( ^000B   #instr_t    )
; 0x0006 ,    0x8002 ,    0x0000 ,    0x0000 ,    ( ^000C   #pair_t     )
; 0x0006 ,    0x8003 ,    0x0000 ,    0x0000 ,    ( ^000D   #dict_t     )
; 0x0006 ,    0xFFFF ,    0x0000 ,    0x0000 ,    ( ^000E   FWD_REF_T   )
; 0x0006 ,    0x8000 ,    0x0000 ,    0x0000 ,    ( ^000F   FREE_T      )

cust_send:                  ; msg
    msg 1                   ; msg cust
; 0x000B ,    0x8018 ,    0x8001 ,    0x0011 ,    ( ^0010   msg 1       )
send_msg:                   ; msg cust
    send -1                 ; --
; 0x000B ,    0x801A ,    0xFFFF ,    0x0012 ,    ( ^0011   send -1     )
sink_beh:                   ; _ <- _
commit:
    end commit
; 0x000B ,    0x800F ,    0x8001 ,    0x0000 ,    ( ^0012   end commit  )
stop:
    end stop
; 0x000B ,    0x800F ,    0x8000 ,    0x0000 ,    ( ^0013   end stop    )

boot:                       ; _ <- _
    pair 0
; 0x000B ,    0x8011 ,    0x8000 ,    0x0015 ,    ( ^0014   pair 0      )
    assert #nil
; 0x000B ,    0x8007 ,    0x0001 ,    0x0016 ,    ( ^0015   assert #nil )
    push 3
; 0x000B ,    0x8002 ,    0x8003 ,    0x0017 ,    ( ^0016   push 3      )
    push 2
; 0x000B ,    0x8002 ,    0x8002 ,    0x0018 ,    ( ^0017   push 2      )
    pair 1
; 0x000B ,    0x8011 ,    0x8001 ,    0x0019 ,    ( ^0018   pair 1      )
    push 1
; 0x000B ,    0x8002 ,    0x8001 ,    0x001A ,    ( ^0019   push 1      )
    pair 1
; 0x000B ,    0x8011 ,    0x8001 ,    0x001B ,    ( ^001A   pair 1      )
    part 1
; 0x000B ,    0x8012 ,    0x8001 ,    0x001C ,    ( ^001B   part 1      )
    assert 1
; 0x000B ,    0x8007 ,    0x8001 ,    0x001D ,    ( ^001C   assert 1    )
    dup 0
; 0x000B ,    0x8016 ,    0x8000 ,    0x001E ,    ( ^001D   dup 0       )
    part 1
; 0x000B ,    0x8012 ,    0x8001 ,    0x001F ,    ( ^001E   part 1      )
    assert 2
; 0x000B ,    0x8007 ,    0x8002 ,    0x0020 ,    ( ^001F   assert 2    )
    dup 1
; 0x000B ,    0x8016 ,    0x8001 ,    0x0021 ,    ( ^0020   dup 1       )
    assert 3
; 0x000B ,    0x8007 ,    0x8003 ,    0x0022 ,    ( ^0021   assert 3    )
    drop 0
; 0x000B ,    0x8017 ,    0x8000 ,    0x0023 ,    ( ^0022   drop 0      )
    part 1
; 0x000B ,    0x8012 ,    0x8001 ,    0x0024 ,    ( ^0023   part 1      )
    drop 1
; 0x000B ,    0x8017 ,    0x8001 ,    0x0025 ,    ( ^0024   drop 1      )
    if stop
; 0x000B ,    0x8003 ,    0x0013 ,    0x0026 ,    ( ^0025   [#?] if     )
    push 0
; 0x000B ,    0x8002 ,    0x8000 ,    0x0027 ,    ( ^0026   push 0      )
    eq 0
; 0x000B ,    0x8006 ,    0x8000 ,    0x0028 ,    ( ^0027   eq 0        )
    if_not stop
; 0x000B ,    0x8003 ,    0x0029 ,    0x0013 ,    ( ^0028   [#t] if     )
    push -1
; 0x000B ,    0x8002 ,    0xFFFF ,    0x002A ,    ( ^0029   push -1     )
    eq 0
; 0x000B ,    0x8006 ,    0x8000 ,    0x002B ,    ( ^002A   eq 0        )
    if stop
; 0x000B ,    0x8003 ,    0x0013 ,    0x002C ,    ( ^002B   [#f] if     )
    push #nil
; 0x000B ,    0x8002 ,    0x0001 ,    0x002D ,    ( ^002C   push #nil   )
    if stop
; 0x000B ,    0x8003 ,    0x0013 ,    0x002E ,    ( ^002D   [#nil] if   )
    push #unit
; 0x000B ,    0x8002 ,    0x0004 ,    0x002F ,    ( ^002E   push #unit  )
    if_not stop
; 0x000B ,    0x8003 ,    0x0030 ,    0x0013 ,    ( ^002F   [#unit] if  )
    push 0
; 0x000B ,    0x8002 ,    0x8000 ,    0x0031 ,    ( ^0030   push 0      )
    if stop
; 0x000B ,    0x8003 ,    0x0013 ,    0x0012 ,    ( ^0031   [#0] if     )
    ref commit

.export
    boot
