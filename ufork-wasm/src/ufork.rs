// uFork virtual CPU

use core::fmt;

pub type Raw = u32;  // univeral value type
pub type Num = i32;  // fixnum integer type

// type-tag bits
const MSK_RAW: Raw      = 0xC000_0000;
const DIR_RAW: Raw      = 0x8000_0000;
const OPQ_RAW: Raw      = 0x4000_0000;

// literal values
pub const UNDEF: Val    = Val { raw: 0 }; //Val::new(0); -- const generic issue...
pub const NIL: Val      = Val { raw: 1 };
pub const FALSE: Val    = Val { raw: 2 };
pub const TRUE: Val     = Val { raw: 3 };
pub const UNIT: Val     = Val { raw: 4 };

pub const LITERAL_T: Val= Val { raw: 0 }; //ptrval(0);
pub const TYPE_T: Val   = Val { raw: 5 };
pub const EVENT_T: Val  = Val { raw: 6 };
pub const INSTR_T: Val  = Val { raw: 7 };
pub const ACTOR_T: Val  = Val { raw: 8 };
pub const FIXNUM_T: Val = Val { raw: 9 };
pub const SYMBOL_T: Val = Val { raw: 10 };
pub const PAIR_T: Val   = Val { raw: 11 };
pub const FEXPR_T: Val  = Val { raw: 12 };
pub const FREE_T: Val   = Val { raw: 13 };

pub const MEMORY: Val   = Val { raw: 14 };
pub const DDEQUE: Val   = Val { raw: 15 };
pub const START: Val    = Val { raw: 16 };

// instr values
pub const OP_TYPEQ: Val = Val { raw: DIR_RAW | 0 }; // fixnum(0)
pub const OP_CELL: Val  = Val { raw: DIR_RAW | 1 };
pub const OP_GET: Val   = Val { raw: DIR_RAW | 2 };
pub const OP_SET: Val   = Val { raw: DIR_RAW | 3 };
pub const OP_PAIR: Val  = Val { raw: DIR_RAW | 4 };
pub const OP_PART: Val  = Val { raw: DIR_RAW | 5 };
pub const OP_NTH: Val   = Val { raw: DIR_RAW | 6 };
pub const OP_PUSH: Val  = Val { raw: DIR_RAW | 7 };
pub const OP_DEPTH: Val = Val { raw: DIR_RAW | 8 };
pub const OP_DROP: Val  = Val { raw: DIR_RAW | 9 };
pub const OP_PICK: Val  = Val { raw: DIR_RAW | 10 };
pub const OP_DUP: Val   = Val { raw: DIR_RAW | 11 };
pub const OP_ROLL: Val  = Val { raw: DIR_RAW | 12 };
pub const OP_ALU: Val   = Val { raw: DIR_RAW | 13 };
pub const OP_EQ: Val    = Val { raw: DIR_RAW | 14 };
pub const OP_CMP: Val   = Val { raw: DIR_RAW | 15 };
pub const OP_IF: Val    = Val { raw: DIR_RAW | 16 };
pub const OP_MSG: Val   = Val { raw: DIR_RAW | 17 };
pub const OP_SELF: Val  = Val { raw: DIR_RAW | 18 };
pub const OP_SEND: Val  = Val { raw: DIR_RAW | 19 };
pub const OP_NEW: Val   = Val { raw: DIR_RAW | 20 };
pub const OP_BEH: Val   = Val { raw: DIR_RAW | 21 };
pub const OP_END: Val   = Val { raw: DIR_RAW | 22 };

// OP_END thread actions
pub const END_ABORT: Val    = Val { raw: DIR_RAW | -1 as Num as Raw };
pub const END_STOP: Val     = Val { raw: DIR_RAW | 0 };
pub const END_COMMIT: Val   = Val { raw: DIR_RAW | 1 };
pub const END_RELEASE: Val  = Val { raw: DIR_RAW | 2 };

// core memory limit
const QUAD_MAX: usize = 1<<12;  // 4K quad-cells

pub struct Core {
    quad_mem: [Typed; QUAD_MAX],
}

