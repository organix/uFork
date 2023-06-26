// uFork virtual CPU core

use alloc::boxed::Box;

use crate::*;
use crate::device::*;

pub const ROM_BASE_OFS: usize = 16;  // ROM offsets below this value are reserved

pub const MEMORY: Any       = Any { raw: MUT_RAW | 0 };
pub const DDEQUE: Any       = Any { raw: MUT_RAW | 1 };
pub const DEBUG_DEV: Any    = Any { raw: OPQ_RAW | MUT_RAW | 2 };
pub const CLOCK_DEV: Any    = Any { raw: OPQ_RAW | MUT_RAW | 3 };
pub const IO_DEV: Any       = Any { raw: OPQ_RAW | MUT_RAW | 4 };
pub const BLOB_DEV: Any     = Any { raw: OPQ_RAW | MUT_RAW | 5 };
pub const TIMER_DEV: Any    = Any { raw: OPQ_RAW | MUT_RAW | 6 };
pub const MEMO_DEV: Any     = Any { raw: OPQ_RAW | MUT_RAW | 7 };
pub const AWP_DEV: Any      = Any { raw: OPQ_RAW | MUT_RAW | 8 };
pub const SPONSOR: Any      = Any { raw: MUT_RAW | 15 };

pub const RAM_BASE_OFS: usize = 16;  // RAM offsets below this value are reserved

pub const GC_FIRST: usize   = 0;  // offset of "first" in gc_queue[]
pub const GC_LAST: usize    = 1;  // offset of "last" in gc_queue[]
pub const GC_STRIDE: usize  = 16;  // number of steps to take for each GC increment

// core limits (repeated in `index.js`)
//const QUAD_ROM_MAX: usize = 1<<10;  // 1K quad-cells of ROM
const QUAD_ROM_MAX: usize = 1<<12;  // 4K quad-cells of ROM
//const QUAD_RAM_MAX: usize = 1<<8;   // 256 quad-cells of RAM
const QUAD_RAM_MAX: usize = 1<<10;   // 1K quad-cells of RAM
//const QUAD_RAM_MAX: usize = 1<<12;   // 4K quad-cells of RAM
//const BLOB_RAM_MAX: usize = 64;     // 64 octets of Blob RAM (for testing)
const BLOB_RAM_MAX: usize = 1<<8;   // 256 octets of Blob RAM (for testing)
//const BLOB_RAM_MAX: usize = 1<<10;  // 1K octets of Blob RAM
//const BLOB_RAM_MAX: usize = 1<<12;  // 4K octets of Blob RAM
//const BLOB_RAM_MAX: usize = 1<<16;  // 64K octets of Blob RAM (maximum value)
const DEVICE_MAX:   usize = 7;      // number of Core devices

pub struct Core {
    quad_rom:   [Quad; QUAD_ROM_MAX],
    quad_ram:   [Quad; QUAD_RAM_MAX],
    gc_queue:   [Any; QUAD_RAM_MAX],
    blob_ram:   [u8; BLOB_RAM_MAX],
    device:     [Option<Box<dyn Device>>; DEVICE_MAX],
    rom_top:    Any,
    gc_state:   Any,
}

impl Core {
    pub fn new() -> Core {

        /*
         * Read-Only Memory (ROM) image (read/execute)
         */
        let mut quad_rom = [
            Quad::empty_t();
            QUAD_ROM_MAX
        ];

        quad_rom[UNDEF.ofs()]       = Quad::literal_t();
        quad_rom[NIL.ofs()]         = Quad::literal_t();
        quad_rom[FALSE.ofs()]       = Quad::literal_t();
        quad_rom[TRUE.ofs()]        = Quad::literal_t();
        quad_rom[UNIT.ofs()]        = Quad::literal_t();

        quad_rom[EMPTY_DQ.ofs()]    = Quad::pair_t(NIL, NIL);

        quad_rom[TYPE_T.ofs()]      = Quad::type_t();
        quad_rom[FIXNUM_T.ofs()]    = Quad::type_t();
        quad_rom[ACTOR_T.ofs()]     = Quad::type_t();
        quad_rom[PROXY_T.ofs()]     = Quad::type_t();
        quad_rom[STUB_T.ofs()]      = Quad::type_t();
        quad_rom[INSTR_T.ofs()]     = Quad::type_t();
        quad_rom[PAIR_T.ofs()]      = Quad::type_t();
        quad_rom[DICT_T.ofs()]      = Quad::type_t();
        quad_rom[FWD_REF_T.ofs()]   = Quad::type_t();
        quad_rom[FREE_T.ofs()]      = Quad::type_t();

pub const ROM_TOP_OFS: usize = ROM_BASE_OFS;

        /*
         * Random-Access Memory (RAM) image (read/write + GC)
         */
        let mut quad_ram = [
            Quad::empty_t();
            QUAD_RAM_MAX
        ];
        quad_ram[MEMORY.ofs()]      = Quad::memory_t(Any::ram(RAM_TOP_OFS), NIL, ZERO, NIL);
        quad_ram[DDEQUE.ofs()]      = Quad::ddeque_t(NIL, NIL, NIL, NIL);  // no events, no continuations
        quad_ram[DEBUG_DEV.ofs()]   = Quad::actor_t(ZERO, NIL, UNDEF);    // debug device #0
        quad_ram[CLOCK_DEV.ofs()]   = Quad::actor_t(PLUS_1, NIL, UNDEF);  // clock device #1
        quad_ram[IO_DEV.ofs()]      = Quad::actor_t(PLUS_2, NIL, UNDEF);  // i/o device #2
        quad_ram[BLOB_DEV.ofs()]    = Quad::actor_t(PLUS_3, NIL, UNDEF);  // blob device #3
        quad_ram[TIMER_DEV.ofs()]   = Quad::actor_t(PLUS_4, NIL, UNDEF);  // timer device #4
        quad_ram[MEMO_DEV.ofs()]    = Quad::actor_t(PLUS_5, NIL, UNDEF);  // memo device #5
        quad_ram[AWP_DEV.ofs()]     = Quad::actor_t(PLUS_6, NIL, UNDEF);  // AWP device #6
        quad_ram[SPONSOR.ofs()]     = Quad::sponsor_t(Any::fix(512), Any::fix(64), Any::fix(768));  // root configuration sponsor

pub const RAM_TOP_OFS: usize = RAM_BASE_OFS;

        let mut gc_queue = [ UNDEF; QUAD_RAM_MAX ];
        let mut ofs = 0;
        while ofs < RAM_BASE_OFS {
            gc_queue[ofs] = UNIT;  // mark "black" (reachable)
            ofs += 1;
        }
        gc_queue[GC_FIRST] = NIL;
        gc_queue[GC_LAST] = NIL;

        /*
         * OED-encoded Blob Memory (64kB maximum)
         */
        let mut blob_ram = [
            0x8F as u8;  // fill with OED-encoded `null` octets
            BLOB_RAM_MAX
        ];
        let mut nat = BLOB_RAM_MAX;
        nat -= 9;
        blob_ram[0] = 0x88;             // Array
        blob_ram[1] = 0x82;             //   length: +Integer elements
        blob_ram[2] = 16;               //     length.size = 16 bits
        blob_ram[3] = 1;                //     length[0] = 1 (lsb)
        blob_ram[4] = 0;                //     length[1] = 0 (msb)
        blob_ram[5] = 0x82;             //   size: +Integer octets
        blob_ram[6] = 16;               //     size.size = 16 bits
        blob_ram[7] = u16_lsb(nat);     //     size[0] (lsb)
        blob_ram[8] = u16_msb(nat);     //     size[1] (msb)
        nat -= 9;
        blob_ram[9] = 0x8B;             //   [0] = Extension Blob
        blob_ram[10] = 0x82;            //       meta: +Integer offset
        blob_ram[11] = 16;              //         meta.size = 16 bits
        blob_ram[12] = 0;               //         meta[0] = 0 (lsb)
        blob_ram[13] = 0;               //         meta[1] = 0 (msb)
        blob_ram[14] = 0x82;            //       size: +Integer octets
        blob_ram[15] = 16;              //         size.size = 16 bits
        blob_ram[16] = u16_lsb(nat);    //         size[0] (lsb)
        blob_ram[17] = u16_msb(nat);    //         size[1] (msb)

        Core {
            quad_rom,
            quad_ram,
            gc_queue,
            blob_ram,
            device: [
                Some(Box::new(DebugDevice::new())),
                Some(Box::new(ClockDevice::new())),
                Some(Box::new(IoDevice::new())),
                Some(Box::new(BlobDevice::new())),
                Some(Box::new(TimerDevice::new())),
                Some(Box::new(NullDevice::new())),
                Some(Box::new(AwpDevice::new())),
            ],
            rom_top: Any::rom(ROM_TOP_OFS),
            gc_state: UNDEF,
        }
    }

    pub fn run_loop(&mut self, limit: i32) -> Error {
        let mut steps = 0;
        loop {
            match self.execute_instruction() {
                Ok(more) => {
                    if !more && !self.event_pending() {
                        return steps;  // no more instructions to execute...
                    }
                },
                Err(error) => {
                    return error;  // limit reached, or error condition signalled...
                },
            }
            steps += 1;
            if (limit > 0) && (steps >= limit) {
                return steps;  // step limit reached
            }
            if let Err(error) = self.check_for_interrupt() {
                return error;  // interrupt handler failed...
            }
            if let Err(error) = self.dispatch_event() {
                return error;  // event dispatch failed...
            }
        }
    }
    pub fn check_for_interrupt(&mut self) -> Result<bool, Error> {
        //self.gc_stop_the_world();  // FIXME!! REMOVE FORCED GC...
        Ok(false)
        //Err(E_FAIL)
    }
    pub fn dispatch_event(&mut self) -> Result<bool, Error> {
        if !self.event_pending() {
            return Ok(false);  // event queue empty
        }
        let ep = self.e_first();
        let event = self.mem(ep);
        let target = event.x();
        let sponsor = self.event_sponsor(ep);
        let limit = self.sponsor_events(sponsor).fix_num().unwrap_or(0);
        if limit <= 0 {
            return Err(E_MSG_LIM);  // Sponsor event limit reached
        }
        if let Ok(id) = self.device_id(target) {
            // message-event to device
            let ep_ = self.event_dequeue().unwrap();
            assert_eq!(ep, ep_);
            let mut dev_mut = self.device[id].take().unwrap();
            let result = dev_mut.handle_event(self, ep);
            trace_event(ep, UNDEF);  // trace transactional effect(s)
            self.device[id] = Some(dev_mut);
            result  // should normally be Ok(true)
        } else {
            let a_ptr = self.cap_to_ptr(target);
            let a_quad = self.mem(a_ptr);
            let beh = a_quad.x();
            let state = a_quad.y();
            let txn = a_quad.z();
            if txn == UNDEF {
                // begin actor-event transaction
                let effect = self.reserve(&Quad::actor_t(beh, state, NIL))?;  // event-effect accumulator
                let kp = self.new_cont(beh, NIL, ep)?;  // create continuation
                self.ram_mut(a_ptr).set_z(effect);  // indicate actor is busy
                self.cont_enqueue(kp);
                let ep_ = self.event_dequeue().unwrap();
                assert_eq!(ep, ep_);
                self.ram_mut(ep).set_z(NIL);  // disconnect event from queue
                self.set_sponsor_events(sponsor, Any::fix(limit - 1));  // decrement event limit
                Ok(true)  // event dispatched
            } else {
                // target actor is busy, retry later...
                let ep_ = self.event_dequeue().unwrap();
                assert_eq!(ep, ep_);
                self.event_enqueue(ep);  // move event to back of queue
                Ok(false)  // no event dispatched
            }
        }
    }
    pub fn execute_instruction(&mut self) -> Result<bool, Error> {
        let kp = self.kp();
        if !kp.is_ram() {
            return Ok(false);  // continuation queue is empty
        }
        let ep = self.ep();
        let sponsor = self.event_sponsor(ep);
        let limit = self.sponsor_instrs(sponsor).fix_num().unwrap_or(0);
        if limit <= 0 {
            return Err(E_CPU_LIM);  // Sponsor instruction limit reached
        }
        let ip = self.ip();
        let ip_ = self.perform_op(ip)?;
        self.set_sponsor_instrs(sponsor, Any::fix(limit - 1));
        if self.typeq(INSTR_T, ip_) {
            // re-queue updated continuation
            self.set_ip(ip_);
            let kp_ = self.cont_dequeue().unwrap();
            assert_eq!(kp, kp_);
            self.cont_enqueue(kp_);
        } else {
            // free dead continuation and associated event
            let kp_ = self.cont_dequeue().unwrap();
            assert_eq!(kp, kp_);
            self.free(ep);
            self.free(kp);
            self.gc_collect();  // FIXME! REMOVE FORCED GC...
        }
        //self.gc_increment();  // WARNING! incremental and stop-the-world GC are incompatible!
        Ok(true)  // instruction executed
    }
    fn perform_op(&mut self, ip: Any) -> Result<Any, Error> {
        let instr = self.mem(ip);
        assert!(instr.t() == INSTR_T);
        let opr = instr.x();  // operation code
        let imm = instr.y();  // immediate argument
        let kip = instr.z();  // next instruction
        let ip_ = match opr {
            VM_TYPEQ => {
                let val = self.stack_pop();
                let r = if self.typeq(imm, val) { TRUE } else { FALSE };
                self.stack_push(r)?;
                kip
            },
            VM_DICT => {
                match imm {
                    DICT_HAS => {
                        let key = self.stack_pop();
                        let dict = self.stack_pop();
                        let b = self.dict_has(dict, key);
                        let v = if b { TRUE } else { FALSE };
                        self.stack_push(v)?;
                    },
                    DICT_GET => {
                        let key = self.stack_pop();
                        let dict = self.stack_pop();
                        let v = self.dict_get(dict, key);
                        self.stack_push(v)?;
                    },
                    DICT_ADD => {
                        let value = self.stack_pop();
                        let key = self.stack_pop();
                        let dict = self.stack_pop();
                        let d = self.dict_add(dict, key, value)?;
                        self.stack_push(d)?;
                    },
                    DICT_SET => {
                        let value = self.stack_pop();
                        let key = self.stack_pop();
                        let dict = self.stack_pop();
                        let d = self.dict_set(dict, key, value)?;
                        self.stack_push(d)?;
                    },
                    DICT_DEL => {
                        let key = self.stack_pop();
                        let dict = self.stack_pop();
                        let d = self.dict_del(dict, key)?;
                        self.stack_push(d)?;
                    },
                    _ => {
                        return Err(E_BOUNDS);  // unknown DICT op
                    }
                };
                kip
            },
            VM_DEQUE => {
                match imm {
                    DEQUE_NEW => {
                        let deque = self.deque_new();
                        self.stack_push(deque)?;
                    },
                    DEQUE_EMPTY => {
                        let deque = self.stack_pop();
                        let b = self.deque_empty(deque);
                        let v = if b { TRUE } else { FALSE };
                        self.stack_push(v)?;
                    },
                    DEQUE_PUSH => {
                        let item = self.stack_pop();
                        let old = self.stack_pop();
                        let new = self.deque_push(old, item)?;
                        self.stack_push(new)?;
                    },
                    DEQUE_POP => {
                        let old = self.stack_pop();
                        let (new, item) = self.deque_pop(old)?;
                        self.stack_push(new)?;
                        self.stack_push(item)?;
                    },
                    DEQUE_PUT => {
                        let item = self.stack_pop();
                        let old = self.stack_pop();
                        let new = self.deque_put(old, item)?;
                        self.stack_push(new)?;
                    },
                    DEQUE_PULL => {
                        let old = self.stack_pop();
                        let (new, item) = self.deque_pull(old)?;
                        self.stack_push(new)?;
                        self.stack_push(item)?;
                    },
                    DEQUE_LEN => {
                        let deque = self.stack_pop();
                        let n = self.deque_len(deque);
                        self.stack_push(Any::fix(n))?;
                    },
                    _ => {
                        return Err(E_BOUNDS);  // unknown DEQUE op
                    }
                };
                kip
            },
            VM_PAIR => {
                let n = imm.get_fix()?;
                self.stack_pairs(n)?;
                kip
            },
            VM_PART => {
                let n = imm.get_fix()?;
                self.stack_parts(n)?;
                kip
            },
            VM_NTH => {
                let lst = self.stack_pop();
                let n = imm.get_fix()?;
                let r = self.extract_nth(lst, n);
                self.stack_push(r)?;
                kip
            },
            VM_PUSH => {
                let val = self.follow_fwd(imm)?;  // eagerly dereference any "promise"
                self.stack_push(val)?;
                kip
            },
            VM_DEPTH => {
                let lst = self.sp();
                let n = self.list_len(lst);
                let n = Any::fix(n);
                self.stack_push(n)?;
                kip
            },
            VM_DROP => {
                let mut n = imm.get_fix()?;
                assert!(n < 64);  // FIXME: replace with cycle-limit(s) in Sponsor
                while n > 0 {
                    self.stack_pop();
                    n -= 1;
                };
                kip
            },
            VM_PICK => {
                let n = imm.get_fix()?;
                let r = if n > 0 {
                    let lst = self.sp();
                    self.extract_nth(lst, n)
                } else {
                    UNDEF
                };
                self.stack_push(r)?;
                kip
            },
            VM_DUP => {
                let n = imm.get_fix()?;
                self.stack_dup(n)?;
                kip
            },
            VM_ROLL => {
                let n = imm.get_fix()?;
                self.stack_roll(n)?;
                kip
            },
            VM_ALU => {
                let r = if imm == ALU_NOT {
                    let v = self.stack_pop();
                    match v.fix_num() {
                        Some(n) => Any::fix(!n),
                        _ => UNDEF,
                    }
                } else {
                    let vv = self.stack_pop();
                    let v = self.stack_pop();
                    match (v.fix_num(), vv.fix_num()) {
                        (Some(n), Some(nn)) => {
                            match imm {
                                ALU_AND => Any::fix(n & nn),
                                ALU_OR  => Any::fix(n | nn),
                                ALU_XOR => Any::fix(n ^ nn),
                                ALU_ADD => Any::fix(n + nn),
                                ALU_SUB => Any::fix(n - nn),
                                ALU_MUL => Any::fix(n * nn),
                                _ => UNDEF,
                            }
                        }
                        _ => UNDEF
                    }
                };
                self.stack_push(r)?;
                kip
            },
            VM_EQ => {
                let vv = self.stack_pop();
                let r = if imm == vv { TRUE } else { FALSE };
                self.stack_push(r)?;
                kip
            },
            VM_CMP => {
                let vv = self.stack_pop();
                let v = self.stack_pop();
                let b = if imm == CMP_EQ {
                    v == vv
                } else if imm == CMP_NE {
                    v != vv
                } else {
                    match (v.fix_num(), vv.fix_num()) {
                        (Some(n), Some(nn)) => {
                            match imm {
                                CMP_GE => n >= nn,
                                CMP_GT => n > nn,
                                CMP_LT => n < nn,
                                CMP_LE => n <= nn,
                                _ => false,
                            }
                        }
                        _ => false
                    }
                };
                let r = if b { TRUE } else { FALSE };
                self.stack_push(r)?;
                kip
            },
            VM_IF => {
                let b = self.stack_pop();
                if falsey(b) { kip } else { imm }
            },
            VM_MSG => {
                let n = imm.get_fix()?;
                let ep = self.ep();
                let event = self.mem(ep);
                let msg = event.y();
                let r = self.extract_nth(msg, n);
                self.stack_push(r)?;
                kip
            },
            VM_STATE => {
                let n = imm.get_fix()?;
                let me = self.self_ptr();
                let state = self.ram(me).y();
                let r = self.extract_nth(state, n);
                self.stack_push(r)?;
                kip
            },
            VM_MY => {
                let me = self.self_ptr();
                match imm {
                    MY_SELF => {
                        let ep = self.ep();
                        let target = self.ram(ep).x();
                        self.stack_push(target)?;
                    },
                    MY_BEH => {
                        let beh = self.ram(me).x();
                        self.stack_push(beh)?;
                    },
                    MY_STATE => {
                        let state = self.ram(me).y();
                        self.push_list(state)?;
                    },
                    _ => {
                        return Err(E_BOUNDS);  // unknown MY op
                    }
                }
                kip
            }
            VM_SEND => {
                let n = imm.get_fix()?;
                let target = self.stack_pop();
                if !self.typeq(ACTOR_T, target) {
                    return Err(E_NOT_CAP);
                }
                let msg = self.pop_counted(n);
                let ep = self.new_event(target, msg)?;
                let me = self.self_ptr();
                let effect = self.ram(me).z();
                let next = self.ram(effect).z();
                self.ram_mut(ep).set_z(next);
                self.ram_mut(effect).set_z(ep);
                kip
            },
            VM_NEW => {
                let n = imm.get_fix()?;
                let beh = self.stack_pop();
                assert!(self.typeq(INSTR_T, beh));  // FIXME: return Err(E_NOT_CODE)
                let state = self.pop_counted(n);
                let a = self.new_actor(beh, state)?;
                self.stack_push(a)?;
                kip
            },
            VM_BEH => {
                let n = imm.get_fix()?;
                let beh = self.stack_pop();
                assert!(self.typeq(INSTR_T, beh));  // FIXME: return Err(E_NOT_CODE)
                let state = self.pop_counted(n);
                let me = self.self_ptr();
                let effect = self.ram(me).z();
                let quad = self.ram_mut(effect);
                quad.set_x(beh);  // replace behavior function
                quad.set_y(state);  // replace state data
                kip
            },
            VM_END => {
                trace_event(self.ep(), self.kp());  // trace transactional effect(s)
                let me = self.self_ptr();
                let rv = match imm {
                    END_ABORT => {
                        let _r = self.stack_pop();  // reason for abort
                        // FIXME: where should `reason` be recorded/reported?
                        self.actor_abort(me);
                        UNIT
                    },
                    END_STOP => {
                        //UNDEF
                        return Err(E_STOP);  // End::Stop terminated continuation
                    },
                    END_COMMIT => {
                        self.actor_commit(me);
                        TRUE
                    },
                    END_RELEASE => {
                        self.actor_commit(me);
                        // FIXME: End::Release is DEPRECATED due to potential use-after-free hazards!
                        //self.free(me);  // free actor
                        FALSE
                    },
                    _ => {
                        return Err(E_BOUNDS);  // unknown END op
                    }
                };
                rv
            },
            VM_IS_EQ => {
                let vv = self.stack_pop();
                if imm != vv {
                    return Err(E_ASSERT);  // assertion failed
                }
                kip
            },
            VM_IS_NE => {
                let vv = self.stack_pop();
                if imm == vv {
                    return Err(E_ASSERT);  // assertion failed
                }
                kip
            },
            _ => {
                return Err(E_BOUNDS);  // illegal instruction
            }
        };
        Ok(ip_)
    }

    pub fn event_pending(&self) -> bool {
        self.e_first().is_ram()
    }
    fn event_enqueue(&mut self, ep: Any) {
        // add event to the back of the queue
        self.ram_mut(ep).set_z(NIL);
        if !self.e_first().is_ram() {
            self.set_e_first(ep);
        } else /* if self.e_last().is_ram() */ {
            self.ram_mut(self.e_last()).set_z(ep);
        }
        self.set_e_last(ep);
    }
    fn event_dequeue(&mut self) -> Option<Any> {
        // remove event from the front of the queue
        let ep = self.e_first();
        if ep.is_ram() {
            let event = self.ram(ep);
            let next = event.z();
            self.set_e_first(next);
            if !next.is_ram() {
                self.set_e_last(NIL)
            }
            Some(ep)
        } else {
            None
        }
    }
    pub fn event_inject(&mut self, sponsor: Any, target: Any, msg: Any) -> Result<(), Error> {
        // add event to the front of the queue (e.g.: for interrupts)
        let event = Quad::new_event(sponsor, target, msg);
        let ep = self.reserve(&event)?;  // no Sponsor needed
        let first = self.e_first();
        self.ram_mut(ep).set_z(first);
        if !first.is_ram() {
            self.set_e_last(ep);
        }
        self.set_e_first(ep);
        Ok(())
    }

    fn cont_enqueue(&mut self, kp: Any) {
        // add continuation to the back of the queue
        self.ram_mut(kp).set_z(NIL);
        if !self.k_first().is_ram() {
            self.set_k_first(kp);
        } else /* if self.k_last().is_ram() */ {
            self.ram_mut(self.k_last()).set_z(kp);
        }
        self.set_k_last(kp);
    }
    fn cont_dequeue(&mut self) -> Option<Any> {
        // remove continuation from the front of the queue
        let kp = self.k_first();
        if kp.is_ram() {
            let cont = self.ram(kp);
            let next = cont.z();
            self.set_k_first(next);
            if !next.is_ram() {
                self.set_k_last(NIL)
            }
            Some(kp)
        } else {
            None
        }
    }