impl Core {
    pub fn new() -> Core {
        let mut quad_mem = [
            Typed::Empty;
            QUAD_MAX
        ];
        quad_mem[UNDEF.addr()]      = Typed::Literal;
        quad_mem[NIL.addr()]        = Typed::Literal;
        quad_mem[FALSE.addr()]      = Typed::Literal;
        quad_mem[TRUE.addr()]       = Typed::Literal;
        quad_mem[UNIT.addr()]       = Typed::Literal;
        quad_mem[TYPE_T.addr()]     = Typed::Type;
        quad_mem[EVENT_T.addr()]    = Typed::Type;
        quad_mem[INSTR_T.addr()]    = Typed::Type;
        quad_mem[ACTOR_T.addr()]    = Typed::Type;
        quad_mem[FIXNUM_T.addr()]   = Typed::Type;
        quad_mem[SYMBOL_T.addr()]   = Typed::Type;
        quad_mem[PAIR_T.addr()]     = Typed::Type;
        quad_mem[FEXPR_T.addr()]    = Typed::Type;
        quad_mem[FREE_T.addr()]     = Typed::Type;
        let start = START.raw();
        quad_mem[MEMORY.addr()]     = Typed::Memory { top: Ptr::new(start+50), next: NIL.ptr(), free: Fix::new(0), root: DDEQUE.ptr() };
        quad_mem[DDEQUE.addr()]     = Typed::Ddeque { e_first: Ptr::new(start), e_last: Ptr::new(start), k_first: NIL.ptr(), k_last: NIL.ptr() };
        quad_mem[START.addr()+0]    = Typed::Event { target: Cap::new(start+2), msg: ptrval(start+24), next: NIL.ptr() };
        quad_mem[START.addr()+1]    = Typed::Pair { car: UNIT, cdr: NIL };
        quad_mem[START.addr()+2]    = Typed::Actor { beh: Ptr::new(start+3), state: Ptr::new(start+1), events: None };
        quad_mem[START.addr()+3]    = Typed::Instr { op: Op::Push { v: fixnum(3), k: Ptr::new(start+4) } };
        quad_mem[START.addr()+4]    = Typed::Instr { op: Op::Push { v: fixnum(2), k: Ptr::new(start+5) } };
        quad_mem[START.addr()+5]    = Typed::Instr { op: Op::Push { v: fixnum(1), k: Ptr::new(start+27) } };
        quad_mem[START.addr()+6]    = Typed::Instr { op: Op::Typeq { t: FIXNUM_T.ptr(), k: Ptr::new(start+7) } };
        quad_mem[START.addr()+7]    = Typed::Instr { op: Op::If { t: Ptr::new(start+6), f: Ptr::new(start+8) } };
        quad_mem[START.addr()+8]    = Typed::Instr { op: Op::Drop { n: Fix::new(9), k: Ptr::new(start+9) } };
        quad_mem[START.addr()+9]    = Typed::Instr { op: Op::End { x: End::Stop } };
        quad_mem[START.addr()+10]   = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(start+11) } };
        quad_mem[START.addr()+11]   = Typed::Instr { op: Op::Roll { n: Fix::new(-1), k: Ptr::new(start+12) } };
        quad_mem[START.addr()+12]   = Typed::Instr { op: Op::Roll { n: Fix::new(1), k: Ptr::new(start+13) } };
        quad_mem[START.addr()+13]   = Typed::Instr { op: Op::Pick { n: Fix::new(3), k: Ptr::new(start+14) } };
        quad_mem[START.addr()+14]   = Typed::Instr { op: Op::Roll { n: Fix::new(-2), k: Ptr::new(start+15) } };
        quad_mem[START.addr()+15]   = Typed::Instr { op: Op::Roll { n: Fix::new(2), k: Ptr::new(start+16) } };
        quad_mem[START.addr()+16]   = Typed::Instr { op: Op::Roll { n: Fix::new(-3), k: Ptr::new(start+17) } };
        quad_mem[START.addr()+17]   = Typed::Instr { op: Op::Roll { n: Fix::new(3), k: Ptr::new(start+18) } };
        quad_mem[START.addr()+18]   = Typed::Instr { op: Op::Pick { n: Fix::new(0), k: Ptr::new(start+19) } };
        quad_mem[START.addr()+19]   = Typed::Instr { op: Op::Roll { n: Fix::new(0), k: Ptr::new(start+20) } };
        quad_mem[START.addr()+20]   = Typed::Instr { op: Op::Pick { n: Fix::new(10), k: Ptr::new(start+21) } };
        quad_mem[START.addr()+21]   = Typed::Instr { op: Op::Roll { n: Fix::new(-10), k: Ptr::new(start+22) } };
        quad_mem[START.addr()+22]   = Typed::Pair { car: UNIT, cdr: NIL };
        quad_mem[START.addr()+23]   = Typed::Instr { op: Op::End { x: End::Commit } };
        quad_mem[START.addr()+24]   = Typed::Pair { car: fixnum(-1), cdr: ptrval(start+25) };
        quad_mem[START.addr()+25]   = Typed::Pair { car: fixnum(-2), cdr: ptrval(start+26) };
        quad_mem[START.addr()+26]   = Typed::Pair { car: fixnum(-3), cdr: NIL };
        quad_mem[START.addr()+27]   = Typed::Instr { op: Op::Pair { n: Fix::new(1), k: Ptr::new(start+28) }};
        quad_mem[START.addr()+28]   = Typed::Instr { op: Op::Part { n: Fix::new(1), k: Ptr::new(start+29) }};
        quad_mem[START.addr()+29]   = Typed::Instr { op: Op::Pair { n: Fix::new(2), k: Ptr::new(start+30) }};
        quad_mem[START.addr()+30]   = Typed::Instr { op: Op::Part { n: Fix::new(2), k: Ptr::new(start+31) }};
        quad_mem[START.addr()+31]   = Typed::Instr { op: Op::Pair { n: Fix::new(3), k: Ptr::new(start+32) }};
        quad_mem[START.addr()+32]   = Typed::Instr { op: Op::Part { n: Fix::new(3), k: Ptr::new(start+33) }};
        quad_mem[START.addr()+33]   = Typed::Instr { op: Op::Pair { n: Fix::new(0), k: Ptr::new(start+39) }};
        quad_mem[START.addr()+34]   = Typed::Instr { op: Op::Myself { k: Ptr::new(start+35) }};
        quad_mem[START.addr()+35]   = Typed::Instr { op: Op::Send { n: Fix::new(3), k: Ptr::new(start+36) }};
        quad_mem[START.addr()+36]   = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(start+37) }};
        quad_mem[START.addr()+37]   = Typed::Instr { op: Op::Myself { k: Ptr::new(start+38) }};
        quad_mem[START.addr()+38]   = Typed::Instr { op: Op::Send { n: Fix::new(0), k: Ptr::new(start+23) }};
        quad_mem[START.addr()+39]   = Typed::Instr { op: Op::Push { v: ptrval(start+9), k: Ptr::new(start+40) }};
        quad_mem[START.addr()+40]   = Typed::Instr { op: Op::Beh { n: Fix::new(3), k: Ptr::new(start+37) }};
        quad_mem[START.addr()+41]   = Typed::Instr { op: Op::Pick { n: Fix::new(2), k: Ptr::new(start+42) }};
        quad_mem[START.addr()+42]   = Typed::Instr { op: Op::Roll { n: Fix::new(-2), k: Ptr::new(start+43) }};
        quad_mem[START.addr()+43]   = Typed::Instr { op: Op::Send { n: Fix::new(0), k: Ptr::new(start+6) }};

        Core {
            quad_mem,
        }
    }

    pub fn run_loop(&mut self) {
        loop {
            self.check_for_interrupt();
            self.dispatch_event();
            if !self.execute_instruction() {
                return;
            }
        }
    }
    pub fn check_for_interrupt(&mut self) -> bool {
        false
    }
    pub fn dispatch_event(&mut self) -> bool {
        if let Some(ep) = self.event_dequeue() {
            if let Typed::Event { target, .. } = self.typed(ep) {
                let a_ptr = Ptr::new(target.raw());  // WARNING: converting Cap to Ptr!
                println!("dispatch_event: target={} -> {}", a_ptr, self.typed(a_ptr));
                if let Typed::Actor { beh, state, events } = *self.typed(a_ptr) {
                    match events {
                        Some(_) => {
                            // target actor is busy, retry later...
                            self.event_enqueue(ep);
                            false  // no event dispatched
                        },
                        None => {
                            // begin actor-event transaction
                            if let Typed::Actor { events, .. } = self.typed_mut(a_ptr) {
                                *events = Some(NIL.ptr());
                            };
                            let kp = self.new_cont(beh, state, ep);
                            println!("dispatch_event: cont={} -> {}", kp, self.typed(kp));
                            self.cont_enqueue(kp);
                            true  // event dispatched
                        },
                    }
                } else {
                    panic!("dispatch_event: requires actor, got {} -> {}", a_ptr, self.typed(a_ptr));
                }
            } else {
                panic!("dispatch_event: requires event, got {} -> {}", ep, self.typed(ep));
            }
        } else {
            println!("dispatch_event: event queue empty");
            false
        }
    }
    pub fn execute_instruction(&mut self) -> bool {
        let kp = self.k_first();
        println!("execute_instruction: kp={} -> {}", kp, self.typed(kp));
        if let Typed::Cont { ip, ep, .. } = *self.typed(kp) {
            println!("execute_instruction: ep={} -> {}", ep, self.typed(ep));
            println!("execute_instruction: ip={} -> {}", ip, self.typed(ip));
            if let Typed::Instr { op } = *self.typed(ip) {
                let ip_ = self.perform_op(&op);
                println!("execute_instruction: ip'={} -> {}", ip_, self.typed(ip_));
                self.set_ip(ip_);
                assert_eq!(kp, self.cont_dequeue().unwrap());
                if self.in_heap(ip_.val()) {
                    // re-queue updated continuation
                    self.cont_enqueue(kp);
                } else {
                    // free dead continuation and associated event
                    self.free(ep);
                    self.free(kp);
                }
            } else {
                panic!("Illegal instruction!");
            }
            true  // instruction executed
        } else {
            println!("execute_instruction: continuation queue empty");
            false  // continuation queue is empty
        }
    }
    fn perform_op(&mut self, op: &Op) -> Ptr {
        match op {
            Op::Typeq { t, k } => {
                println!("op_typeq: typ={}", t);
                let val = self.stack_pop();
                println!("op_typeq: val={}", val);
                let r = if self.typeq(t.val(), val) { TRUE } else { FALSE };
                self.stack_push(r);
                *k
            },
            Op::Pair { n, k } => {
                println!("op_pair: cnt={}", n);
                let mut num = n.num();
                assert!(num < 64);
                if num > 0 {
                    let h = self.stack_pop();
                    let lst = self.cons(h, NIL);
                    let mut p = lst;
                    while num > 1 {
                        let h = self.stack_pop();
                        let q = self.cons(h, NIL);
                        self.set_cdr(p, q.val());
                        p = q;
                        num -= 1;
                    }
                    let t = self.stack_pop();
                    self.set_cdr(p, t);
                    self.stack_push(lst.val());
                };
                *k
            },
            Op::Part { n, k } => {
                println!("op_part: cnt={}", n);
                let mut num = n.num();
                assert!(num < 64);
                let mut s = match Ptr::from(self.stack_pop()) {
                    Some(ptr) => ptr,
                    None => UNDEF.ptr(),
                };
                if num > 0 {
                    let lst = self.cons(self.car(s), NIL);
                    let mut p = lst;
                    while num > 1 {
                        s = match Ptr::from(self.cdr(s)) {
                            Some(ptr) => ptr,
                            None => UNDEF.ptr(),
                        };
                        let q = self.cons(self.car(s), NIL);
                        self.set_cdr(p, q.val());
                        p = q;
                        num -= 1;
                    }
                    let t = self.cons(self.cdr(s), self.sp().val());
                    self.set_cdr(p, t.val());
                    self.set_sp(lst);
                }
                *k
            },
            Op::Nth { n, k } => {
                println!("op_nth: idx={}", n);
                let lst = self.stack_pop();
                println!("op_nth: lst={}", lst);
                let r = self.extract_nth(lst, n.num());
                println!("op_nth: r={}", r);
                self.stack_push(r);
                *k
            },
            Op::Push { v, k } => {
                println!("op_push: val={}", v);
                self.stack_push(*v);
                *k
            },
            Op::Drop { n, k } => {
                println!("op_drop: idx={}", n);
                let mut num = n.num();
                assert!(num < 64);
                while num > 0 {
                    self.stack_pop();
                    num -= 1;
                };
                *k
            },
            Op::Pick { n, k } => {
                println!("op_pick: idx={}", n);
                let num = n.num();
                let r = if num > 0 {
                    let lst = self.sp().val();
                    self.extract_nth(lst, num)
                } else {
                    UNDEF
                };
                println!("op_pick: r={}", r);
                self.stack_push(r);
                *k
            },
            Op::Roll { n, k } => {
                println!("op_roll: idx={}", n);
                let num = n.num();
                if num > 1 {
                    assert!(num < 64);
                    let sp = self.sp().val();
                    let (q, p) = self.split_nth(sp, num);
                    if self.typeq(PAIR_T, p) {
                        self.set_cdr(q.ptr(), self.cdr(p.ptr()));
                        self.set_cdr(p.ptr(), sp);
                        self.set_sp(p.ptr());
                    } else {
                        self.stack_push(UNDEF);  // out of range
                    }
                } else if num < -1 {
                    assert!(num > -64);
                    let sp = self.sp().val();
                    let (_q, p) = self.split_nth(sp, -num);
                    if self.typeq(PAIR_T, p) {
                        self.set_sp(self.cdr(sp.ptr()).ptr());
                        self.set_cdr(sp.ptr(), self.cdr(p.ptr()));
                        self.set_cdr(p.ptr(), sp);
                    } else {
                        self.stack_pop();  // out of range
                    }
                };
                *k
            },
            Op::Eq { v, k } => {
                println!("op_eq: v={}", v);
                let vv = self.stack_pop();
                println!("op_eq: vv={}", vv);
                let r = if *v == vv { TRUE } else { FALSE };
                println!("op_eq: r={}", r);
                self.stack_push(r);
                *k
            },
            Op::If { t, f } => {
                let b = self.stack_pop();
                println!("op_if: b={}", b);
                println!("op_if: t={}", t);
                println!("op_if: f={}", f);
                if falsy(b) { *f } else { *t }
            },
            Op::Msg { n, k } => {
                println!("op_msg: idx={}", n);
                let r = match self.typed(self.ep()) {
                    Typed::Event { msg, .. } => {
                        let lst = *msg;
                        println!("op_msg: lst={}", lst);
                        let r = self.extract_nth(lst, n.num());
                        r
                    },
                    _ => UNDEF,
                };
                println!("op_msg: r={}", r);
                self.stack_push(r);
                *k
            },
            Op::Myself { k } => {
                let a = match self.typed(self.ep()) {
                    Typed::Event { target, .. } => target.val(),
                    _ => UNDEF,
                };
                println!("op_self: a={} -> {}", a, self.typed(Ptr::new(a.raw())));
                self.stack_push(a);
                *k
            }
            Op::Send { n, k } => {
                println!("op_send: idx={}", n);
                let num = n.num();
                let target = self.stack_pop();
                println!("op_send: target={}", target);
                assert!(self.typeq(ACTOR_T, target));
                let msg = if num > 0 {
                    self.pop_counted(num)
                } else {
                    self.stack_pop()
                };
                println!("op_send: msg={}", msg);
                let ep = self.new_event(target.cap(), msg);
                let me = self.self_ptr().unwrap();
                println!("op_send: me={} -> {}", me, self.typed(me));
                if let Typed::Actor { events, .. } = self.typed(me) {
                    let next_ = events.unwrap();
                    if let Typed::Event { next, .. } = self.typed_mut(ep) {
                        *next = next_;
                    }
                }
                println!("op_send: ep={} -> {}", ep, self.typed(ep));
                if let Typed::Actor { events, .. } = self.typed_mut(me) {
                    *events = Some(ep);
                }
                println!("op_send: me'={} -> {}", me, self.typed(me));
                *k
            },
            Op::New { n, k } => {
                println!("op_new: idx={}", n);
                let num = n.num();
                let ip = self.stack_pop();
                println!("op_new: ip={}", ip);
                assert!(self.typeq(INSTR_T, ip));
                let sp = self.pop_counted(num);
                println!("op_new: sp={}", sp);
                let a = self.new_actor(ip.ptr(), sp.ptr());
                println!("op_new: actor={} -> {}", a, Ptr::new(a.raw()));
                self.stack_push(a.val());
                *k
            },
            Op::Beh { n, k } => {
                println!("op_beh: idx={}", n);
                let num = n.num();
                let ip = self.stack_pop();
                println!("op_beh: ip={}", ip);
                assert!(self.typeq(INSTR_T, ip));
                let sp = self.pop_counted(num);
                println!("op_beh: sp={}", sp);
                let me = self.self_ptr().unwrap();
                println!("op_beh: me={} -> {}", me, self.typed(me));
                if let Typed::Actor { beh, state, .. } = self.typed_mut(me) {
                    *beh = ip.ptr();
                    *state = sp.ptr();
                }
                println!("op_beh: me'={} -> {}", me, self.typed(me));
                *k
            },
            Op::End { x } => {
                println!("op_end: x={}", x);
                let me = self.self_ptr().unwrap();
                println!("op_end: me={} -> {}", me, self.typed(me));
                match x {
                    End::Abort => {
                        let _r = self.stack_pop();  // reason for abort
                        println!("op_end: reason={}", _r);
                        self.actor_abort(me);
                        UNDEF.ptr()
                    },
                    End::Stop => {
                        UNIT.ptr()
                    },
                    End::Commit => {
                        self.actor_commit(me);
                        TRUE.ptr()
                    },
                    End::Release => {
                        if let Typed::Actor { state, .. } = self.typed_mut(me) {
                            *state = NIL.ptr();  // no reserved stack
                        }
                        self.actor_commit(me);
                        self.free(me);  // free actor
                        FALSE.ptr()
                    },
                }
            },
        }
    }

    fn event_enqueue(&mut self, ep: Ptr) {
        if let Typed::Event { next, .. } = self.typed_mut(ep) {
            *next = NIL.ptr();
        } else {
            panic!("event_enqueue: requires event, got {} -> {}", ep, self.typed(ep));
        }
        if NIL.ptr() == self.e_first() {
            self.set_e_first(ep);
        } else if let Typed::Event { next, ..  } = self.typed_mut(self.e_last()) {
            *next = ep;
        }
        self.set_e_last(ep);
    }
    fn event_dequeue(&mut self) -> Option<Ptr> {
        let ep = self.e_first();
        if NIL.ptr() == ep {
            None
        } else if let Typed::Event { next, .. } = self.typed(ep) {
            self.set_e_first(*next);
            if NIL.ptr() == self.e_first() {
                self.set_e_last(NIL.ptr());  // empty queue
            }
            Some(ep)
        } else {
            panic!("event_dequeue: invalid ep = {} -> {}", ep, self.typed(ep));
        }
    }

    fn cont_enqueue(&mut self, kp: Ptr) {
        if let Typed::Cont { next, .. } = self.typed_mut(kp) {
            *next = NIL.ptr();
        } else {
            panic!("cont_enqueue: requires continuation, got {} -> {}", kp, self.typed(kp));
        };
        if NIL.ptr() == self.k_first() {
            self.set_k_first(kp);
        } else if let Typed::Cont { next, ..  } = self.typed_mut(self.k_last()) {
            *next = kp;
        }
        self.set_k_last(kp);
    }
    fn cont_dequeue(&mut self) -> Option<Ptr> {
        let kp = self.k_first();
        if NIL.ptr() == kp {
            None
        } else if let Typed::Cont { next, .. } = self.typed(kp) {
            self.set_k_first(*next);
            if NIL.ptr() == self.k_first() {
                self.set_k_last(NIL.ptr());  // empty queue
            }
            Some(kp)
        } else {
            panic!("cont_dequeue: invalid kp = {} -> {}", kp, self.typed(kp));
        }
    }

    fn actor_commit(&mut self, me: Ptr) {
        if let Typed::Actor { state, .. } = self.typed(me) {
            let top = *state;
            self.stack_clear(top);
        }
        if let Typed::Actor { events, .. } = self.typed(me) {
            let mut ep = events.unwrap();
            // move sent-message events to event queue
            while let Typed::Event { next, .. } = self.typed(ep) {
                println!("actor_commit: ep={} -> {}", ep, self.typed(ep));
                let p = ep;
                ep = *next;
                self.event_enqueue(p);
            }
        }
        if let Typed::Actor { events, .. } = self.typed_mut(me) {
            *events = None;  // end actor transaction
        }
    }
    fn actor_abort(&mut self, me: Ptr) {
        if let Typed::Actor { state, .. } = self.typed(me) {
            let top = *state;
            self.stack_clear(top);
        }
        if let Typed::Actor { events, .. } = self.typed(me) {
            let mut ep = events.unwrap();
            // free sent-message events
            while let Typed::Event { next, .. } = self.typed(ep) {
                println!("actor_abort: ep={} -> {}", ep, self.typed(ep));
                let p = ep;
                ep = *next;
                self.free(p);
            }
        }
        if let Typed::Actor { events, .. } = self.typed_mut(me) {
            *events = None;  // end actor transaction
        }
    }
    fn self_ptr(&self) -> Option<Ptr> {
        match self.typed(self.ep()) {
            Typed::Event { target, .. } => {
                let ptr = Ptr::new(target.raw());  // WARNING: converting Cap to Ptr!
                match self.typed(ptr) {
                    Typed::Actor { .. } => Some(ptr),
                    _ => None,
                }
            },
            _ => None,
        }
    }

    fn pop_counted(&mut self, num: Num) -> Val {
        let mut n = num;
        if n > 0 {  // build list from stack
            let sp = self.sp().val();
            let mut v = sp;
            let mut p = UNDEF.ptr();
            while n > 0 && self.typeq(PAIR_T, v) {
                p = v.ptr();
                v = self.cdr(p);
                n -= 1;
            }
            if self.typeq(PAIR_T, p.val()) {
                self.set_cdr(p, NIL);
            }
            self.set_sp(v.ptr());
            sp
        } else {  // empty list
            NIL
        }
    }
    fn split_nth(&self, lst: Val, num: Num) -> (Val, Val) {
        let mut p = lst;
        let mut q = UNDEF;
        let mut n = num;
        assert!(n < 64);
        while n > 1 && self.typeq(PAIR_T, p) {
            q = p;
            p = self.cdr(p.ptr());
            n -= 1;
        }
        (q, p)
    }
    fn extract_nth(&self, lst: Val, num: Num) -> Val {
        let mut p = lst;
        let mut v = UNDEF;
        let mut n = num;
        if n == 0 {  // entire list/message
            v = p;
        } else if n > 0 {  // item at n-th index
            assert!(n < 64);
            while self.typeq(PAIR_T, p) {
                n -= 1;
                if n <= 0 { break; }
                p = self.cdr(p.ptr());
            }
            if n == 0 {
                v = self.car(p.ptr());
            }
        } else {  // `-n` selects the n-th tail
            assert!(n > -64);
            while self.typeq(PAIR_T, p) {
                n += 1;
                if n >= 0 { break; }
                p = self.cdr(p.ptr());
            }
            if n == 0 {
                v = self.cdr(p.ptr());
            }
        }
        v
    }

    fn stack_push(&mut self, val: Val) {
        let sp = self.cons(val, self.sp().val());
        self.set_sp(sp);
    }
    fn stack_pop(&mut self) -> Val {
        let sp = self.sp();
        if self.typeq(PAIR_T, sp.val()) {
            let item = self.car(sp);
            self.set_sp(self.cdr(sp).ptr());
            self.free(sp);  // free pair holding stack item
            item
        } else {
            println!("stack_pop: underflow!");
            UNDEF
        }
    }
    fn stack_clear(&mut self, top: Ptr) {
        let mut sp = self.sp();
        while sp != top && self.typeq(PAIR_T, sp.val()) {
            let p = sp;
            sp = self.cdr(p).ptr();
            self.free(p);  // free pair holding stack item
        }
        self.set_sp(sp);
    }

    pub fn ip(&self) -> Ptr {  // instruction pointer
        match self.typed(self.k_first()) {
            Typed::Cont { ip, .. } => ip.ptr(),
            _ => UNDEF.ptr()
        }
    }
    pub fn sp(&self) -> Ptr {  // stack pointer
        match self.typed(self.k_first()) {
            Typed::Cont { sp, .. } => sp.ptr(),
            _ => UNDEF.ptr()
        }
    }
    pub fn ep(&self) -> Ptr {  // event pointer
        match self.typed(self.k_first()) {
            Typed::Cont { ep, .. } => ep.ptr(),
            _ => UNDEF.ptr()
        }
    }
    fn set_ip(&mut self, ptr: Ptr) {
        let typed = self.typed_mut(self.k_first());
        if let Typed::Cont { ip, .. } = typed {
            *ip = ptr;
        }
    }
    fn set_sp(&mut self, ptr: Ptr) {
        let typed = self.typed_mut(self.k_first());
        if let Typed::Cont { sp, .. } = typed {
            *sp = ptr;
        }
    }

    pub fn new_event(&mut self, target: Cap, msg: Val) -> Ptr {
        let event = Typed::Event { target, msg, next: NIL.ptr() };
        self.alloc(&event)
    }
    pub fn new_cont(&mut self, ip: Ptr, sp: Ptr, ep: Ptr) -> Ptr {
        let cont = Typed::Cont { ip, sp, ep, next: NIL.ptr() };
        self.alloc(&cont)
    }
    pub fn new_actor(&mut self, beh: Ptr, state: Ptr) -> Cap {
        let actor = Typed::Actor { beh, state, events: None };
        Cap::new(self.alloc(&actor).raw())  // convert from Ptr to Cap!
    }
    pub fn next(&self, ptr: Ptr) -> Ptr {
        let typed = *self.typed(ptr);
        match typed {
            Typed::Event { next, .. } => next,
            Typed::Cont { next, .. } => next,
            Typed::Free { next } => next,
            Typed::Quad { z, .. } => z.ptr(),
            _ => UNDEF.ptr(),
        }
    }

    pub fn cons(&mut self, car: Val, cdr: Val) -> Ptr {
        let pair = Typed::Pair { car, cdr };
        self.alloc(&pair)
    }
    pub fn car(&self, pair: Ptr) -> Val {
        let typed = *self.typed(pair);
        match typed {
            Typed::Pair { car, .. } => car,
            _ => UNDEF,
        }
    }
    pub fn cdr(&self, pair: Ptr) -> Val {
        let typed = *self.typed(pair);
        match typed {
            Typed::Pair { cdr, .. } => cdr,
            _ => UNDEF,
        }
    }
    pub fn set_car(&mut self, pair: Ptr, val: Val) {
        assert!(self.in_heap(pair.val()));
        if let Typed::Pair { car, .. } = self.typed_mut(pair) {
            *car = val;
        }
    }
    pub fn set_cdr(&mut self, pair: Ptr, val: Val) {
        assert!(self.in_heap(pair.val()));
        if let Typed::Pair { cdr, .. } = self.typed_mut(pair) {
            *cdr = val;
        }
    }

    pub fn typeq(&self, typ: Val, val: Val) -> bool {
        if FIXNUM_T == typ {
            let fix = Fix::from(val);
            fix.is_some()
        } else if ACTOR_T == typ {
            match Cap::from(val) {
                Some(cap) => {
                    let ptr = Ptr::new(cap.raw());  // WARNING: converting Cap to Ptr!
                    match self.typed(ptr) {
                        Typed::Actor { .. } => true,
                        _ => false,
                    }
                },
                None => false,
            }
        } else {
            match Ptr::from(val) {
                Some(ptr) => {
                    match self.typed(ptr) {
                        Typed::Empty => typ == UNDEF,
                        Typed::Literal => typ == LITERAL_T,
                        Typed::Type => typ == TYPE_T,
                        Typed::Event { .. } => typ == EVENT_T,
                        //Typed::Cont { .. } => false,
                        Typed::Instr { .. } => typ == INSTR_T,
                        //Typed::Actor { .. } => false,
                        Typed::Symbol { .. } => typ == SYMBOL_T,
                        Typed::Pair { .. } => typ == PAIR_T,
                        Typed::Fexpr { .. } => typ == FEXPR_T,
                        Typed::Free { .. } => typ == FREE_T,
                        Typed::Quad { t, .. } => typ == *t,
                        _ => false,
                    }
                },
                None => false,
            }
        }
    }

    pub fn alloc(&mut self, init: &Typed) -> Ptr {
        let ptr = match *self.typed(self.mem_next()) {
            Typed::Free { next } => {
                // use quad from free-list
                let ptr = self.mem_next();
                let num = self.mem_free().num();
                assert!(num > 0);
                self.set_mem_free(Fix::new(num - 1));
                self.set_mem_next(next);
                ptr
            },
            _ => {
                // expand top-of-memory
                if self.mem_top().addr() >= QUAD_MAX {
                    panic!("out of memory!");
                }
                let ptr = self.mem_top();
                self.set_mem_top(Ptr::new(ptr.raw() + 1));
                ptr
            },
        };
        *self.typed_mut(ptr) = *init;
        ptr
    }
    pub fn free(&mut self, ptr: Ptr) {
        assert!(self.in_heap(ptr.val()));
        if let Typed::Free { .. } = self.typed(ptr) {
            panic!("double-free {}", ptr);
        }
        let typed = Typed::Free { next: self.mem_next() };
        *self.typed_mut(ptr) = typed;
        self.set_mem_next(ptr);
        let num = self.mem_free().num();
        self.set_mem_free(Fix::new(num + 1));
    }

    pub fn typed(&self, ptr: Ptr) -> &Typed {
        let addr = self.addr(ptr).unwrap();
        &self.quad_mem[addr]
    }
    pub fn typed_mut(&mut self, ptr: Ptr) -> &mut Typed {
        assert!(self.in_heap(ptr.val()));
        let addr = self.addr(ptr).unwrap();
        &mut self.quad_mem[addr]
    }

    pub fn addr(&self, ptr: Ptr) -> Option<usize> {
        let addr = ptr.addr();
        if addr < self.mem_top().addr() {
            Some(addr)
        } else {
            None
        }
    }
    pub fn in_heap(&self, val: Val) -> bool {
        let raw = val.raw();
        (raw < self.mem_top().raw()) && (raw >= MEMORY.raw())
    }

    fn e_first(&self) -> Ptr {
        match self.typed(DDEQUE.ptr()) {
            Typed::Ddeque { e_first, .. } => *e_first,
            _ => panic!("Ddeque required!"),
        }
    }
    fn set_e_first(&mut self, ptr: Ptr) {
        match self.typed_mut(DDEQUE.ptr()) {
            Typed::Ddeque { e_first, .. } => { *e_first = ptr; },
            _ => panic!("Ddeque required!"),
        }
    }
    fn e_last(&self) -> Ptr {
        match self.typed(DDEQUE.ptr()) {
            Typed::Ddeque { e_last, .. } => *e_last,
            _ => panic!("Ddeque required!"),
        }
    }
    fn set_e_last(&mut self, ptr: Ptr) {
        match self.typed_mut(DDEQUE.ptr()) {
            Typed::Ddeque { e_last, .. } => { *e_last = ptr; },
            _ => panic!("Ddeque required!"),
        }
    }
    fn k_first(&self) -> Ptr {
        match self.typed(DDEQUE.ptr()) {
            Typed::Ddeque { k_first, .. } => *k_first,
            _ => panic!("Ddeque required!"),
        }
    }
    fn set_k_first(&mut self, ptr: Ptr) {
        match self.typed_mut(DDEQUE.ptr()) {
            Typed::Ddeque { k_first, .. } => { *k_first = ptr; },
            _ => panic!("Ddeque required!"),
        }
    }
    fn k_last(&self) -> Ptr {
        match self.typed(DDEQUE.ptr()) {
            Typed::Ddeque { k_last, .. } => *k_last,
            _ => panic!("Ddeque required!"),
        }
    }
    fn set_k_last(&mut self, ptr: Ptr) {
        match self.typed_mut(DDEQUE.ptr()) {
            Typed::Ddeque { k_last, .. } => { *k_last = ptr; },
            _ => panic!("Ddeque required!"),
        }
    }

    fn mem_top(&self) -> Ptr {
        match &self.quad_mem[MEMORY.addr()] {
            Typed::Memory { top, .. } => *top,
            _ => panic!("Memory required!"),
        }
    }
    fn set_mem_top(&mut self, ptr: Ptr) {
        match &mut self.quad_mem[MEMORY.addr()] {
            Typed::Memory { top, .. } => { *top = ptr; },
            _ => panic!("Memory required!"),
        }
    }
    fn mem_next(&self) -> Ptr {
        match &self.quad_mem[MEMORY.addr()] {
            Typed::Memory { next, .. } => *next,
            _ => panic!("Memory required!"),
        }
    }
    fn set_mem_next(&mut self, ptr: Ptr) {
        match &mut self.quad_mem[MEMORY.addr()] {
            Typed::Memory { next, .. } => { *next = ptr; },
            _ => panic!("Memory required!"),
        }
    }
    fn mem_free(&self) -> Fix {
        match &self.quad_mem[MEMORY.addr()] {
            Typed::Memory { free, .. } => *free,
            _ => panic!("Memory required!"),
        }
    }
    fn set_mem_free(&mut self, fix: Fix) {
        match &mut self.quad_mem[MEMORY.addr()] {
            Typed::Memory { free, .. } => { *free = fix; },
            _ => panic!("Memory required!"),
        }
    }
    fn _mem_root(&self) -> Ptr {
        match &self.quad_mem[MEMORY.addr()] {
            Typed::Memory { root, .. } => *root,
            _ => panic!("Memory required!"),
        }
    }
    fn _set_mem_root(&mut self, ptr: Ptr) {
        match &mut self.quad_mem[MEMORY.addr()] {
            Typed::Memory { root, .. } => { *root = ptr; },
            _ => panic!("Memory required!"),
        }
    }
}