    fn actor_commit(&mut self, me: Any) {
        self.stack_clear(NIL);
        let effect = self.ram(me).z();
        let quad = self.ram(effect);
        let beh = quad.x();
        let state = quad.y();
        let mut ep = quad.z();
        // move sent-message events to event queue
        while ep.is_ram() {
            let event = self.ram(ep);
            let next = event.z();
            self.event_enqueue(ep);
            ep = next;
        }
        self.free(effect);
        // commit actor transaction
        let actor = self.ram_mut(me);
        actor.set_x(beh);
        actor.set_y(state);
        actor.set_z(UNDEF);
    }
    fn actor_abort(&mut self, me: Any) {
        self.stack_clear(NIL);
        let effect = self.ram(me).z();
        let mut ep = self.ram(effect).z();
        // free sent-message events
        while ep.is_ram() {
            let event = self.ram(ep);
            let next = event.z();
            self.free(ep);
            ep = next;
        }
        self.free(effect);
        // abort actor transaction
        self.ram_mut(me).set_z(UNDEF);
    }
    pub fn actor_revert(&mut self) -> bool {
        // revert actor/event to pre-dispatch state
        if let Some(kp) = self.cont_dequeue() {
            let ep = self.ram(kp).y();
            let target = self.ram(ep).x();
            let me = self.cap_to_ptr(target);
            self.actor_abort(me);
            self.event_enqueue(ep);
            true
        } else {
            false
        }
    }
    fn self_ptr(&self) -> Any {
        let ep = self.ep();
        if !ep.is_ram() { return UNDEF }  // no event means no `self`
        let target = self.ram(ep).x();
        let a_ptr = self.cap_to_ptr(target);
        a_ptr
    }

    pub fn sponsor_memory(&self, sponsor: Any) -> Any {
        self.mem(sponsor).t()
    }
    pub fn set_sponsor_memory(&mut self, sponsor: Any, num: Any) {
        self.ram_mut(sponsor).set_t(num);
    }
    pub fn sponsor_events(&self, sponsor: Any) -> Any {
        self.mem(sponsor).x()
    }
    pub fn set_sponsor_events(&mut self, sponsor: Any, num: Any) {
        self.ram_mut(sponsor).set_x(num);
    }
    pub fn sponsor_instrs(&self, sponsor: Any) -> Any {
        self.mem(sponsor).y()
    }
    pub fn set_sponsor_instrs(&mut self, sponsor: Any, num: Any) {
        self.ram_mut(sponsor).set_y(num);
    }
    pub fn event_sponsor(&self, ep: Any) -> Any {
        self.mem(ep).t()
    }

    fn list_len(&self, list: Any) -> isize {
        let mut n: isize = 0;
        let mut p = list;
        while self.typeq(PAIR_T, p) {
            n += 1;
            p = self.cdr(p);
        };
        n
    }
    fn push_list(&mut self, ptr: Any) -> Result<(), Error> {
        if self.typeq(PAIR_T, ptr) {
            self.push_list(self.cdr(ptr))?;
            self.stack_push(self.car(ptr))?;
        }
        Ok(())
    }
    fn pop_counted(&mut self, n: isize) -> Any {
        if n > 0 {  // build list from stack
            let mut n = n;
            let sp = self.sp();
            let mut v = sp;
            let mut p = UNDEF;
            while n > 0 && self.typeq(PAIR_T, v) {
                p = v;
                v = self.cdr(p);
                n -= 1;
            }
            if self.typeq(PAIR_T, p) {
                self.set_cdr(p, NIL);
            }
            self.set_sp(v);
            sp
        } else if n == -1 {  // pre-composed
            self.stack_pop()
        } else {  // empty list
            NIL
        }
    }
    fn split_nth(&self, lst: Any, n: isize) -> (Any, Any) {
        // Safely determine the `nth` item of a list and its `pred`ecessor.
        let mut nth = lst;
        let mut pred = UNDEF;
        let mut n = n;
        assert!(n < 64);
        while n > 1 && self.typeq(PAIR_T, nth) {
            pred = nth;
            nth = self.cdr(nth);
            n -= 1;
        }
        (pred, nth)
    }
    fn extract_nth(&self, lst: Any, n: isize) -> Any {
        // Safely extract the `nth` item from a list of Pairs.
        /*
             0          -1          -2          -3
        lst -->[car,cdr]-->[car,cdr]-->[car,cdr]-->...
              +1 |        +2 |        +3 |
                 V           V           V
        */
        let mut p = lst;
        let mut v = UNDEF;
        let mut n = n;
        if n == 0 {  // entire list/message
            v = p;
        } else if n > 0 {  // item at n-th index
            assert!(n < 64);
            while self.typeq(PAIR_T, p) {
                n -= 1;
                if n <= 0 { break; }
                p = self.cdr(p);
            }
            if n == 0 {
                v = self.car(p);
            }
        } else {  // `-n` selects the n-th tail
            assert!(n > -64);
            while self.typeq(PAIR_T, p) {
                n += 1;
                if n >= 0 { break; }
                p = self.cdr(p);
            }
            if n == 0 {
                v = self.cdr(p);
            }
        }
        v
    }

    pub fn dict_has(&self, dict: Any, key: Any) -> bool {
        let mut d = dict;
        while self.typeq(DICT_T, d) {
            let entry = self.mem(d);
            let k = entry.x();  // key
            if key == k {
                return true
            }
            d = entry.z();  // next
        }
        false
    }
    pub fn dict_get(&self, dict: Any, key: Any) -> Any {
        let mut d = dict;
        while self.typeq(DICT_T, d) {
            let entry = self.mem(d);
            let k = entry.x();  // key
            if key == k {
                return entry.y()  // value
            }
            d = entry.z();  // next
        }
        UNDEF
    }
    pub fn dict_add(&mut self, dict: Any, key: Any, value: Any) -> Result<Any, Error> {
        let dict = Quad::dict_t(key, value, dict);
        self.alloc(&dict)
    }
    pub fn dict_set(&mut self, dict: Any, key: Any, value: Any) -> Result<Any, Error> {
        let d = if self.dict_has(dict, key) {
            self.dict_del(dict, key)?
        } else {
            dict
        };
        self.dict_add(d, key, value)
    }
    pub fn dict_del(&mut self, dict: Any, key: Any) -> Result<Any, Error> {
        if self.typeq(DICT_T, dict) {
            let entry = self.mem(dict);
            let k = entry.x();  // key
            let value = entry.y();
            let next = entry.z();
            if key == k {
                Ok(next)
            } else {
                let d = self.dict_del(next, key)?;
                self.dict_add(d, k, value)
            }
        } else {
            Ok(NIL)
        }
    }

    pub fn deque_new(&self) -> Any { EMPTY_DQ }
    pub fn deque_empty(&self, deque: Any) -> bool {
        if self.typeq(PAIR_T, deque) {
            let front = self.car(deque);
            let back = self.cdr(deque);
            !(self.typeq(PAIR_T, front) || self.typeq(PAIR_T, back))
        } else {
            true  // default = empty
        }
    }
    pub fn deque_push(&mut self, deque: Any, item: Any) -> Result<Any, Error> {
        let front = self.car(deque);
        let front = self.cons(item, front)?;
        let back = self.cdr(deque);
        self.cons(front, back)
    }
    pub fn deque_pop(&mut self, deque: Any) -> Result<(Any, Any), Error> {
        if self.typeq(PAIR_T, deque) {
            let mut front = self.car(deque);
            let mut back = self.cdr(deque);
            if !self.typeq(PAIR_T, front) {
                while self.typeq(PAIR_T, back) {
                    // transfer back to front
                    let item = self.car(back);
                    back = self.cdr(back);
                    front = self.cons(item, front)?;
                }
            }
            if self.typeq(PAIR_T, front) {
                let item = self.car(front);
                front = self.cdr(front);
                let deque = self.cons(front, back)?;
                return Ok((deque, item))
            }
        }
        Ok((deque, UNDEF))
    }
    pub fn deque_put(&mut self, deque: Any, item: Any) -> Result<Any, Error> {
        let front = self.car(deque);
        let back = self.cdr(deque);
        let back = self.cons(item, back)?;
        self.cons(front, back)
    }
    pub fn deque_pull(&mut self, deque: Any) -> Result<(Any, Any), Error> {
        if self.typeq(PAIR_T, deque) {
            let mut front = self.car(deque);
            let mut back = self.cdr(deque);
            if !self.typeq(PAIR_T, back) {
                while self.typeq(PAIR_T, front) {
                    // transfer front to back
                    let item = self.car(front);
                    front = self.cdr(front);
                    back = self.cons(item, back)?;
                }
            }
            if self.typeq(PAIR_T, back) {
                let item = self.car(back);
                back = self.cdr(back);
                let deque = self.cons(front, back)?;
                return Ok((deque, item))
            }
        }
        Ok((deque, UNDEF))
    }
    pub fn deque_len(&self, deque: Any) -> isize {
        let front = self.car(deque);
        let back = self.cdr(deque);
        self.list_len(front) + self.list_len(back)
    }

    fn e_first(&self) -> Any { self.ram(self.ddeque()).t() }
    fn set_e_first(&mut self, ptr: Any) { self.ram_mut(self.ddeque()).set_t(ptr); }
    fn e_last(&self) -> Any { self.ram(self.ddeque()).x() }
    fn set_e_last(&mut self, ptr: Any) { self.ram_mut(self.ddeque()).set_x(ptr); }
    fn k_first(&self) -> Any { self.ram(self.ddeque()).y() }
    fn set_k_first(&mut self, ptr: Any) { self.ram_mut(self.ddeque()).set_y(ptr); }
    fn k_last(&self) -> Any { self.ram(self.ddeque()).z() }
    fn set_k_last(&mut self, ptr: Any) { self.ram_mut(self.ddeque()).set_z(ptr); }
    pub fn ddeque(&self) -> Any { DDEQUE }

    pub fn rom_top(&self) -> Any { self.rom_top }
    pub fn set_rom_top(&mut self, ptr: Any) { self.rom_top = ptr }
    pub fn ram_top(&self) -> Any { self.ram(self.memory()).t() }
    fn set_ram_top(&mut self, ptr: Any) { self.ram_mut(self.memory()).set_t(ptr); }
    fn ram_next(&self) -> Any { self.ram(self.memory()).x() }
    fn set_ram_next(&mut self, ptr: Any) { self.ram_mut(self.memory()).set_x(ptr); }
    fn ram_free(&self) -> Any { self.ram(self.memory()).y() }
    fn set_ram_free(&mut self, fix: Any) { self.ram_mut(self.memory()).set_y(fix); }
    fn ram_root(&self) -> Any { self.ram(self.memory()).z() }
    fn set_ram_root(&mut self, ptr: Any) { self.ram_mut(self.memory()).set_z(ptr); }
    pub fn memory(&self) -> Any { MEMORY }
    pub fn blob_top(&self) -> Any { Any::fix(BLOB_RAM_MAX as isize) }

    fn new_event(&mut self, target: Any, msg: Any) -> Result<Any, Error> {
        //assert!(self.typeq(ACTOR_T, target));
        if !self.typeq(ACTOR_T, target) {
            return Err(E_NOT_CAP);
        }
        let sponsor = self.event_sponsor(self.ep());
        let event = Quad::new_event(sponsor, target, msg);
        self.alloc(&event)
    }
    fn new_cont(&mut self, ip: Any, sp: Any, ep: Any) -> Result<Any, Error> {
        let cont = Quad::new_cont(ip, sp, ep);
        self.reserve(&cont)  // no Sponsor needed
    }
    fn new_actor(&mut self, beh: Any, state: Any) -> Result<Any, Error> {
        let actor = Quad::new_actor(beh, state);
        let ptr = self.alloc(&actor)?;
        Ok(self.ptr_to_cap(ptr))
    }

    fn stack_pairs(&mut self, n: isize) -> Result<(), Error> {
        assert!(n < 64);  // FIXME: replace with cycle-limit(s) in Sponsor
        if n > 0 {
            let mut n = n;
            let h = self.stack_pop();
            let lst = self.cons(h, NIL)?;
            let mut p = lst;
            while n > 1 {
                let h = self.stack_pop();
                let q = self.cons(h, NIL)?;
                self.set_cdr(p, q);
                p = q;
                n -= 1;
            }
            let t = self.stack_pop();
            self.set_cdr(p, t);
            self.stack_push(lst)?;
        };
        Ok(())
    }
    fn stack_parts(&mut self, n: isize) -> Result<(), Error> {
        assert!(n < 64);  // FIXME: replace with cycle-limit(s) in Sponsor
        let mut s = self.stack_pop();  // list to destructure
        if n > 0 {
            let mut n = n;
            let lst = self.cons(self.car(s), NIL)?;
            let mut p = lst;
            while n > 1 {
                s = self.cdr(s);
                let q = self.cons(self.car(s), NIL)?;
                self.set_cdr(p, q);
                p = q;
                n -= 1;
            }
            let t = self.cons(self.cdr(s), self.sp())?;
            self.set_cdr(p, t);
            self.set_sp(lst);
        }
        Ok(())
    }
    fn stack_roll(&mut self, n: isize) -> Result<(), Error> {
        if n > 1 {
            assert!(n < 64);  // FIXME: replace with cycle-limit(s) in Sponsor
            let sp = self.sp();
            let (pred, nth) = self.split_nth(sp, n);
            if self.typeq(PAIR_T, nth) {
                self.set_cdr(pred, self.cdr(nth));
                self.set_cdr(nth, sp);
                self.set_sp(nth);
            } else {
                self.stack_push(UNDEF)?;  // out of range
            }
        } else if n < -1 {
            assert!(n > -64);  // FIXME: replace with cycle-limit(s) in Sponsor
            let sp = self.sp();
            let (_, nth) = self.split_nth(sp, -n);
            if self.typeq(PAIR_T, nth) {
                self.set_sp(self.cdr(sp));
                self.set_cdr(sp, self.cdr(nth));
                self.set_cdr(nth, sp);
            } else {
                self.stack_pop();  // out of range
            }
        };
        Ok(())
    }
    fn stack_dup(&mut self, n: isize) -> Result<(), Error> {
        let mut n = n;
        if n > 0 {
            let mut s = self.sp();
            let sp = self.cons(self.car(s), NIL)?;
            let mut p = sp;
            s = self.cdr(s);
            n -= 1;
            while n > 0 {
                let q = self.cons(self.car(s), NIL)?;
                self.set_cdr(p, q);
                p = q;
                s = self.cdr(s);
                n -= 1;
            }
            self.set_cdr(p, self.sp());
            self.set_sp(sp);
        }
        Ok(())
    }
    fn stack_clear(&mut self, top: Any) {
        let mut sp = self.sp();
        while sp != top && self.typeq(PAIR_T, sp) {
            let p = sp;
            sp = self.cdr(p);
            self.free(p);  // free pair holding stack item
        }
        self.set_sp(sp);
    }
    fn stack_pop(&mut self) -> Any {
        let sp = self.sp();
        if self.typeq(PAIR_T, sp) {
            let item = self.car(sp);
            self.set_sp(self.cdr(sp));
            // FIXME: avoid inconsistent stack state when hitting memory limits
            //self.free(sp);  // free pair holding stack item
            item
        } else {
            UNDEF  // stack underflow
        }
    }
    fn stack_push(&mut self, val: Any) -> Result<(), Error> {
        let sp = self.cons(val, self.sp())?;
        self.set_sp(sp);
        Ok(())
    }

    pub fn cons(&mut self, car: Any, cdr: Any) -> Result<Any, Error> {
        let pair = Quad::pair_t(car, cdr);
        self.alloc(&pair)
    }
    pub fn nth(&self, list: Any, index: Any) -> Any {
        if let Some(n) = index.fix_num() {
            self.extract_nth(list, n)
        } else {
            UNDEF
        }
    }
    pub fn car(&self, pair: Any) -> Any {
        if self.typeq(PAIR_T, pair) {
            self.mem(pair).x()
        } else {
            UNDEF
        }
    }
    pub fn cdr(&self, pair: Any) -> Any {
        if self.typeq(PAIR_T, pair) {
            self.mem(pair).y()
        } else {
            UNDEF
        }
    }
    fn _set_car(&mut self, pair: Any, val: Any) {
        assert!(self.in_heap(pair));
        assert!(self.ram(pair).t() == PAIR_T);
        self.ram_mut(pair).set_x(val);
    }
    fn set_cdr(&mut self, pair: Any, val: Any) {
        assert!(self.in_heap(pair));
        assert!(self.ram(pair).t() == PAIR_T);
        self.ram_mut(pair).set_y(val);
    }

    pub fn kp(&self) -> Any {  // continuation pointer
        let kp = self.k_first();
        if !kp.is_ram() { return UNDEF }
        kp
    }
    pub fn ip(&self) -> Any {  // instruction pointer
        let kp = self.kp();
        if !kp.is_ram() { return UNDEF }
        let quad = self.mem(kp);
        quad.t()
    }
    pub fn sp(&self) -> Any {  // stack pointer
        let kp = self.kp();
        if !kp.is_ram() { return UNDEF }
        let quad = self.mem(kp);
        quad.x()
    }
    pub fn ep(&self) -> Any {  // event pointer
        let kp = self.kp();
        if !kp.is_ram() { return UNDEF }
        let quad = self.mem(kp);
        quad.y()
    }
    fn set_ip(&mut self, ptr: Any) {
        let quad = self.ram_mut(self.kp());
        quad.set_t(ptr)
    }
    fn set_sp(&mut self, ptr: Any) {
        let quad = self.ram_mut(self.kp());
        quad.set_x(ptr)
    }

    pub fn typeq(&self, typ: Any, val: Any) -> bool {
        if typ == FIXNUM_T {
            val.is_fix()
        } else if typ == ACTOR_T {
            if val.is_cap() {
                // NOTE: we don't use `cap_to_ptr` here to avoid the type assertion.
                let raw = val.raw() & !OPQ_RAW;  // WARNING: converting Cap to Ptr!
                let ptr = Any::new(raw);
                let t = self.mem(ptr).t();
                (t == ACTOR_T) || (t == PROXY_T)  // proxies count as actors for message addressing
            } else {
                false
            }
        } else if val.is_ptr() {
            self.mem(val).t() == typ
        } else {
            false
        }
    }
    pub fn in_heap(&self, val: Any) -> bool {
        val.is_ram() && (val.ofs() < self.ram_top().ofs())
    }
    pub fn ptr_to_cap(&self, ptr: Any) -> Any {
        let t = self.mem(ptr).t();
        assert!((t == ACTOR_T) || (t == PROXY_T));
        let raw = ptr.raw() | OPQ_RAW;
        let cap = Any::new(raw);
        cap
    }
    pub fn cap_to_ptr(&self, cap: Any) -> Any {
        let raw = cap.raw() & !OPQ_RAW;
        let ptr = Any::new(raw);
        let t = self.mem(ptr).t();
        assert!((t == ACTOR_T) || (t == PROXY_T));
        ptr
    }

    pub fn reserve_stub(&mut self, device: Any, target: Any) -> Result<Any, Error> {
        if !device.is_cap() {
            return Err(E_NOT_CAP);
        }
        let mut stub = Quad::stub_t(device, target);
        stub.set_z(self.ram_root());
        let ptr = self.reserve(&stub)?;
        self.set_ram_root(ptr);  // link stub into GC root-set
        Ok(ptr)
    }
    pub fn release_stub(&mut self, ptr: Any) {
        let stub = self.ram(ptr);
        assert!(stub.t() == STUB_T);
        let skip = stub.z();
        let mut root = self.memory();  // WARNING: we are counting on the fact that `z` is the GC root!
        while root.is_ram() {
            let next = self.ram(root).z();
            if next == ptr {
                self.ram_mut(root).set_z(skip);  // remove stub from GC root-set
                break;
            }
            root = next;
        }
        self.free(ptr);
    }

    pub fn reserve_rom(&mut self) -> Result<Any, Error> {
        // expand read-only memory
        let next = self.rom_top();
        let top = next.ofs();
        if top >= QUAD_ROM_MAX {
            //panic!("out of memory!");
            return Err(E_NO_MEM);  // no memory available
        }
        self.set_rom_top(Any::rom(top + 1));
        Ok(next)
    }

    pub fn alloc(&mut self, init: &Quad) -> Result<Any, Error> {
        let ep = self.ep();
        let sponsor = self.event_sponsor(ep);
        let limit = self.sponsor_memory(sponsor).fix_num().unwrap_or(0);
        if limit <= 0 {
            //panic!("memory limit reached");
            return Err(E_MEM_LIM);  // Sponsor memory limit reached
        }
        let ptr = self.reserve(init)?;
        self.set_sponsor_memory(sponsor, Any::fix(limit - 1));
        Ok(ptr)
    }
    pub fn reserve(&mut self, init: &Quad) -> Result<Any, Error> {
        let next = self.ram_next();
        let ptr = if self.typeq(FREE_T, next) {
            // use quad from free-list
            let n = self.ram_free().fix_num().unwrap();
            assert!(n > 0);  // number of free cells available
            self.set_ram_free(Any::fix(n - 1));  // decrement cells available
            self.set_ram_next(self.ram(next).z());  // update free-list
            next
        } else {
            // expand top-of-memory
            let top = self.ram_top();
            let ofs = top.ofs() + 1;
            if ofs > QUAD_RAM_MAX {
                //panic!("out of memory!");
                /*
                self.gc_collect();
                if let Some(m) = self.ram_free().fix_num() {
                    if m >= 16 {  // ensure some margin after GC
                        return self.reserve(init);
                    }
                }
                */
                return Err(E_NO_MEM);  // no memory available
            }
            self.set_ram_top(Any::ram(ofs));
            top
        };
        self.gc_store(ptr, *init);  // copy initial value
        self.gc_reserve(ptr);
        Ok(ptr)
    }
    pub fn free(&mut self, _ptr: Any) {
        // NOTE: comment out the next line to remove "proactive" calls to `release`
        //self.release(_ptr)
    }
    fn release(&mut self, ptr: Any) {
        assert!(self.in_heap(ptr));
        if self.typeq(FREE_T, ptr) {
            panic!("double-free {}", ptr.raw());
        }
        self.gc_release(ptr);
        *self.ram_mut(ptr) = Quad::free_t(self.ram_next());  // clear cell to "free"
        self.set_ram_next(ptr);  // link into free-list
        let n = self.ram_free().fix_num().unwrap();
        self.set_ram_free(Any::fix(n + 1));  // increment cells available
    }

    pub fn gc_increment(&mut self) {
        if self.gc_state.is_rom() {
            self.gc_init_phase();
            self.gc_state = Any::fix(0);
        } else if self.gc_state.is_fix() {
            let steps = self.gc_scan_phase(GC_STRIDE);
            if steps > 0 {
                let ofs = self.ram_top().ofs() - 1;
                self.gc_state = Any::ram(ofs);
            }
        } else if self.gc_state.is_ram() {
            let mut ofs = self.gc_state.ofs();
            if ofs >= RAM_BASE_OFS {
                ofs = self.gc_sweep_phase(GC_STRIDE, ofs);
                self.gc_state = Any::ram(ofs);
            } else {
                self.gc_state = UNDEF;
            }
        }
    }
    pub fn gc_collect(&mut self) {
        assert_eq!(UNDEF, self.gc_state);  // WARNING! cannot overlap with `gc_increment` phases
        self.gc_init_phase();
        while self.gc_scan_phase(GC_STRIDE) == 0
            {}
        let mut ofs = self.ram_top().ofs() - 1;
        while ofs >= RAM_BASE_OFS {
            ofs = self.gc_sweep_phase(GC_STRIDE, ofs);
        }
    }
    fn gc_init_phase(&mut self) {
        // clear gc queue
        self.gc_queue[GC_FIRST] = NIL;
        self.gc_queue[GC_LAST] = NIL;
        // scan reserved RAM
        let mut ofs = DDEQUE.ofs();
        while ofs < RAM_BASE_OFS {
            let ptr = Any::ram(ofs);
            self.gc_scan(ptr);
            ofs += 1;
        }
        self.gc_mark(self.ram_root());
    }
    fn gc_scan_phase(&mut self, mut steps: usize) -> usize {
        // scan items in gc queue
        while steps > 0 {
            steps -= 1;
            match self.gc_dequeue() {
                Some(item) => self.gc_scan(item),
                None => break,
            }
        }
        steps
    }
    fn gc_sweep_phase(&mut self, mut steps: usize, mut ofs: usize) -> usize {
        // sweep unreachable cells into free-list
        while steps > 0 && ofs >= RAM_BASE_OFS {
            steps -= 1;
            let color = self.gc_queue[ofs];
            if color == UNDEF {  // still "white"
                let ptr = Any::ram(ofs);
                if self.ram(ptr).t() != FREE_T {  // not already free
                    // add to free-list
                    self.release(ptr);
                }
            } else {
                assert_eq!(UNIT, color);  // must be "black"
                self.gc_queue[ofs] = UNDEF;  // mark "white"
            }
            ofs -= 1;
        }
        ofs
    }
    fn gc_reserve(&mut self, ptr: Any) {
        // sync reservation with GC
        let ofs = ptr.ofs();
        if self.gc_state.is_rom() {
            // between GC passes, new allocations are assumed to be unreachable
            self.gc_queue[ofs] = UNDEF;  // mark "white"
        } else if self.gc_state.is_fix() {
            // during GC scanning, new allocations are added to the scan queue
            let color = self.gc_queue[ofs];
            if color == UNDEF || color == UNIT {
                // change "white" or "black" to "grey"
                self.gc_enqueue(ptr);
            }
        } else if self.gc_state.is_ram() {
            // during GC sweeping, new allocations are assumed to be reachable
            let sweep = self.gc_state.ofs();
            self.gc_queue[ofs] = if ofs > sweep {
                UNDEF  // mark "white"
            } else {
                UNIT  // mark "black"
            }
        }
    }
    fn gc_release(&mut self, ptr: Any) {
        // sync release with GC
        self.gc_remove(ptr);
    }