fn falsy(v: Val) -> bool {
    v == FALSE  // FIXME: what should be considered "falsey" besides FALSE?
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Typed {
    Empty,
    Literal,
    Type,
    Event { target: Cap, msg: Val, next: Ptr },
    Cont { ip: Ptr, sp: Ptr, ep: Ptr, next: Ptr },
    Instr { op: Op },
    Actor { beh: Ptr, state: Ptr, events: Option<Ptr> },
    Symbol { hash: Fix, key: Ptr, val: Val },
    Pair { car: Val, cdr: Val },
    Fexpr { func: Ptr },
    Free { next: Ptr },
    Ddeque { e_first: Ptr, e_last: Ptr, k_first: Ptr, k_last: Ptr },
    Memory { top: Ptr, next: Ptr, free: Fix, root: Ptr },
    Quad { t: Val, x: Val, y: Val, z: Val },
}
impl Typed {
    pub fn from(quad: &Quad) -> Option<Typed> {
        match quad.t() {
            LITERAL_T => Some(Typed::Literal),
            TYPE_T => Some(Typed::Type),
            EVENT_T => Some(Typed::Event { target: quad.x().cap(), msg: quad.y(), next: quad.z().ptr() }),
            INSTR_T => Op::from(quad),
            ACTOR_T => Some(Typed::Actor { beh: quad.x().ptr(), state: quad.y().ptr(), events: match quad.z() {
                UNDEF => None,
                val => Some(val.ptr()),
            }}),
            SYMBOL_T => Some(Typed::Symbol { hash: quad.x().fix(), key: quad.y().ptr(), val: quad.z() }),
            PAIR_T => Some(Typed::Pair { car: quad.x(), cdr: quad.y() }),
            FEXPR_T => Some(Typed::Fexpr { func: quad.x().ptr() }),
            FREE_T => Some(Typed::Free { next: quad.z().ptr() }),
            _ => Some(Typed::Quad { t: quad.t(), x: quad.x(), y: quad.y(), z: quad.z() }),
        }
    }
    pub fn quad(&self) -> Quad {
        match self {
            Typed::Empty => Quad::new(UNDEF, UNDEF, UNDEF, UNDEF),
            Typed::Literal => Quad::new(LITERAL_T, UNDEF, UNDEF, UNDEF),
            Typed::Type => Quad::new(TYPE_T, UNDEF, UNDEF, UNDEF),
            Typed::Event { target, msg, next } => Quad::new(EVENT_T, target.val(), msg.val(), next.val()),
            Typed::Cont { ip, sp, ep, next } => Quad::new(ip.val(), sp.val(), ep.val(), next.val()),
            Typed::Instr { op } => op.quad(),
            Typed::Actor { beh, state, events } => Quad::new(ACTOR_T, beh.val(), state.val(), match events {
                None => UNDEF,
                Some(ptr) => ptr.val(),
            }),
            Typed::Symbol { hash, key, val } => Quad::new(SYMBOL_T, hash.val(), key.val(), val.val()),
            Typed::Pair { car, cdr } => Quad::new(PAIR_T, car.val(), cdr.val(), UNDEF),
            Typed::Fexpr { func } => Quad::new(FEXPR_T, func.val(), UNDEF, UNDEF),
            Typed::Free { next } => Quad::new(FREE_T, UNDEF, UNDEF, next.val()),
            Typed::Ddeque { e_first, e_last, k_first, k_last } => Quad::new(e_first.val(), e_last.val(), k_first.val(), k_last.val()),
            Typed::Memory { top, next, free, root } => Quad::new(top.val(), next.val(), free.val(), root.val()),
            Typed::Quad { t, x, y, z } => Quad::new(t.val(), x.val(), y.val(), z.val()),
        }
    }
}
impl fmt::Display for Typed {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Typed::Empty => write!(fmt, "Empty"),
            Typed::Literal => write!(fmt, "Literal"),
            Typed::Type => write!(fmt, "Type"),
            Typed::Event { target, msg, next } => write!(fmt, "Event{{ target:{}, msg:{}, next:{} }}", target, msg, next),
            Typed::Cont { ip, sp, ep, next } => write!(fmt, "Cont{{ ip:{}, sp:{}, ep:{}, next:{} }}", ip, sp, ep, next),
            Typed::Instr { op } => write!(fmt, "Instr{{ op:{} }}", op),
            Typed::Actor { beh, state, events } => write!(fmt, "Actor{{ beh:{}, state:{}, events:{} }}", beh, state, match events {
                Some(ptr) => ptr.val(),
                None => UNDEF,
            }),
            Typed::Symbol { hash, key, val } => write!(fmt, "Symbol{{ hash:{}, key:{}, val:{} }}", hash, key, val),
            Typed::Pair { car, cdr } => write!(fmt, "Pair{{ car:{}, cdr:{} }}", car, cdr),
            Typed::Fexpr { func } => write!(fmt, "Fexpr{{ func:{} }}", func),
            Typed::Free { next } => write!(fmt, "Free{{ next:{} }}", next),
            Typed::Ddeque { e_first, e_last, k_first, k_last } => write!(fmt, "Ddeque{{ e_first:{}, e_last:{}, k_first:{}, k_last:{} }}", e_first, e_last, k_first, k_last),
            Typed::Memory { top, next, free, root } => write!(fmt, "Memory{{ top:{}, next:{}, free:{}, root:{} }}", top, next, free, root),
            Typed::Quad { t, x, y, z } => write!(fmt, "Quad{{ t:{}, x:{}, y:{}, z:{} }}", t, x, y, z),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Op {
    Typeq { t: Ptr, k: Ptr },
    Pair { n: Fix, k: Ptr },
    Part { n: Fix, k: Ptr },
    Nth { n: Fix, k: Ptr },
    Push { v: Val, k: Ptr },
    Drop { n: Fix, k: Ptr },
    Pick { n: Fix, k: Ptr },
    Roll { n: Fix, k: Ptr },
    Eq { v: Val, k: Ptr },
    If { t: Ptr, f: Ptr },
    Msg { n: Fix, k: Ptr },
    Myself { k: Ptr },
    Send { n: Fix, k: Ptr },
    New { n: Fix, k: Ptr },
    Beh { n: Fix, k: Ptr },
    End { x: End },
}
impl Op {
    pub fn from(quad: &Quad) -> Option<Typed> {
        assert!(quad.t() == INSTR_T);
        match quad.x() {
            OP_TYPEQ => Some(Typed::Instr { op: Op::Typeq { t: quad.y().ptr(), k: quad.z().ptr() } }),
            OP_PAIR => Some(Typed::Instr { op: Op::Pair { n: quad.y().fix(), k: quad.z().ptr() } }),
            OP_PART => Some(Typed::Instr { op: Op::Part { n: quad.y().fix(), k: quad.z().ptr() } }),
            OP_NTH => Some(Typed::Instr { op: Op::Nth { n: quad.y().fix(), k: quad.z().ptr() } }),
            OP_PUSH => Some(Typed::Instr { op: Op::Push { v: quad.y().val(), k: quad.z().ptr() } }),
            OP_DROP => Some(Typed::Instr { op: Op::Drop { n: quad.y().fix(), k: quad.z().ptr() } }),
            OP_PICK => Some(Typed::Instr { op: Op::Pick { n: quad.y().fix(), k: quad.z().ptr() } }),
            OP_ROLL => Some(Typed::Instr { op: Op::Roll { n: quad.y().fix(), k: quad.z().ptr() } }),
            OP_EQ => Some(Typed::Instr { op: Op::Eq { v: quad.y().val(), k: quad.z().ptr() } }),
            OP_IF => Some(Typed::Instr { op: Op::If { t: quad.y().ptr(), f: quad.z().ptr() } }),
            OP_MSG => Some(Typed::Instr { op: Op::Msg { n: quad.y().fix(), k: quad.z().ptr() } }),
            OP_SELF => Some(Typed::Instr { op: Op::Myself { k: quad.z().ptr() } }),
            OP_SEND => Some(Typed::Instr { op: Op::Send { n: quad.y().fix(), k: quad.z().ptr() } }),
            OP_NEW => Some(Typed::Instr { op: Op::New { n: quad.y().fix(), k: quad.z().ptr() } }),
            OP_BEH => Some(Typed::Instr { op: Op::Beh { n: quad.y().fix(), k: quad.z().ptr() } }),
            OP_END => End::from(quad),
            _ => None,
        }
    }
    pub fn quad(&self) -> Quad {
        match self {
            Op::Typeq { t, k } => Quad::new(INSTR_T, OP_TYPEQ, t.val(), k.val()),
            Op::Pair { n, k } => Quad::new(INSTR_T, OP_PAIR, n.val(), k.val()),
            Op::Part { n, k } => Quad::new(INSTR_T, OP_PART, n.val(), k.val()),
            Op::Nth { n, k } => Quad::new(INSTR_T, OP_NTH, n.val(), k.val()),
            Op::Push { v, k } => Quad::new(INSTR_T, OP_PUSH, v.val(), k.val()),
            Op::Drop { n, k } => Quad::new(INSTR_T, OP_DROP, n.val(), k.val()),
            Op::Pick { n, k } => Quad::new(INSTR_T, OP_PICK, n.val(), k.val()),
            Op::Roll { n, k } => Quad::new(INSTR_T, OP_ROLL, n.val(), k.val()),
            Op::Eq { v, k } => Quad::new(INSTR_T, OP_EQ, v.val(), k.val()),
            Op::If { t, f } => Quad::new(INSTR_T, OP_IF, t.val(), f.val()),
            Op::Msg { n, k } => Quad::new(INSTR_T, OP_MSG, n.val(), k.val()),
            Op::Myself { k } => Quad::new(INSTR_T, OP_SELF, UNDEF, k.val()),
            Op::Send { n, k } => Quad::new(INSTR_T, OP_SEND, n.val(), k.val()),
            Op::New { n, k } => Quad::new(INSTR_T, OP_NEW, n.val(), k.val()),
            Op::Beh { n, k } => Quad::new(INSTR_T, OP_BEH, n.val(), k.val()),
            Op::End { x } => x.quad(),
        }
    }
}
impl fmt::Display for Op {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            //Op::Typeq { t, k } => write!(fmt, "Typeq{{ t:{}, k:{} }}", t, k),
            Op::Typeq { t, k } => {
                match t.val() {
                    LITERAL_T => write!(fmt, "Typeq{{ t:LITERAL_T, k:{} }}", k),
                    _ => write!(fmt, "Typeq{{ t:{}, k:{} }}", t, k),
                }
            },
            Op::Pair { n, k } => write!(fmt, "Pair{{ n:{}, k:{} }}", n, k),
            Op::Part { n, k } => write!(fmt, "Part{{ n:{}, k:{} }}", n, k),
            Op::Nth { n, k } => write!(fmt, "Nth{{ n:{}, k:{} }}", n, k),
            Op::Push { v, k } => write!(fmt, "Push{{ v:{}, k:{} }}", v, k),
            Op::Drop { n, k } => write!(fmt, "Drop{{ n:{}, k:{} }}", n, k),
            Op::Pick { n, k } => write!(fmt, "Pick{{ n:{}, k:{} }}", n, k),
            Op::Roll { n, k } => write!(fmt, "Roll{{ n:{}, k:{} }}", n, k),
            Op::Eq { v, k } => write!(fmt, "Eq{{ v:{}, k:{} }}", v, k),
            Op::If { t, f } => write!(fmt, "If{{ t:{}, f:{} }}", t, f),
            Op::Msg { n, k } => write!(fmt, "Msg{{ n:{}, k:{} }}", n, k),
            Op::Myself { k } => write!(fmt, "Self{{ k:{} }}", k),
            Op::Send { n, k } => write!(fmt, "Send{{ n:{}, k:{} }}", n, k),
            Op::New { n, k } => write!(fmt, "New{{ n:{}, k:{} }}", n, k),
            Op::Beh { n, k } => write!(fmt, "Beh{{ n:{}, k:{} }}", n, k),
            Op::End { x } => write!(fmt, "End{{ x:{} }}", x),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum End {
    Abort,
    Stop,
    Commit,
    Release,
}
impl End {
    pub fn from(quad: &Quad) -> Option<Typed> {
        assert!(quad.t() == INSTR_T);
        assert!(quad.x() == OP_END);
        match quad.y() {
            END_ABORT => Some(Typed::Instr { op: Op::End { x: End::Abort } }),
            END_STOP => Some(Typed::Instr { op: Op::End { x: End::Stop } }),
            END_COMMIT => Some(Typed::Instr { op: Op::End { x: End::Commit } }),
            END_RELEASE => Some(Typed::Instr { op: Op::End { x: End::Release } }),
            _ => None,
        }
    }
    pub fn quad(&self) -> Quad {
        match self {
            End::Abort => Quad::new(INSTR_T, OP_END, END_ABORT, UNDEF),
            End::Stop => Quad::new(INSTR_T, OP_END, END_STOP, UNDEF),
            End::Commit => Quad::new(INSTR_T, OP_END, END_COMMIT, UNDEF),
            End::Release => Quad::new(INSTR_T, OP_END, END_RELEASE, UNDEF),
        }
    }
}
impl fmt::Display for End {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            End::Abort => write!(fmt, "Abort"),
            End::Stop => write!(fmt, "Stop"),
            End::Commit => write!(fmt, "Commit"),
            End::Release => write!(fmt, "Release"),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
// quad-cell (minimum addressable unit)
pub struct Quad { t: Val, x: Val, y: Val, z: Val }
impl Quad {
    fn new(t: Val, x: Val, y: Val, z: Val) -> Quad {
        Quad { t, x, y, z }
    }
    pub fn t(&self) -> Val { self.t }
    pub fn x(&self) -> Val { self.x }
    pub fn y(&self) -> Val { self.y }
    pub fn z(&self) -> Val { self.z }
    pub fn set_t(&mut self, v: Val) { self.t = v; }
    pub fn set_x(&mut self, v: Val) { self.x = v; }
    pub fn set_y(&mut self, v: Val) { self.y = v; }
    pub fn set_z(&mut self, v: Val) { self.z = v; }
}
impl fmt::Display for Quad {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(fmt, "{{t:{}, x:{}, y:{}, z:{}}}", self.t, self.x, self.y, self.z)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Val { raw: Raw }
impl Val {
    pub fn new(raw: Raw) -> Val {
        Val { raw }
    }
    pub fn raw(&self) -> Raw {
        self.raw
    }
    pub fn addr(&self) -> usize {
        self.ptr().addr()
    }
    pub fn val(self) -> Val {  // NOTE: consumes `self`
        self
    }
    pub fn fix(self) -> Fix {  // NOTE: consumes `self`
        Fix::from(self).unwrap()
    }
    pub fn ptr(self) -> Ptr {  // NOTE: consumes `self`
        Ptr::from(self).unwrap()
    }
    pub fn cap(self) -> Cap {  // NOTE: consumes `self`
        Cap::from(self).unwrap()
    }
}
impl fmt::Display for Val {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = if (self.raw & DIR_RAW) != 0 {
            self.fix().to_string()
        } else if (self.raw & OPQ_RAW) != 0 {
            self.cap().to_string()
        } else {
            self.ptr().to_string()
        };
        write!(fmt, "{}", s)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fix { num: Num }
impl Fix {
    pub fn new(num: Num) -> Fix {
        Fix { num: ((num << 1) >> 1) }
    }
    pub fn from(val: Val) -> Option<Fix> {
        let raw = val.raw();
        if (raw & DIR_RAW) != 0 {
            let num = ((raw << 1) as Num) >> 1;
            Some(Fix::new(num))
        } else {
            None
        }
    }
    pub fn fix(self) -> Fix {  // NOTE: consumes `self`
        self
    }
    pub fn val(self) -> Val {  // NOTE: consumes `self`
        Val::new(self.num as Raw | DIR_RAW)
    }
    pub fn num(&self) -> Num {
        self.num
    }
}
impl fmt::Display for Fix {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(fmt, "{:+}", self.num)
    }
}

pub fn fixnum(num: Num) -> Val { Fix::new(num).val() }  // convenience constructor

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Ptr { raw: Raw }
impl Ptr {
    pub fn new(raw: Raw) -> Ptr {
        Ptr { raw: (raw & !MSK_RAW) }
    }
    pub fn from(val: Val) -> Option<Ptr> {
        let raw = val.raw();
        if (raw & MSK_RAW) == 0 {
            Some(Ptr::new(raw))
        } else {
            None
        }
    }
    pub fn ptr(self) -> Ptr {  // NOTE: consumes `self`
        self
    }
    pub fn val(self) -> Val {  // NOTE: consumes `self`
        Val::new(self.raw)
    }
    pub fn raw(&self) -> Raw {
        self.raw
    }
    pub fn addr(&self) -> usize {
        self.raw as usize
    }
}
impl fmt::Display for Ptr {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.val() {
            UNDEF => write!(fmt, "#?"),
            NIL => write!(fmt, "()"),
            FALSE => write!(fmt, "#f"),
            TRUE => write!(fmt, "#t"),
            UNIT => write!(fmt, "#unit"),
            TYPE_T => write!(fmt, "TYPE_T"),
            EVENT_T => write!(fmt, "EVENT_T"),
            INSTR_T => write!(fmt, "INSTR_T"),
            ACTOR_T => write!(fmt, "ACTOR_T"),
            FIXNUM_T => write!(fmt, "FIXNUM_T"),
            SYMBOL_T => write!(fmt, "SYMBOL_T"),
            PAIR_T => write!(fmt, "PAIR_T"),
            FEXPR_T => write!(fmt, "FEXPR_T"),
            FREE_T => write!(fmt, "FREE_T"),
            _ => write!(fmt, "^{}", self.raw),
        }
    }
}

pub fn ptrval(raw: Raw) -> Val { Ptr::new(raw).val() }  // convenience constructor

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Cap { raw: Raw }
impl Cap {
    pub fn new(raw: Raw) -> Cap {
        Cap { raw: (raw & !MSK_RAW) }
    }
    pub fn from(val: Val) -> Option<Cap> {
        let raw = val.raw();
        if (raw & MSK_RAW) == OPQ_RAW {
            Some(Cap::new(raw))
        } else {
            None
        }
    }
    pub fn cap(self) -> Cap {  // NOTE: consumes `self`
        self
    }
    pub fn val(self) -> Val {  // NOTE: consumes `self`
        Val::new(self.raw | OPQ_RAW)
    }
    pub fn raw(&self) -> Raw {
        self.raw
    }
    pub fn addr(&self) -> usize {
        self.raw as usize
    }
}
impl fmt::Display for Cap {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(fmt, "@{}", self.raw)
    }
}

pub fn capval(raw: Raw) -> Val { Cap::new(raw).val() }  // convenience constructor

//#[cfg(test)] -- use this if/when the tests are in a sub-module
#[test]
fn base_types_are_32_bits() {
    assert_eq!(4, std::mem::size_of::<Raw>());
    assert_eq!(4, std::mem::size_of::<Num>());
    assert_eq!(4, std::mem::size_of::<Val>());
    assert_eq!(4, std::mem::size_of::<Fix>());
    assert_eq!(4, std::mem::size_of::<Ptr>());
    assert_eq!(4, std::mem::size_of::<Cap>());
    assert_eq!(16, std::mem::size_of::<Quad>());
    //assert_eq!(16, std::mem::size_of::<Typed>());
}

#[test]
fn fix_zero_value_roundtrips() {
    let n = Fix::new(0);
    let v = n.val();
    let o = Fix::from(v);
    assert!(o.is_some());
    let m = o.unwrap();
    assert_eq!(n, m);
    assert_eq!(0, m.num());
}

#[test]
fn fix_positive_value_roundtrips() {
    let n = Fix::new(42);
    let v = n.val();
    let o = Fix::from(v);
    assert!(o.is_some());
    let m = o.unwrap();
    assert_eq!(42, m.num());
    assert_eq!(n, m);
}

#[test]
fn fix_negative_value_roundtrips() {
    let n = Fix::new(-42);
    let v = n.val();
    let o = Fix::from(v);
    assert!(o.is_some());
    let m = o.unwrap();
    assert_eq!(-42, m.num());
    assert_eq!(n, m);
}

#[test]
#[should_panic]
fn fix_cast_to_ptr() {
    let n = Fix::new(0);
    let v = n.val();
    let _p = v.ptr();  // should panic!
}

#[test]
fn ptr_is_distinct_from_cap() {
    let p = Ptr::new(42);
    let c = Cap::new(42);
    assert_eq!(p.raw(), c.raw());
    assert_ne!(p.val().raw(), c.val().raw());
    assert_eq!(p.addr(), c.addr());
}

#[test]
#[should_panic]
fn cap_addr_conversion() {
    let c = Cap::new(42);
    let v = c.val();
    let _a = v.addr();  // should panic!
}

#[test]
fn core_initialization() {
    let core = Core::new();
    assert_eq!(0, core.mem_free().num());
    assert_eq!(NIL.ptr(), core.mem_next());
    assert_ne!(NIL.ptr(), core.e_first());
    assert_eq!(NIL.ptr(), core.k_first());
    for raw in 0..core.mem_top().raw() {
        let typed = core.typed(Ptr::new(raw));
        println!("{:5}: {} = {}", raw, typed.quad(), typed);
    }
    //assert!(false);  // force output to be displayed
}

#[test]
fn basic_memory_allocation() {
    let mut core = Core::new();
    let top_before = core.mem_top().raw();
    println!("mem_top: {}", core.mem_top());
    let m1 = core.alloc(&Typed::Pair { car: fixnum(1), cdr: fixnum(1) });
    println!("m1:{} -> {}", m1, core.typed(m1));
    println!("mem_top: {}", core.mem_top());
    let m2 = core.alloc(&Typed::Pair { car: fixnum(2), cdr: fixnum(2) });
    println!("mem_top: {}", core.mem_top());
    let m3 = core.alloc(&Typed::Pair { car: fixnum(3), cdr: fixnum(3) });
    println!("mem_top: {}", core.mem_top());
    println!("mem_free: {}", core.mem_free());
    core.free(m2);
    println!("mem_free: {}", core.mem_free());
    core.free(m3);
    println!("mem_free: {}", core.mem_free());
    let _m4 = core.alloc(&Typed::Pair { car: fixnum(4), cdr: fixnum(4) });
    println!("mem_top: {}", core.mem_top());
    println!("mem_free: {}", core.mem_free());
    let top_after = core.mem_top().raw();
    assert_eq!(3, top_after - top_before);
    assert_eq!(1, core.mem_free().num());
    println!("mem_next: {} -> {}", core.mem_next(), core.typed(core.mem_next()));
    //assert!(false);  // force output to be displayed
}

#[test]
fn run_loop_terminates() {
    let mut core = Core::new();
    core.run_loop();
    //assert!(false);  // force output to be displayed
}