    fn gc_mark(&mut self, val: Any) {
        let raw = val.raw() & !OPQ_RAW;
        let ptr = Any::new(raw);  // strip opaque bit
        if ptr.is_ram() {
            let ofs = ptr.ofs();
            if self.gc_queue[ofs] == UNDEF {
                // change "white" to "grey"
                self.gc_enqueue(ptr);
            }
        }
    }
    fn gc_scan(&mut self, ptr: Any) {
        let quad = self.gc_load(ptr);
        self.gc_mark(quad.t());
        self.gc_mark(quad.x());
        self.gc_mark(quad.y());
        self.gc_mark(quad.z());
    }
    fn gc_enqueue(&mut self, ptr: Any) {
        // add location to the back of the queue
        let queue = &mut self.gc_queue;
        queue[ptr.ofs()] = NIL;
        if !queue[GC_FIRST].is_ram() {
            queue[GC_FIRST] = ptr;
        } else {
            let last = queue[GC_LAST];
            queue[last.ofs()] = ptr;
        }
        queue[GC_LAST] = ptr;
    }
    fn gc_dequeue(&mut self) -> Option<Any> {
        // remove location from the front of the queue
        let queue = &mut self.gc_queue;
        let first = queue[GC_FIRST];
        if first.is_ram() {
            //assert_ne!(self.quad_ram[first.ofs()].t(), FREE_T);  // FIXME: this should be impossible...
            let next = queue[first.ofs()];
            queue[GC_FIRST] = next;
            if !next.is_ram() {
                queue[GC_LAST] = NIL;
            }
            queue[first.ofs()] = UNIT;  // mark "black"
            Some(first)
        } else {
            None
        }
    }
    fn gc_remove(&mut self, ptr: Any) {
        // remove `ptr` from queue (if present), and mark it "white"
        let queue = &mut self.gc_queue;
        let ofs = ptr.ofs();
        let next = queue[ofs];
        if next == UNDEF {
            return;  // already "white"
        }
        if next == UNIT {
            queue[ofs] = UNDEF;  // change "black" to "white"
            return;
        }
        let mut curr = GC_FIRST;
        let mut item = queue[curr];
        while item.is_ram() {
            if ptr == item {
                queue[curr] = next;
                if next == NIL {
                    queue[GC_LAST] = if curr == GC_FIRST {
                        NIL
                    } else {
                        Any::ram(curr)
                    }
                }
                break;
            }
            curr = item.ofs();
            item = queue[curr];
        }
        queue[ofs] = UNDEF;  // change "grey" to "white"
    }

    pub fn gc_color(&self, ptr: Any) -> Any {
        if ptr.is_ram() {
            self.gc_queue[ptr.ofs()]
        } else {
            FALSE  // since UNDEF="white", FALSE="no color"
        }
    }
    pub fn gc_state(&self) -> Any {
        self.gc_state
    }
    fn gc_load(&self, ptr: Any) -> Quad {  // load quad directly
        let raw = ptr.raw();
        if (raw & (DIR_RAW | MUT_RAW)) != MUT_RAW {  // must be ram or cap
            panic!("invalid gc_load=${:08x}", raw)
        }
        let ofs = (raw & !MSK_RAW) as usize;
        self.quad_ram[ofs]
    }
    fn gc_store(&mut self, ptr: Any, quad: Quad) {  // store quad directly
        let raw = ptr.raw();
        if (raw & (DIR_RAW | MUT_RAW)) != MUT_RAW {  // must be ram or cap
            panic!("invalid gc_store=${:08x}", raw)
        }
        let ofs = (raw & !MSK_RAW) as usize;
        self.quad_ram[ofs] = quad;
    }

    fn device_id(&self, dev: Any) -> Result<usize, Error> {
        if dev.is_fix() {
            return Err(E_NOT_PTR);
        }
        let mut ptr = Any::new(dev.raw() & !OPQ_RAW);  // ignore opaque bit
        let mut quad = self.ram(ptr);
        if quad.t() == PROXY_T || quad.t() == STUB_T {
            // follow device reference...
            ptr = self.cap_to_ptr(quad.x());
            quad = self.ram(ptr);
        }
        if quad.t() == ACTOR_T {
            let id = quad.x().get_fix()? as usize;
            if id < DEVICE_MAX {
                Ok(id)
            } else {
                Err(E_BOUNDS)
            }
        } else {
            Err(E_NOT_CAP)
        }
    }

    fn follow_fwd(&self, val: Any) -> Result<Any, Error> {
        let mut fwd = val;
        if !fwd.is_fix() {
            let mut hop = 0;
            let mut quad = self.quad(fwd);
            while quad.is_fwd_ref() {
                fwd = quad.z();
                if fwd == UNDEF {  // unresolved "promise"
                    return Err(E_NOT_PTR);
                }
                hop += 1;
                if hop > 3 {
                    return Err(E_BOUNDS);
                }
                if !fwd.is_fix() {
                    quad = self.quad(fwd);
                }
            }
        }
        Ok(fwd)
    }
    fn quad(&self, ptr: Any) -> &Quad {  // non-forwarding quad access
        if ptr.is_fix() {
            panic!("invalid ptr=${:08x}", ptr.raw());
        }
        let ofs = ptr.ofs();
        if ptr.is_rom() {
            &self.quad_rom[ofs]
        } else {
            &self.quad_ram[ofs]
        }
    }
    pub fn mem(&self, ptr: Any) -> &Quad {
        if !ptr.is_ptr() {
            panic!("invalid ptr=${:08x}", ptr.raw());
        }
        if ptr.is_rom() {
            self.rom(ptr)
        } else {
            self.ram(ptr)
        }
    }
    pub fn rom(&self, ptr: Any) -> &Quad {
        if !ptr.is_rom() {
            panic!("invalid ROM ptr=${:08x}", ptr.raw());
        }
        let fwd = self.follow_fwd(ptr).unwrap();  // FIXME: report error?
        let ofs = fwd.ofs();
        &self.quad_rom[ofs]
    }
    pub fn ram(&self, ptr: Any) -> &Quad {
        let fwd = self.follow_fwd(ptr).unwrap();  // FIXME: report error?
        if !ptr.is_ram() {
            panic!("invalid RAM ptr=${:08x}", fwd.raw());
        }
        let ofs = fwd.ofs();
        &self.quad_ram[ofs]
    }
    pub fn ram_mut(&mut self, ptr: Any) -> &mut Quad {
        let fwd = self.follow_fwd(ptr).unwrap();  // FIXME: report error?
        if !ptr.is_ram() {
            panic!("invalid RAM ptr=${:08x}", fwd.raw());
        }
        let ofs = fwd.ofs();
        if ofs >= RAM_BASE_OFS {
            self.gc_reserve(fwd);  // FIXME: this is conservative, but it could be fairly expensive.
        }
        &mut self.quad_ram[ofs]
    }

    pub fn rom_buffer(&self) -> &[Quad] {
        &self.quad_rom
    }
    pub fn ram_buffer(&self) -> &[Quad] {
        &self.quad_ram
    }
    pub fn blob_buffer(&self) -> &[u8] {
        &self.blob_ram
    }
    pub fn blob_read(&self, ofs: usize) -> u8 {
        self.blob_ram[ofs]
    }
    pub fn blob_write(&mut self, ofs: usize, data: u8) {
        self.blob_ram[ofs] = data;
    }
}

fn u16_lsb(nat: usize) -> u8 {
    (nat & 0xFF) as u8
}

fn u16_msb(nat: usize) -> u8 {
    ((nat >> 8) & 0xFF) as u8
}

fn falsey(v: Any) -> bool {
    v == FALSE || v == UNDEF || v == NIL || v == ZERO
}

#[cfg(test)]
mod tests {
    use super::*;

    fn load_std(core: &mut Core) -> Any {
        // prepare ROM with library of idioms
pub const STD_OFS: usize = ROM_BASE_OFS;
        let quad_rom = &mut core.quad_rom;

pub const SINK_BEH: Any = Any { raw: (STD_OFS+0) as Raw };  // alias for no-op behavior
pub const COMMIT: Any = Any { raw: (STD_OFS+0) as Raw };
        quad_rom[COMMIT.ofs()]      = Quad::vm_end_commit();
pub const SEND_MSG: Any = Any { raw: (STD_OFS+1) as Raw };
        quad_rom[SEND_MSG.ofs()]      = Quad::vm_send(MINUS_1, COMMIT);
pub const CUST_SEND: Any = Any { raw: (STD_OFS+2) as Raw };
        quad_rom[CUST_SEND.ofs()]   = Quad::vm_msg(PLUS_1, SEND_MSG);
pub const RV_SELF: Any = Any { raw: (STD_OFS+3) as Raw };
        quad_rom[RV_SELF.ofs()]     = Quad::vm_my_self(CUST_SEND);
pub const RV_UNDEF: Any = Any { raw: (STD_OFS+4) as Raw };
        quad_rom[RV_UNDEF.ofs()]    = Quad::vm_push(UNDEF, CUST_SEND);
pub const RV_NIL: Any = Any { raw: (STD_OFS+5) as Raw };
        quad_rom[RV_NIL.ofs()]      = Quad::vm_push(NIL, CUST_SEND);
pub const RV_FALSE: Any = Any { raw: (STD_OFS+6) as Raw };
        quad_rom[RV_FALSE.ofs()]    = Quad::vm_push(FALSE, CUST_SEND);
pub const RV_TRUE: Any = Any { raw: (STD_OFS+7) as Raw };
        quad_rom[RV_TRUE.ofs()]     = Quad::vm_push(TRUE, CUST_SEND);
pub const RV_UNIT: Any = Any { raw: (STD_OFS+8) as Raw };
        quad_rom[RV_UNIT.ofs()]     = Quad::vm_push(UNIT, CUST_SEND);
pub const RV_ZERO: Any = Any { raw: (STD_OFS+9) as Raw };
        quad_rom[RV_ZERO.ofs()]     = Quad::vm_push(ZERO, CUST_SEND);
pub const RV_ONE: Any = Any { raw: (STD_OFS+10) as Raw };
        quad_rom[RV_ONE.ofs()]      = Quad::vm_push(PLUS_1, CUST_SEND);
pub const RESEND: Any = Any { raw: (STD_OFS+11) as Raw };
        quad_rom[RESEND.ofs()+0]    = Quad::vm_msg(ZERO, Any::rom(RESEND.ofs()+1));
        quad_rom[RESEND.ofs()+1]    = Quad::vm_my_self(SEND_MSG);
pub const STOP: Any = Any { raw: (STD_OFS+13) as Raw };
        quad_rom[STOP.ofs()]        = Quad::vm_end_stop();
pub const ABORT: Any = Any { raw: (STD_OFS+14) as Raw };
        quad_rom[ABORT.ofs()+0]     = Quad::vm_push(UNDEF, Any::rom(ABORT.ofs()+1));  // reason=#?
        quad_rom[ABORT.ofs()+1]     = Quad::vm_end_abort();

        core.rom_top = Any::rom(STD_OFS+16);
        SINK_BEH
    }

    /*
    (define fib                 ; O(n!) performance?
        (lambda (n)             ; msg: (cust n)
        (if (< n 2)
            n
            (+ (fib (- n 1)) (fib (- n 2))) )))
    */
    fn load_fib_test(core: &mut Core) -> Any {
        // prepare ROM with fib(6) => 8 test case
pub const LIB_OFS: usize = ROM_BASE_OFS;
        let quad_rom = &mut core.quad_rom;

pub const COMMIT: Any = Any { raw: (LIB_OFS+0) as Raw };
        quad_rom[COMMIT.ofs()]      = Quad::vm_end_commit();
pub const SEND_MSG: Any = Any { raw: (LIB_OFS+1) as Raw };
        quad_rom[SEND_MSG.ofs()]    = Quad::vm_send(MINUS_1, COMMIT);
pub const CUST_SEND: Any = Any { raw: (LIB_OFS+2) as Raw };
        quad_rom[CUST_SEND.ofs()]   = Quad::vm_msg(PLUS_1, SEND_MSG);

pub const F_FIB_OFS: usize = LIB_OFS+3;
pub const F_FIB_BEH: Any = Any { raw: F_FIB_OFS as Raw };
        quad_rom[F_FIB_OFS+0]       = Quad::vm_msg(PLUS_2, Any::rom(F_FIB_OFS+1));  // n
        quad_rom[F_FIB_OFS+1]       = Quad::vm_dup(PLUS_1, Any::rom(F_FIB_OFS+2));  // n n
        quad_rom[F_FIB_OFS+2]       = Quad::vm_push(PLUS_2, Any::rom(F_FIB_OFS+3));  // n n 2
        quad_rom[F_FIB_OFS+3]       = Quad::vm_cmp_lt(Any::rom(F_FIB_OFS+4));  // n n<2
        quad_rom[F_FIB_OFS+4]       = Quad::vm_if(CUST_SEND, Any::rom(F_FIB_OFS+5));  // n

        quad_rom[F_FIB_OFS+5]       = Quad::vm_msg(PLUS_1, Any::rom(F_FIB_OFS+6));  // n cust
        quad_rom[F_FIB_OFS+6]       = Quad::vm_push(F_FIB_K, Any::rom(F_FIB_OFS+7));  // n cust fib-k
        quad_rom[F_FIB_OFS+7]       = Quad::vm_new(MINUS_1, Any::rom(F_FIB_OFS+8));  // n k=fib-k.cust

        quad_rom[F_FIB_OFS+8]       = Quad::vm_pick(PLUS_2, Any::rom(F_FIB_OFS+9));  // n k n
        quad_rom[F_FIB_OFS+9]       = Quad::vm_push(PLUS_1, Any::rom(F_FIB_OFS+10));  // n k n 1
        quad_rom[F_FIB_OFS+10]      = Quad::vm_alu_sub(Any::rom(F_FIB_OFS+11));  // n k n-1
        quad_rom[F_FIB_OFS+11]      = Quad::vm_pick(PLUS_2, Any::rom(F_FIB_OFS+12));  // n k n-1 k
        quad_rom[F_FIB_OFS+12]      = Quad::vm_push(F_FIB_BEH, Any::rom(F_FIB_OFS+13));  // n k n-1 k fib-beh
        quad_rom[F_FIB_OFS+13]      = Quad::vm_new(ZERO, Any::rom(F_FIB_OFS+14));  // n k n-1 k fib.()
        quad_rom[F_FIB_OFS+14]      = Quad::vm_send(PLUS_2, Any::rom(F_FIB_OFS+15));  // n k

        quad_rom[F_FIB_OFS+15]      = Quad::vm_roll(PLUS_2, Any::rom(F_FIB_OFS+16));  // k n
        quad_rom[F_FIB_OFS+16]      = Quad::vm_push(PLUS_2, Any::rom(F_FIB_OFS+17));  // k n 2
        quad_rom[F_FIB_OFS+17]      = Quad::vm_alu_sub(Any::rom(F_FIB_OFS+18));  // k n-2
        quad_rom[F_FIB_OFS+18]      = Quad::vm_roll(PLUS_2, Any::rom(F_FIB_OFS+19));  // n-2 k
        quad_rom[F_FIB_OFS+19]      = Quad::vm_push(F_FIB_BEH, Any::rom(F_FIB_OFS+20));  // n-2 k fib-beh
        quad_rom[F_FIB_OFS+20]      = Quad::vm_new(ZERO, Any::rom(F_FIB_OFS+21));  // n-2 k fib.()
        quad_rom[F_FIB_OFS+21]      = Quad::vm_send(PLUS_2, COMMIT);  // --

pub const F_FIB_K: Any = Any { raw: (F_FIB_OFS+22) as Raw };
        // state: cust
        quad_rom[F_FIB_OFS+22]      = Quad::vm_msg(ZERO, Any::rom(F_FIB_OFS+23));  // m
        quad_rom[F_FIB_OFS+23]      = Quad::vm_state(ZERO, Any::rom(F_FIB_OFS+24));  // m cust
        quad_rom[F_FIB_OFS+24]      = Quad::vm_push(F_FIB_K2, Any::rom(F_FIB_OFS+25));  // m cust fib-k2
        quad_rom[F_FIB_OFS+25]      = Quad::vm_beh(PLUS_2, COMMIT);  // fib-k2.(cust m)

pub const F_FIB_K2: Any = Any { raw: (F_FIB_OFS+26) as Raw };
        // state: (cust m)
        quad_rom[F_FIB_OFS+26]      = Quad::vm_state(PLUS_2, Any::rom(F_FIB_OFS+27));  // m
        quad_rom[F_FIB_OFS+27]      = Quad::vm_msg(ZERO, Any::rom(F_FIB_OFS+28));  // m n
        quad_rom[F_FIB_OFS+28]      = Quad::vm_alu_add(Any::rom(F_FIB_OFS+29));  // m+n
        quad_rom[F_FIB_OFS+29]      = Quad::vm_state(PLUS_1, SEND_MSG);  // m+n cust

pub const TEST_OFS: usize = F_FIB_OFS+30;
pub const TEST_BEH: Any    = Any { raw: TEST_OFS as Raw };
        quad_rom[TEST_OFS+0]        = Quad::vm_push(PLUS_6, Any::rom(TEST_OFS+1));  // 6
        quad_rom[TEST_OFS+1]        = Quad::vm_push(EQ_8_BEH, Any::rom(TEST_OFS+2));  // 6 eq-8-beh
        quad_rom[TEST_OFS+2]        = Quad::vm_new(ZERO, Any::rom(TEST_OFS+3));  // 6 cust=eq-8.()
        quad_rom[TEST_OFS+3]        = Quad::vm_push(F_FIB_BEH, Any::rom(TEST_OFS+4));  // 6 cust fib-beh
        quad_rom[TEST_OFS+4]        = Quad::vm_new(ZERO, Any::rom(TEST_OFS+5));  // 6 cust fib.()
        quad_rom[TEST_OFS+5]        = Quad::vm_send(PLUS_2, COMMIT);  // --

pub const EQ_8_BEH: Any = Any { raw: (TEST_OFS+6) as Raw };
        quad_rom[TEST_OFS+6]        = Quad::vm_msg(ZERO, Any::rom(TEST_OFS+7));  // msg
        quad_rom[TEST_OFS+7]        = Quad::vm_is_eq(PLUS_8, COMMIT);  // assert_eq(8, msg)

        core.rom_top = Any::rom(TEST_OFS+8);
        TEST_BEH
    }

    fn load_dict_test(core: &mut Core) -> Any {
        // prepare ROM with VM_DICT test suite
pub const LIB_OFS: usize = ROM_BASE_OFS;
        let quad_rom = &mut core.quad_rom;

pub const T_DICT_OFS: usize = LIB_OFS+0;
pub const T_DICT_BEH: Any  = Any { raw: T_DICT_OFS as Raw };
        quad_rom[T_DICT_OFS+0]      = Quad::vm_dict_has(Any::rom(T_DICT_OFS+1));  // #f
        quad_rom[T_DICT_OFS+1]      = Quad::vm_is_eq(FALSE, Any::rom(T_DICT_OFS+2));  // --
        quad_rom[T_DICT_OFS+2]      = Quad::vm_push(NIL, Any::rom(T_DICT_OFS+3));  // ()
        quad_rom[T_DICT_OFS+3]      = Quad::vm_push(ZERO, Any::rom(T_DICT_OFS+4));  // () 0
        quad_rom[T_DICT_OFS+4]      = Quad::vm_dup(PLUS_2, Any::rom(T_DICT_OFS+5));  // () 0 () 0
        quad_rom[T_DICT_OFS+5]      = Quad::vm_dict_has(Any::rom(T_DICT_OFS+6));  // #f
        quad_rom[T_DICT_OFS+6]      = Quad::vm_is_eq(FALSE, Any::rom(T_DICT_OFS+7));  // --
        quad_rom[T_DICT_OFS+7]      = Quad::vm_dict_get(Any::rom(T_DICT_OFS+8));  // #?
        quad_rom[T_DICT_OFS+8]      = Quad::vm_is_eq(UNDEF, Any::rom(T_DICT_OFS+9));  // --

        quad_rom[T_DICT_OFS+9]      = Quad::vm_push(NIL, Any::rom(T_DICT_OFS+10));  // ()
        quad_rom[T_DICT_OFS+10]     = Quad::vm_push(ZERO, Any::rom(T_DICT_OFS+11));  // () 0
        quad_rom[T_DICT_OFS+11]     = Quad::vm_push(UNIT, Any::rom(T_DICT_OFS+12));  // () 0 #unit
        quad_rom[T_DICT_OFS+12]     = Quad::vm_dict_set(Any::rom(T_DICT_OFS+13));  // {0:#unit}
        quad_rom[T_DICT_OFS+13]     = Quad::vm_pick(PLUS_1, Any::rom(T_DICT_OFS+14));  // {0:#unit} {0:#unit}
        quad_rom[T_DICT_OFS+14]     = Quad::vm_push(ZERO, Any::rom(T_DICT_OFS+15));  // {0:#unit} {0:#unit} 0
        quad_rom[T_DICT_OFS+15]     = Quad::vm_dict_get(Any::rom(T_DICT_OFS+16));  // {0:#unit} #unit
        quad_rom[T_DICT_OFS+16]     = Quad::vm_is_eq(UNIT, Any::rom(T_DICT_OFS+17));  // {0:#unit}

        quad_rom[T_DICT_OFS+17]     = Quad::vm_push(PLUS_1, Any::rom(T_DICT_OFS+18));  // {0:#unit} 1
        quad_rom[T_DICT_OFS+18]     = Quad::vm_push(MINUS_1, Any::rom(T_DICT_OFS+19));  // {0:#unit} 1 -1
        quad_rom[T_DICT_OFS+19]     = Quad::vm_dict_add(Any::rom(T_DICT_OFS+20));  // {1:-1, 0:#unit}
        quad_rom[T_DICT_OFS+20]     = Quad::vm_pick(PLUS_1, Any::rom(T_DICT_OFS+21));  // {1:-1, 0:#unit} {1:-1, 0:#unit}
        quad_rom[T_DICT_OFS+21]     = Quad::vm_push(ZERO, Any::rom(T_DICT_OFS+22));  // {1:-1, 0:#unit} {1:-1, 0:#unit} 0
        quad_rom[T_DICT_OFS+22]     = Quad::vm_dict_get(Any::rom(T_DICT_OFS+23));  // {1:-1, 0:#unit} #unit
        quad_rom[T_DICT_OFS+23]     = Quad::vm_is_eq(UNIT, Any::rom(T_DICT_OFS+24));  // {1:-1, 0:#unit}

        quad_rom[T_DICT_OFS+24]     = Quad::vm_push(ZERO, Any::rom(T_DICT_OFS+25));  // {1:-1, 0:#unit} 0
        quad_rom[T_DICT_OFS+25]     = Quad::vm_dict_del(Any::rom(T_DICT_OFS+26));  // {1:-1}
        quad_rom[T_DICT_OFS+26]     = Quad::vm_pick(PLUS_1, Any::rom(T_DICT_OFS+27));  // {1:-1} {1:-1}
        quad_rom[T_DICT_OFS+27]     = Quad::vm_push(ZERO, Any::rom(T_DICT_OFS+28));  // {1:-1} {1:-1} 0
        quad_rom[T_DICT_OFS+28]     = Quad::vm_dict_get(Any::rom(T_DICT_OFS+29));  // {1:-1} #undef
        quad_rom[T_DICT_OFS+29]     = Quad::vm_is_eq(UNDEF, Any::rom(T_DICT_OFS+30));  // {1:-1}

        quad_rom[T_DICT_OFS+30]     = Quad::vm_push(PLUS_1, Any::rom(T_DICT_OFS+31));  // {1:-1} 1
        quad_rom[T_DICT_OFS+31]     = Quad::vm_push(FALSE, Any::rom(T_DICT_OFS+32));  // {1:-1} 1 #f
        quad_rom[T_DICT_OFS+32]     = Quad::vm_dict_add(Any::rom(T_DICT_OFS+33));  // {1:#f, 1:-1}
        quad_rom[T_DICT_OFS+33]     = Quad::vm_pick(PLUS_1, Any::rom(T_DICT_OFS+34));  // {1:#f, 1:-1} {1:#f, 1:-1}
        quad_rom[T_DICT_OFS+34]     = Quad::vm_push(PLUS_1, Any::rom(T_DICT_OFS+35));  // {1:#f, 1:-1} {1:#f, 1:-1} 1
        quad_rom[T_DICT_OFS+35]     = Quad::vm_push(TRUE, Any::rom(T_DICT_OFS+36));  // {1:#f, 1:-1} {1:#f, 1:-1} 1 #t
        quad_rom[T_DICT_OFS+36]     = Quad::vm_dict_set(Any::rom(T_DICT_OFS+37));  // {1:#f, 1:-1} {1:#t, 1:-1}
        quad_rom[T_DICT_OFS+37]     = Quad::vm_pick(PLUS_1, Any::rom(T_DICT_OFS+38));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:#t, 1:-1}
        quad_rom[T_DICT_OFS+38]     = Quad::vm_push(PLUS_1, Any::rom(T_DICT_OFS+39));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:#t, 1:-1} 1
        quad_rom[T_DICT_OFS+39]     = Quad::vm_dict_del(Any::rom(T_DICT_OFS+40));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:-1}

        quad_rom[T_DICT_OFS+40]     = Quad::vm_dup(PLUS_1, Any::rom(T_DICT_OFS+41));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:-1} {1:-1}
        quad_rom[T_DICT_OFS+41]     = Quad::vm_push(PLUS_1, Any::rom(T_DICT_OFS+42));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:-1} {1:-1} 1
        quad_rom[T_DICT_OFS+42]     = Quad::vm_dict_get(Any::rom(T_DICT_OFS+43));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:-1} -1
        quad_rom[T_DICT_OFS+43]     = Quad::vm_is_eq(MINUS_1, Any::rom(T_DICT_OFS+44));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:-1}
        quad_rom[T_DICT_OFS+44]     = Quad::vm_end_commit();

        core.rom_top = Any::rom(T_DICT_OFS+45);
        T_DICT_BEH
    }

    fn load_deque_test(core: &mut Core) -> Any {
        // prepare ROM with dictionary operations test
pub const LIB_OFS: usize = ROM_BASE_OFS;
        let quad_rom = &mut core.quad_rom;

pub const T_DEQUE_OFS: usize = LIB_OFS+0;
pub const T_DEQUE_BEH: Any  = Any { raw: T_DEQUE_OFS as Raw };
        quad_rom[T_DEQUE_OFS+0]     = Quad::vm_deque_empty(Any::rom(T_DEQUE_OFS+1));  // #t
        quad_rom[T_DEQUE_OFS+1]     = Quad::vm_is_eq(TRUE, Any::rom(T_DEQUE_OFS+2));  // --
        quad_rom[T_DEQUE_OFS+2]     = Quad::vm_deque_new(Any::rom(T_DEQUE_OFS+3));  // (())
        quad_rom[T_DEQUE_OFS+3]     = Quad::vm_dup(PLUS_1, Any::rom(T_DEQUE_OFS+4));  // (()) (())
        quad_rom[T_DEQUE_OFS+4]     = Quad::vm_deque_empty(Any::rom(T_DEQUE_OFS+5));  // (()) #t
        quad_rom[T_DEQUE_OFS+5]     = Quad::vm_is_eq(TRUE, Any::rom(T_DEQUE_OFS+6));  // (())

        quad_rom[T_DEQUE_OFS+6]     = Quad::vm_push(PLUS_1, Any::rom(T_DEQUE_OFS+7));  // (()) 1
        quad_rom[T_DEQUE_OFS+7]     = Quad::vm_deque_push(Any::rom(T_DEQUE_OFS+8));  // ((1))
        quad_rom[T_DEQUE_OFS+8]     = Quad::vm_push(PLUS_2, Any::rom(T_DEQUE_OFS+9));  // ((1)) 2
        quad_rom[T_DEQUE_OFS+9]     = Quad::vm_deque_push(Any::rom(T_DEQUE_OFS+10));  // ((2 1))
        quad_rom[T_DEQUE_OFS+10]    = Quad::vm_push(PLUS_3, Any::rom(T_DEQUE_OFS+11));  // ((2 1)) 3
        quad_rom[T_DEQUE_OFS+11]    = Quad::vm_deque_push(Any::rom(T_DEQUE_OFS+12));  // ((3 2 1))
        quad_rom[T_DEQUE_OFS+12]    = Quad::vm_pick(PLUS_1, Any::rom(T_DEQUE_OFS+13));  // ((3 2 1)) ((3 2 1))
        quad_rom[T_DEQUE_OFS+13]    = Quad::vm_deque_empty(Any::rom(T_DEQUE_OFS+14));  // ((3 2 1)) #f
        quad_rom[T_DEQUE_OFS+14]    = Quad::vm_is_eq(FALSE, Any::rom(T_DEQUE_OFS+15));  // ((3 2 1))

        quad_rom[T_DEQUE_OFS+15]    = Quad::vm_pick(PLUS_1, Any::rom(T_DEQUE_OFS+16));  // ((3 2 1)) ((3 2 1))
        quad_rom[T_DEQUE_OFS+16]    = Quad::vm_deque_len(Any::rom(T_DEQUE_OFS+17));  // ((3 2 1)) 3
        quad_rom[T_DEQUE_OFS+17]    = Quad::vm_is_eq(PLUS_3, Any::rom(T_DEQUE_OFS+18));  // ((3 2 1))

        quad_rom[T_DEQUE_OFS+18]    = Quad::vm_deque_pull(Any::rom(T_DEQUE_OFS+19));  // (() 2 3) 1
        quad_rom[T_DEQUE_OFS+19]    = Quad::vm_is_eq(PLUS_1, Any::rom(T_DEQUE_OFS+20));  // (() 2 3)
        quad_rom[T_DEQUE_OFS+20]    = Quad::vm_deque_pull(Any::rom(T_DEQUE_OFS+21));  // (() 3) 2
        quad_rom[T_DEQUE_OFS+21]    = Quad::vm_is_eq(PLUS_2, Any::rom(T_DEQUE_OFS+22));  // (() 3) 2
        quad_rom[T_DEQUE_OFS+22]    = Quad::vm_deque_pull(Any::rom(T_DEQUE_OFS+23));  // (()) 3
        quad_rom[T_DEQUE_OFS+23]    = Quad::vm_is_eq(PLUS_3, Any::rom(T_DEQUE_OFS+24));  // (())
        quad_rom[T_DEQUE_OFS+24]    = Quad::vm_deque_pull(Any::rom(T_DEQUE_OFS+25));  // (()) #?
        quad_rom[T_DEQUE_OFS+25]    = Quad::vm_is_eq(UNDEF, Any::rom(T_DEQUE_OFS+26));  // (())

        quad_rom[T_DEQUE_OFS+26]    = Quad::vm_dup(PLUS_1, Any::rom(T_DEQUE_OFS+27));  // (()) (())
        quad_rom[T_DEQUE_OFS+27]    = Quad::vm_deque_len(Any::rom(T_DEQUE_OFS+28));  // (()) 0
        quad_rom[T_DEQUE_OFS+28]    = Quad::vm_is_eq(ZERO, Any::rom(T_DEQUE_OFS+29));  // (())

        quad_rom[T_DEQUE_OFS+29]    = Quad::vm_dup(PLUS_1, Any::rom(T_DEQUE_OFS+30));  // (()) (())
        quad_rom[T_DEQUE_OFS+30]    = Quad::vm_msg(ZERO, Any::rom(T_DEQUE_OFS+31));  // (()) (()) (@4 #unit)
        quad_rom[T_DEQUE_OFS+31]    = Quad::vm_deque_put(Any::rom(T_DEQUE_OFS+32));  // (()) (() (@4 #unit))
        quad_rom[T_DEQUE_OFS+32]    = Quad::vm_msg(MINUS_1, Any::rom(T_DEQUE_OFS+33));  // (()) (() (@4 #unit)) (#unit)
        quad_rom[T_DEQUE_OFS+33]    = Quad::vm_deque_put(Any::rom(T_DEQUE_OFS+34));  // (()) (() (#unit) (@4 #unit))
        quad_rom[T_DEQUE_OFS+34]    = Quad::vm_msg(MINUS_2, Any::rom(T_DEQUE_OFS+35));  // (()) (() (#unit) (@4 #unit)) ()
        quad_rom[T_DEQUE_OFS+35]    = Quad::vm_deque_put(Any::rom(T_DEQUE_OFS+36));  // (()) (() () (#unit) (@4 #unit))
        quad_rom[T_DEQUE_OFS+36]    = Quad::vm_deque_pop(Any::rom(T_DEQUE_OFS+37));  // (()) (((#unit) ())) (@4 #unit)
        quad_rom[T_DEQUE_OFS+37]    = Quad::vm_roll(MINUS_2, Any::rom(T_DEQUE_OFS+38));  // (()) (@4 #unit) (((#unit) ()))
        quad_rom[T_DEQUE_OFS+38]    = Quad::vm_deque_pop(Any::rom(T_DEQUE_OFS+39));  // (()) (@4 #unit) ((())) (#unit)
        quad_rom[T_DEQUE_OFS+39]    = Quad::vm_roll(MINUS_3, Any::rom(T_DEQUE_OFS+40));  // (()) (#unit) (@4 #unit) ((()))
        quad_rom[T_DEQUE_OFS+40]    = Quad::vm_deque_pop(Any::rom(T_DEQUE_OFS+41));  // (()) (#unit) (@4 #unit) (()) ()
        quad_rom[T_DEQUE_OFS+41]    = Quad::vm_is_eq(NIL, Any::rom(T_DEQUE_OFS+42));  // (()) (#unit) (@4 #unit) (())

        quad_rom[T_DEQUE_OFS+42]    = Quad::vm_push(PLUS_1, Any::rom(T_DEQUE_OFS+43));  // (()) (#unit) (@4 #unit) (()) 1
        quad_rom[T_DEQUE_OFS+43]    = Quad::vm_deque_put(Any::rom(T_DEQUE_OFS+44));  // (()) (#unit) (@4 #unit) (() 1)
        quad_rom[T_DEQUE_OFS+44]    = Quad::vm_push(PLUS_2, Any::rom(T_DEQUE_OFS+45));  // (()) (#unit) (@4 #unit) (() 1) 2
        quad_rom[T_DEQUE_OFS+45]    = Quad::vm_deque_put(Any::rom(T_DEQUE_OFS+46));  // (()) (#unit) (@4 #unit) (() 2 1)
        quad_rom[T_DEQUE_OFS+46]    = Quad::vm_dup(PLUS_1, Any::rom(T_DEQUE_OFS+47));  // (()) (#unit) (@4 #unit) (() 2 1) (() 2 1)
        quad_rom[T_DEQUE_OFS+47]    = Quad::vm_deque_empty(Any::rom(T_DEQUE_OFS+48));  // (()) (#unit) (@4 #unit) (() 2 1) #f
        quad_rom[T_DEQUE_OFS+48]    = Quad::vm_is_eq(FALSE, Any::rom(T_DEQUE_OFS+49));  // (()) (#unit) (@4 #unit) (() 2 1)

        quad_rom[T_DEQUE_OFS+49]    = Quad::vm_deque_pop(Any::rom(T_DEQUE_OFS+50));  // (()) (#unit) (@4 #unit) ((2)) 1
        quad_rom[T_DEQUE_OFS+50]    = Quad::vm_is_eq(PLUS_1, Any::rom(T_DEQUE_OFS+51));  // (()) (#unit) (@4 #unit) ((2))
        quad_rom[T_DEQUE_OFS+51]    = Quad::vm_push(PLUS_3, Any::rom(T_DEQUE_OFS+52));  // (()) (#unit) (@4 #unit) ((2)) 3
        quad_rom[T_DEQUE_OFS+52]    = Quad::vm_deque_put(Any::rom(T_DEQUE_OFS+53));  // (()) (#unit) (@4 #unit) ((2) 3)
        quad_rom[T_DEQUE_OFS+53]    = Quad::vm_dup(PLUS_1, Any::rom(T_DEQUE_OFS+54));  // (()) (#unit) (@4 #unit) ((2) 3) ((2) 3)
        quad_rom[T_DEQUE_OFS+54]    = Quad::vm_deque_len(Any::rom(T_DEQUE_OFS+55));  // (()) (#unit) (@4 #unit) ((2) 3) 2
        quad_rom[T_DEQUE_OFS+55]    = Quad::vm_is_eq(PLUS_2, Any::rom(T_DEQUE_OFS+56));  // (()) (#unit) (@4 #unit) ((2) 3)

        quad_rom[T_DEQUE_OFS+56]    = Quad::vm_deque_pop(Any::rom(T_DEQUE_OFS+57));  // (()) (#unit) (@4 #unit) (() 3) 2
        quad_rom[T_DEQUE_OFS+57]    = Quad::vm_is_eq(PLUS_2, Any::rom(T_DEQUE_OFS+58));  // (()) (#unit) (@4 #unit) (() 3)
        quad_rom[T_DEQUE_OFS+58]    = Quad::vm_deque_pop(Any::rom(T_DEQUE_OFS+59));  // (()) (#unit) (@4 #unit) (()) 3
        quad_rom[T_DEQUE_OFS+59]    = Quad::vm_is_eq(PLUS_3, Any::rom(T_DEQUE_OFS+60));  // (()) (#unit) (@4 #unit) (())
        quad_rom[T_DEQUE_OFS+60]    = Quad::vm_deque_pop(Any::rom(T_DEQUE_OFS+61));  // (()) (#unit) (@4 #unit) (()) #?
        quad_rom[T_DEQUE_OFS+61]    = Quad::vm_is_eq(UNDEF, Any::rom(T_DEQUE_OFS+62));  // (()) (#unit) (@4 #unit) (())
        quad_rom[T_DEQUE_OFS+62]    = Quad::vm_dup(PLUS_1, Any::rom(T_DEQUE_OFS+63));  // (()) (#unit) (@4 #unit) (()) (())
        quad_rom[T_DEQUE_OFS+63]    = Quad::vm_deque_len(Any::rom(T_DEQUE_OFS+64));  // (()) (#unit) (@4 #unit) (()) 0
        quad_rom[T_DEQUE_OFS+64]    = Quad::vm_is_eq(ZERO, Any::rom(T_DEQUE_OFS+65));  // (()) (#unit) (@4 #unit) (())
        quad_rom[T_DEQUE_OFS+65]    = Quad::vm_end_commit();

        core.rom_top = Any::rom(T_DEQUE_OFS+66);
        T_DEQUE_BEH
    }

    fn load_device_test(core: &mut Core) -> Any {
        // prepare ROM with device operations test
pub const LIB_OFS: usize = ROM_BASE_OFS;
        let quad_rom = &mut core.quad_rom;

pub const COMMIT: Any = Any { raw: (LIB_OFS+0) as Raw };
        quad_rom[COMMIT.ofs()]      = Quad::vm_end_commit();
pub const SEND_MSG: Any = Any { raw: (LIB_OFS+1) as Raw };
        quad_rom[SEND_MSG.ofs()]    = Quad::vm_send(MINUS_1, COMMIT);
pub const CUST_SEND: Any = Any { raw: (LIB_OFS+2) as Raw };
        quad_rom[CUST_SEND.ofs()]   = Quad::vm_msg(PLUS_1, SEND_MSG);

pub const T_DEV_OFS: usize = LIB_OFS+3;
pub const T_DEV_BEH: Any = Any { raw: T_DEV_OFS as Raw };
        quad_rom[T_DEV_OFS+0]       = Quad::vm_push(PLUS_7, Any::rom(T_DEV_OFS+1));  // 7
        quad_rom[T_DEV_OFS+1]       = Quad::vm_push(COUNT_TO, Any::rom(T_DEV_OFS+2));  // 7 count_to
        quad_rom[T_DEV_OFS+2]       = Quad::vm_beh(PLUS_1, Any::rom(T_DEV_OFS+3));  // --
        quad_rom[T_DEV_OFS+3]       = Quad::vm_push(PLUS_3, Any::rom(T_DEV_OFS+4));  // 3
        quad_rom[T_DEV_OFS+4]       = Quad::vm_my(MY_SELF, Any::rom(T_DEV_OFS+5));  // 3 SELF
        quad_rom[T_DEV_OFS+5]       = Quad::vm_send(PLUS_1, Any::rom(T_DEV_OFS+6));  // --

        quad_rom[T_DEV_OFS+6]       = Quad::vm_push(Any::fix(13), Any::rom(T_DEV_OFS+7));  // 13
        quad_rom[T_DEV_OFS+7]       = Quad::vm_push(DEBUG_DEV, Any::rom(T_DEV_OFS+8));  // 13 DEBUG_DEV
        quad_rom[T_DEV_OFS+8]       = Quad::vm_push(BLOB_DEV, Any::rom(T_DEV_OFS+9));  // 13 DEBUG_DEV BLOB_DEV
        quad_rom[T_DEV_OFS+9]       = Quad::vm_send(PLUS_2, COMMIT);  // --

pub const COUNT_TO: Any = Any { raw: (T_DEV_OFS+10) as Raw };
        // (m) <- (n)
        quad_rom[T_DEV_OFS+10]      = Quad::vm_msg(PLUS_1, Any::rom(T_DEV_OFS+11));  // n
        quad_rom[T_DEV_OFS+11]      = Quad::vm_state(PLUS_1, Any::rom(T_DEV_OFS+12));  // n m
        quad_rom[T_DEV_OFS+12]      = Quad::vm_cmp_lt(Any::rom(T_DEV_OFS+13));  // n<m
        quad_rom[T_DEV_OFS+13]      = Quad::vm_if(Any::rom(T_DEV_OFS+14), COMMIT);  // --

        quad_rom[T_DEV_OFS+14]      = Quad::vm_msg(PLUS_1, Any::rom(T_DEV_OFS+15));  // n
        quad_rom[T_DEV_OFS+15]      = Quad::vm_push(PLUS_1, Any::rom(T_DEV_OFS+16));  // n 1
        quad_rom[T_DEV_OFS+16]      = Quad::vm_alu_add(Any::rom(T_DEV_OFS+17));  // n+1
        quad_rom[T_DEV_OFS+17]      = Quad::vm_my(MY_SELF, Any::rom(T_DEV_OFS+18));  // n+1 SELF
        quad_rom[T_DEV_OFS+18]      = Quad::vm_send(PLUS_1, Any::rom(T_DEV_OFS+19));  // --
        quad_rom[T_DEV_OFS+19]      = Quad::vm_dup(ZERO, COMMIT);  // --

        core.rom_top = Any::rom(T_DEV_OFS+20);
        T_DEV_BEH
    }

    #[test]
    fn base_types_are_32_bits() {
        assert_eq!(4, ::core::mem::size_of::<Error>());
        assert_eq!(4, ::core::mem::size_of::<Raw>());
        assert_eq!(4, ::core::mem::size_of::<Num>());
        assert_eq!(4, ::core::mem::size_of::<Any>());
        assert_eq!(16, ::core::mem::size_of::<Quad>());
    }

    #[test]
    fn core_initialization() {
        let core = Core::new();
        assert_eq!(ZERO, core.ram_free());
        assert_eq!(NIL, core.ram_next());
        assert_eq!(NIL, core.e_first());
        assert_eq!(NIL, core.k_first());
        assert_eq!(UNDEF, core.kp());
    }

    #[test]
    fn basic_memory_allocation() {
        let mut core = Core::new();
        let top_before = core.ram_top().ofs();
        let m1 = core.reserve(&Quad::pair_t(PLUS_1, PLUS_1)).unwrap();
        assert!(m1.is_ptr());
        let m2 = core.reserve(&Quad::pair_t(PLUS_2, PLUS_2)).unwrap();
        let m3 = core.reserve(&Quad::pair_t(PLUS_3, PLUS_3)).unwrap();
        core.release(m2);
        core.release(m3);
        let _m4 = core.reserve(&Quad::pair_t(PLUS_4, PLUS_4)).unwrap();
        let top_after = core.ram_top().ofs();
        assert_eq!(3, top_after - top_before);
        assert_eq!(PLUS_1, core.ram_free());
    }

    #[test]
    fn run_loop_terminates() {
        let mut core = Core::new();
        let boot_beh = load_std(&mut core);
        let boot_ptr = core.reserve(&Quad::new_actor(boot_beh, NIL)).unwrap();
        let a_boot = core.ptr_to_cap(boot_ptr);
        core.event_inject(SPONSOR, a_boot, UNDEF).unwrap();
        let err = core.run_loop(0);
        if err < 0 { assert_eq!(E_OK, err); }  // positive values are number of steps executed
    }

    #[test]
    fn gc_before_and_after_run() {
        let mut core = Core::new();
        let boot_beh = load_fib_test(&mut core);
        let boot_ptr = core.reserve(&Quad::new_actor(boot_beh, NIL)).unwrap();
        let a_boot = core.ptr_to_cap(boot_ptr);
        core.event_inject(SPONSOR, a_boot, UNDEF).unwrap();
        core.gc_collect();
        let err = core.run_loop(1024);
        if err < 0 { assert_eq!(E_OK, err); }  // positive values are number of steps executed
        core.gc_collect();
    }

    #[test]
    fn dict_operations() {
        let mut core = Core::new();
        let boot_beh = load_dict_test(&mut core);
        let boot_ptr = core.reserve(&Quad::new_actor(boot_beh, NIL)).unwrap();
        let a_boot = core.ptr_to_cap(boot_ptr);
        core.event_inject(SPONSOR, a_boot, UNDEF).unwrap();
        let err = core.run_loop(1024);
        if err < 0 { assert_eq!(E_OK, err); }  // positive values are number of steps executed
    }

    #[test]
    fn deque_operations() {
        let mut core = Core::new();
        let boot_beh = load_deque_test(&mut core);
        let boot_ptr = core.reserve(&Quad::new_actor(boot_beh, NIL)).unwrap();
        let a_boot = core.ptr_to_cap(boot_ptr);
        let msg = core.reserve(&Quad::pair_t(UNIT, NIL)).unwrap();
        let msg = core.reserve(&Quad::pair_t(a_boot, msg)).unwrap();
        core.event_inject(SPONSOR, a_boot, msg).unwrap();
        let err = core.run_loop(1024);
        if err < 0 { assert_eq!(E_OK, err); }  // positive values are number of steps executed
    }

    #[test]
    fn device_operations() {
        let mut core = Core::new();
        let boot_beh = load_device_test(&mut core);
        let boot_ptr = core.reserve(&Quad::new_actor(boot_beh, NIL)).unwrap();
        let a_boot = core.ptr_to_cap(boot_ptr);
        core.event_inject(SPONSOR, a_boot, NIL).unwrap();
        let err = core.run_loop(1024);
        if err < 0 { assert_eq!(E_OK, err); }  // positive values are number of steps executed
    }

    #[test]
    fn gc_queue_management() {
        let mut core = Core::new();
        assert_eq!(NIL, core.gc_queue[GC_FIRST]);
        assert_eq!(NIL, core.gc_queue[GC_LAST]);
        let mut item;
        let a = Any::ram(23);
        let b = Any::ram(45);
        let c = Any::ram(67);
        let d = Any::ram(89);
        core.gc_enqueue(a);
        core.gc_remove(a);
        core.gc_enqueue(a);
        core.gc_enqueue(b);
        core.gc_remove(b);
        core.gc_enqueue(c);
        core.gc_enqueue(d);
        core.gc_remove(b);
        item = core.gc_dequeue();
        assert_eq!(Some(a), item);
        //item = core.gc_dequeue();
        //assert_eq!(Some(b), item);
        item = core.gc_dequeue();
        assert_eq!(Some(c), item);
        item = core.gc_dequeue();
        assert_eq!(Some(d), item);
        item = core.gc_dequeue();
        assert_eq!(None, item);
    }

}
