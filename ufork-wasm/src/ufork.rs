// uFork virtual CPU

use core::fmt;

pub type Raw = u32;  // univeral value type
pub type Num = i32;  // fixnum integer type

// type-tag bits
const MSK_RAW: Raw          = 0xF000_0000;  // mask for type-tag bits
const DIR_RAW: Raw          = 0x8000_0000;  // 1=direct (fixnum), 0=indirect (pointer)
const OPQ_RAW: Raw          = 0x4000_0000;  // 1=opaque (capability), 0=transparent (navigable)
const MUT_RAW: Raw          = 0x2000_0000;  // 1=read-write (mutable), 0=read-only (immutable)
//const BNK_RAW: Raw          = 0x1000_0000;  // 1=bank_1, 0=bank_0 (half-space GC phase)

// type-tagged value
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Any { raw: Raw }
impl Any {
    pub fn new(raw: Raw) -> Any {
        Any { raw }
    }
    pub fn fix(num: isize) -> Any {
        Any::new(DIR_RAW | (num as Raw))
    }
    pub fn cap(ofs: usize) -> Any {
        Any::new(OPQ_RAW | ((ofs as Raw) & !MSK_RAW))
    }
    pub fn rom(ofs: usize) -> Any {
        Any::new((ofs as Raw) & !MSK_RAW)
    }
    pub fn ram(ofs: usize) -> Any {
        Any::new(MUT_RAW | ((ofs as Raw) & !MSK_RAW))
    }
    pub fn raw(&self) -> Raw {
        self.raw
    }
    pub fn addr(&self) -> usize {
        if self.is_fix() {
            panic!("fixnum has no addr");
        }
        let ofs = self.raw & !MSK_RAW;
        ofs as usize
    }
    pub fn is_fix(&self) -> bool {
        (self.raw & DIR_RAW) != 0
    }
    pub fn is_cap(&self) -> bool {
        (self.raw & MSK_RAW) == OPQ_RAW
    }
    pub fn is_ptr(&self) -> bool {
        (self.raw & (DIR_RAW | OPQ_RAW)) == 0
    }
    pub fn is_rom(&self) -> bool {
        (self.raw & MSK_RAW) == 0
    }
    pub fn is_ram(&self) -> bool {
        (self.raw & (DIR_RAW | OPQ_RAW | MUT_RAW)) == MUT_RAW
    }
    pub fn fix_num(&self) -> Option<isize> {
        if self.is_fix() {
            let num = ((self.raw << 1) as Num) >> 1;
            Some(num as isize)
        } else {
            None
        }
    }
    pub fn cap_ofs(&self) -> Option<usize> {
        if self.is_cap() {
            let ofs = self.raw & !MSK_RAW;
            Some(ofs as usize)
        } else {
            None
        }
    }
    pub fn ptr_ofs(&self) -> Option<usize> {
        if self.is_ptr() {
            let ofs = self.raw & !MSK_RAW;
            Some(ofs as usize)
        } else {
            None
        }
    }
    pub fn val(self) -> Val {  // NOTE: consumes `self`
        Val::new(self.raw)
    }
}
impl fmt::Display for Any {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.is_fix() {
            write!(fmt, "{:+}", self.fix_num().unwrap())
        } else if self.is_cap() {
            write!(fmt, "@{}", self.cap_ofs().unwrap())
        } else if self.is_rom() {
            write!(fmt, "*{}", self.ptr_ofs().unwrap())
        } else if self.is_ram() {
            write!(fmt, "^{}", self.ptr_ofs().unwrap())
        } else {
            write!(fmt, "${:08x}", self.raw)
        }
    }
}

// instr values
pub const VM_TYPEQ: Val     = Val { raw: DIR_RAW | 0 }; // fixnum(0)
pub const VM_CELL: Val      = Val { raw: DIR_RAW | 1 };
pub const VM_GET: Val       = Val { raw: DIR_RAW | 2 };
//pub const VM_SET: Val       = Val { raw: DIR_RAW | 3 };
pub const VM_DICT: Val      = Val { raw: DIR_RAW | 3 };
pub const VM_PAIR: Val      = Val { raw: DIR_RAW | 4 };
pub const VM_PART: Val      = Val { raw: DIR_RAW | 5 };
pub const VM_NTH: Val       = Val { raw: DIR_RAW | 6 };
pub const VM_PUSH: Val      = Val { raw: DIR_RAW | 7 };
pub const VM_DEPTH: Val     = Val { raw: DIR_RAW | 8 };
pub const VM_DROP: Val      = Val { raw: DIR_RAW | 9 };
pub const VM_PICK: Val      = Val { raw: DIR_RAW | 10 };
pub const VM_DUP: Val       = Val { raw: DIR_RAW | 11 };
pub const VM_ROLL: Val      = Val { raw: DIR_RAW | 12 };
pub const VM_ALU: Val       = Val { raw: DIR_RAW | 13 };
pub const VM_EQ: Val        = Val { raw: DIR_RAW | 14 };
pub const VM_CMP: Val       = Val { raw: DIR_RAW | 15 };
pub const VM_IF: Val        = Val { raw: DIR_RAW | 16 };
pub const VM_MSG: Val       = Val { raw: DIR_RAW | 17 };
pub const VM_MY: Val        = Val { raw: DIR_RAW | 18 };
pub const VM_SEND: Val      = Val { raw: DIR_RAW | 19 };
pub const VM_NEW: Val       = Val { raw: DIR_RAW | 20 };
pub const VM_BEH: Val       = Val { raw: DIR_RAW | 21 };
pub const VM_END: Val       = Val { raw: DIR_RAW | 22 };
//pub const VM_CVT: Val       = Val { raw: DIR_RAW | 23 };
//pub const VM_PUTC: Val      = Val { raw: DIR_RAW | 24 };
//pub const VM_GETC: Val      = Val { raw: DIR_RAW | 25 };
//pub const VM_DEBUG: Val     = Val { raw: DIR_RAW | 26 };
pub const VM_DEQUE: Val     = Val { raw: DIR_RAW | 27 };
pub const VM_IS_EQ: Val     = Val { raw: DIR_RAW | 30 };
pub const VM_IS_NE: Val     = Val { raw: DIR_RAW | 31 };

// VM_DICT dictionary operations
pub const DICT_HAS: Val     = Val { raw: DIR_RAW | 0 };
pub const DICT_GET: Val     = Val { raw: DIR_RAW | 1 };
pub const DICT_ADD: Val     = Val { raw: DIR_RAW | 2 };
pub const DICT_SET: Val     = Val { raw: DIR_RAW | 3 };
pub const DICT_DEL: Val     = Val { raw: DIR_RAW | 4 };

// VM_DEQUE deque operations
pub const DEQUE_NEW: Val    = Val { raw: DIR_RAW | 0 };
pub const DEQUE_EMPTY: Val  = Val { raw: DIR_RAW | 1 };
pub const DEQUE_PUSH: Val   = Val { raw: DIR_RAW | 2 };
pub const DEQUE_POP: Val    = Val { raw: DIR_RAW | 3 };
pub const DEQUE_PUT: Val    = Val { raw: DIR_RAW | 4 };
pub const DEQUE_PULL: Val   = Val { raw: DIR_RAW | 5 };
pub const DEQUE_LEN: Val    = Val { raw: DIR_RAW | 6 };

// VM_ALU arithmetic/logical operations
pub const ALU_NOT: Val      = Val { raw: DIR_RAW | 0 };
pub const ALU_AND: Val      = Val { raw: DIR_RAW | 1 };
pub const ALU_OR: Val       = Val { raw: DIR_RAW | 2 };
pub const ALU_XOR: Val      = Val { raw: DIR_RAW | 3 };
pub const ALU_ADD: Val      = Val { raw: DIR_RAW | 4 };
pub const ALU_SUB: Val      = Val { raw: DIR_RAW | 5 };
pub const ALU_MUL: Val      = Val { raw: DIR_RAW | 6 };

// VM_CMP comparison operations
pub const CMP_EQ: Val       = Val { raw: DIR_RAW | 0 };
pub const CMP_GE: Val       = Val { raw: DIR_RAW | 1 };
pub const CMP_GT: Val       = Val { raw: DIR_RAW | 2 };
pub const CMP_LT: Val       = Val { raw: DIR_RAW | 3 };
pub const CMP_LE: Val       = Val { raw: DIR_RAW | 4 };
pub const CMP_NE: Val       = Val { raw: DIR_RAW | 5 };

// VM_MY actor operations
pub const MY_SELF: Val      = Val { raw: DIR_RAW | 0 };
pub const MY_BEH: Val       = Val { raw: DIR_RAW | 1 };
pub const MY_STATE: Val     = Val { raw: DIR_RAW | 2 };

// VM_END thread actions
pub const END_ABORT: Val    = Val { raw: DIR_RAW | -1 as Num as Raw };
pub const END_STOP: Val     = Val { raw: DIR_RAW | 0 };
pub const END_COMMIT: Val   = Val { raw: DIR_RAW | 1 };
pub const END_RELEASE: Val  = Val { raw: DIR_RAW | 2 };

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
// quad-cell (minimum addressable unit)
pub struct Quad { t: Any, x: Any, y: Any, z: Any }
impl Quad {
    pub fn new(t: Any, x: Any, y: Any, z: Any) -> Quad {
        Quad { t, x, y, z }
    }
    pub fn t(&self) -> Any { self.t }
    pub fn x(&self) -> Any { self.x }
    pub fn y(&self) -> Any { self.y }
    pub fn z(&self) -> Any { self.z }
    pub fn set_t(&mut self, v: Any) { self.t = v; }
    pub fn set_x(&mut self, v: Any) { self.x = v; }
    pub fn set_y(&mut self, v: Any) { self.y = v; }
    pub fn set_z(&mut self, v: Any) { self.z = v; }

    // construct basic Quad types
    pub fn empty_t() -> Quad {
        Self::new(UNDEF.any(), UNDEF.any(), UNDEF.any(), UNDEF.any())
    }
    pub fn literal_t() -> Quad {
        Self::new(LITERAL_T.any(), UNDEF.any(), UNDEF.any(), UNDEF.any())
    }
    pub fn type_t() -> Quad {
        Self::new(TYPE_T.any(), UNDEF.any(), UNDEF.any(), UNDEF.any())
    }
    pub fn event_t(target: Any, msg: Any, next: Any) -> Quad {
        assert!(target.is_cap());
        assert!(next.is_ptr());
        Self::new(EVENT_T.any(), target, msg, next)
    }
    pub fn cont_t(ip: Any, sp: Any, ep: Any, next: Any) -> Quad {
        assert!(ip.is_ptr());
        assert!(sp.is_ptr());
        assert!(ep.is_ptr());
        assert!(next.is_ptr());
        Self::new(ip, sp, ep, next)
    }
    pub fn instr_t(vm: Any, v: Any, k: Any) -> Quad {
        assert!(vm.is_fix());
        assert!(k.is_ptr());
        Self::new(INSTR_T.any(), vm, v, k)
    }
    pub fn actor_t(beh: Any, state: Any, events: Any) -> Quad {
        assert!(beh.is_ptr());
        assert!(events.is_ptr());
        Self::new(ACTOR_T.any(), beh, state, events)
    }
    pub fn symbol_t(hash: Any, key: Any, value: Any) -> Quad {
        assert!(hash.is_fix());
        assert!(key.is_ptr());
        Self::new(SYMBOL_T.any(), hash, key, value)
    }
    pub fn pair_t(car: Any, cdr: Any) -> Quad {
        Self::new(PAIR_T.any(), car, cdr, UNDEF.any())
    }
    pub fn dict_t(key: Any, value: Any, next: Any) -> Quad {
        assert!(next.is_ptr());
        Self::new(DICT_T.any(), key, value, next)
    }
    pub fn free_t(next: Any) -> Quad {
        Self::new(FREE_T.any(), UNDEF.any(), UNDEF.any(), next)
    }
    pub fn ddeque_t(e_first: Any, e_last: Any, k_first: Any, k_last: Any) -> Quad {
        assert!(e_first.is_ptr());
        assert!(e_last.is_ptr());
        assert!(k_first.is_ptr());
        assert!(k_last.is_ptr());
        Self::new(e_first, e_last, k_first, k_last)
    }
    pub fn memory_t(top: Any, next: Any, free: Any, root: Any) -> Quad {
        assert!(top.is_ptr());
        assert!(next.is_ptr());
        assert!(free.is_fix());
        assert!(root.is_ptr());
        Self::new(top, next, free, root)
    }
    pub fn untyped_t(t: Any, x: Any, y: Any, z: Any) -> Quad {  // pass-thru for Quad::new()
        Self::new(t, x, y, z)
    }

    // construct VM instructions types
    pub fn vm_typeq(t: Any, k: Any) -> Quad {
        assert!(t.is_ptr());
        assert!(k.is_ptr());
        Self::instr_t(VM_TYPEQ.any(), t, k)
    }
    pub fn vm_cmp(op: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_CMP.any(), op, k)
    }
    pub fn vm_if(t: Any, f: Any) -> Quad {
        assert!(t.is_ptr());
        assert!(f.is_ptr());
        Self::instr_t(VM_IF.any(), t, f)
    }
    pub fn vm_end(op: Any) -> Quad {
        assert!(op.is_fix());
        Self::instr_t(VM_END.any(), op, UNDEF.any())
    }

    // construct VM_CMP instructions
    pub fn vm_cmp_eq(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_EQ.any(), k)
    }

    // construct VM_END instructions
    pub fn vm_end_commit() -> Quad {
        Self::vm_end(END_COMMIT.any())
    }

    // construct idle Actor
    pub fn new_actor(beh: Any, state: Any) -> Quad {
        Self::actor_t(beh, state, UNDEF.any())
    }

    // inter-op with Val type-hierarchy
    pub fn init(t: Val, x: Val, y: Val, z: Val) -> Quad {
        Quad {
            t: t.any(),
            x: x.any(),
            y: y.any(),
            z: z.any(),
        }
    }
    pub fn get_t(&self) -> Val { self.t.val() }
    pub fn get_x(&self) -> Val { self.x.val() }
    pub fn get_y(&self) -> Val { self.y.val() }
    pub fn get_z(&self) -> Val { self.z.val() }
    pub fn typed(&self) -> Typed {
        Typed::from(self).unwrap()
    }
}
impl fmt::Display for Quad {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(fmt, "{{t:{}, x:{}, y:{}, z:{}}}", self.t, self.x, self.y, self.z)
    }
}

// literal values
pub const ZERO: Any         = Any { raw: DIR_RAW | 0 };
/*
pub const UNDEF: Any        = Any { raw: 0 };
pub const NIL: Any          = Any { raw: 1 };
pub const FALSE: Any        = Any { raw: 2 };
pub const TRUE: Any         = Any { raw: 3 };
pub const UNIT: Any         = Any { raw: 4 };

pub const LITERAL: Any      = Any { raw: 0 };  // == UNDEF
pub const TYPE: Any         = Any { raw: 5 };
pub const EVENT: Any        = Any { raw: 6 };
pub const INSTR: Any        = Any { raw: 7 };
pub const ACTOR: Any        = Any { raw: 8 };
pub const FIXNUM: Any       = Any { raw: 9 };
pub const SYMBOL: Any       = Any { raw: 10 };
pub const PAIR: Any         = Any { raw: 11 };
//pub const FEXPR: Any        = Any { raw: 12 };
pub const DICT: Any         = Any { raw: 12 };
pub const FREE: Any         = Any { raw: 13 };
*/

pub const MEMORY: Any       = Any { raw: MUT_RAW | 14 };
pub const DDEQUE: Any       = Any { raw: MUT_RAW | 15 };
/*
pub const START: Any        = Any { raw: 16 };
*/

// literal values {Val, Fix, Ptr, Cap} -- DEPRECATED
/*
pub const ZERO: Fix         = Fix { num: 0 };
*/
pub const UNDEF: Val        = Val { raw: 0 }; //Val::new(0); -- const generic issue...
pub const NIL: Val          = Val { raw: 1 };
pub const FALSE: Val        = Val { raw: 2 };
pub const TRUE: Val         = Val { raw: 3 };
pub const UNIT: Val         = Val { raw: 4 };

pub const LITERAL_T: Val    = Val { raw: 0 }; //ptrval(0);
pub const TYPE_T: Val       = Val { raw: 5 };
pub const EVENT_T: Val      = Val { raw: 6 };
pub const INSTR_T: Val      = Val { raw: 7 };
pub const ACTOR_T: Val      = Val { raw: 8 };
pub const FIXNUM_T: Val     = Val { raw: 9 };
pub const SYMBOL_T: Val     = Val { raw: 10 };
pub const PAIR_T: Val       = Val { raw: 11 };
//pub const FEXPR_T: Val      = Val { raw: 12 };
pub const DICT_T: Val       = Val { raw: 12 };
pub const FREE_T: Val       = Val { raw: 13 };

/*
pub const MEMORY: Val       = Val { raw: 14 };
pub const DDEQUE: Val       = Val { raw: 15 };
*/
pub const START: Val        = Val { raw: 16 };

pub const COMMIT: Ptr       = Ptr { raw: 16 };
pub const SEND_0: Ptr       = Ptr { raw: 17 };
pub const CUST_SEND: Ptr    = Ptr { raw: 18 };
pub const RV_SELF: Ptr      = Ptr { raw: 19 };
pub const RV_UNDEF: Ptr     = Ptr { raw: 20 };
pub const RV_NIL: Ptr       = Ptr { raw: 21 };
pub const RV_FALSE: Ptr     = Ptr { raw: 22 };
pub const RV_TRUE: Ptr      = Ptr { raw: 23 };
pub const RV_UNIT: Ptr      = Ptr { raw: 24 };
pub const RV_ZERO: Ptr      = Ptr { raw: 25 };
pub const RV_ONE: Ptr       = Ptr { raw: 26 };
pub const RESEND: Ptr       = Ptr { raw: 28 };
pub const RELEASE: Ptr      = Ptr { raw: 29 };
pub const RELEASE_0: Ptr    = Ptr { raw: 30 };
pub const MEMO_BEH: Ptr     = Ptr { raw: 31 };
pub const A_SINK: Cap       = Cap { raw: 32 };
pub const FWD_BEH: Ptr      = Ptr { raw: 33 };
pub const ONCE_BEH: Ptr     = Ptr { raw: 35 };
pub const LABEL_BEH: Ptr    = Ptr { raw: 37 };
pub const TAG_BEH: Ptr      = Ptr { raw: 41 };
pub const ONCE_TAG_BEH: Ptr = Ptr { raw: 42 };
pub const WRAP_BEH: Ptr     = Ptr { raw: 44 };
pub const UNWRAP_BEH: Ptr   = Ptr { raw: 47 };
pub const FUTURE_BEH: Ptr   = Ptr { raw: 49 };
pub const VALUE_BEH: Ptr    = Ptr { raw: 66 };
pub const SERIAL_BEH: Ptr   = Ptr { raw: 72 };
pub const DQ_GC_ROOT: Ptr   = Ptr { raw: 84 };
pub const DQ_EMPTY: Ptr     = Ptr { raw: 85 };
pub const ABORT: Ptr        = Ptr { raw: 86 };
pub const STOP: Ptr         = Ptr { raw: 88 };
pub const WAIT_BEH: Ptr     = Ptr { raw: 90 };
pub const BUSY_BEH: Ptr     = Ptr { raw: 113 };
//pub const E_BOOT: Ptr       = Ptr { raw: 190 };

// core memory limit
const QUAD_MAX: usize = 1<<10;  // 1K quad-cells
//const QUAD_MAX: usize = 1<<12;  // 4K quad-cells

pub struct Core {
    quad_rom: [Quad; QUAD_MAX],
    quad_ram: [Quad; QUAD_MAX],
    quad_mem: [Typed; QUAD_MAX],
}

impl Core {
    pub fn new() -> Core {
        let mut quad_ram = [
            Quad::empty_t();
            QUAD_MAX
        ];
        quad_ram[MEMORY.addr()]     = Quad::memory_t(Any::ram(256), NIL.any(), Any::fix(0), DQ_GC_ROOT.any());
        quad_ram[DDEQUE.addr()]     = Quad::ddeque_t(E_BOOT, E_BOOT, NIL.any(), NIL.any());
        quad_ram[A_SINK.addr()]     = Quad::actor_t(COMMIT.any(), NIL.any(), UNDEF.any());
        quad_ram[89]                = Quad::new_actor(STOP.any(), NIL.any());
        /* bootstrap event/actor */
        quad_ram[100]               = Quad::new_actor(Any::rom(101), NIL.any());
        quad_ram[F_FIB_ADDR+0]      = Quad::new_actor(F_FIB_BEH.any(), NIL.any());
pub const E_BOOT: Any       = Any { raw: MUT_RAW | 190 };
        //quad_ram[190]               = Quad::event_t(Any::cap(89), Any::rom(188), NIL.any());  // stop actor
        quad_ram[190]               = Quad::event_t(Any::cap(191), Any::rom(188), NIL.any());  // run loop demo
        //quad_ram[190]               = Quad::event_t(Any::cap(100), Any::rom(188), NIL.any());  // run test suite
        //quad_ram[190]               = Quad::event_t(FN_FIB.any(), Any::rom(185), NIL.any());  // run (fib 6)
        quad_ram[191]               = Quad::new_actor(RESEND.any(), Any::rom(189));

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
        //quad_mem[FEXPR_T.addr()]    = Typed::Type;
        quad_mem[DICT_T.addr()]     = Typed::Type;
        quad_mem[FREE_T.addr()]     = Typed::Type;

        quad_mem[MEMORY.addr()]     = Typed::Memory { top: Ptr::new(256), next: NIL.ptr(), free: Fix::new(0), root: DQ_GC_ROOT };
        quad_mem[DDEQUE.addr()]     = Typed::Ddeque { e_first: Ptr::new(190), e_last: Ptr::new(190), k_first: NIL.ptr(), k_last: NIL.ptr() };

        quad_mem[COMMIT.addr()]     = Typed::Instr { op: Op::End { op: End::Commit } };
        quad_mem[SEND_0.addr()]     = Typed::Instr { op: Op::Send { n: Fix::new(0), k: COMMIT } };
        quad_mem[CUST_SEND.addr()]  = Typed::Instr { op: Op::Msg { n: Fix::new(1), k: SEND_0 } };
        quad_mem[RV_SELF.addr()]    = Typed::Instr { op: Op::My { op: My::Addr, k: CUST_SEND } };
        quad_mem[RV_UNDEF.addr()]   = Typed::Instr { op: Op::Push { v: UNDEF, k: CUST_SEND } };
        quad_mem[RV_NIL.addr()]     = Typed::Instr { op: Op::Push { v: NIL, k: CUST_SEND } };
        quad_mem[RV_FALSE.addr()]   = Typed::Instr { op: Op::Push { v: FALSE, k: CUST_SEND } };
        quad_mem[RV_TRUE.addr()]    = Typed::Instr { op: Op::Push { v: TRUE, k: CUST_SEND } };
        quad_mem[RV_UNIT.addr()]    = Typed::Instr { op: Op::Push { v: UNIT, k: CUST_SEND } };
        quad_mem[RV_ZERO.addr()]    = Typed::Instr { op: Op::Push { v: ZERO.val(), k: CUST_SEND } };
        quad_mem[RV_ONE.addr()]     = Typed::Instr { op: Op::Push { v: fixnum(1), k: CUST_SEND } };
        quad_mem[RESEND.addr()-1]   = Typed::Instr { op: Op::My { op: My::Addr, k: SEND_0 } };
        quad_mem[RESEND.addr()]     = Typed::Instr { op: Op::Msg { n: Fix::new(0), k: Ptr::new(RESEND.raw()-1) } };
        quad_mem[RELEASE.addr()]    = Typed::Instr { op: Op::End { op: End::Release } };
        quad_mem[RELEASE_0.addr()]  = Typed::Instr { op: Op::Send { n: Fix::new(0), k: RELEASE } };
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <value>, k: ... } };
        quad_mem[MEMO_BEH.addr()]   = Typed::Instr { op: Op::Dup { n: Fix::new(1), k: CUST_SEND } };
        quad_mem[A_SINK.addr()]     = Typed::Actor { beh: COMMIT, state: NIL.ptr(), events: None };

        /*
        (define fwd-beh
            (lambda (rcvr)
                (BEH msg
                    (SEND rcvr msg) )))
        */
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <rcvr>, k: ... } };
        quad_mem[33]                = Typed::Instr { op: Op::Msg { n: Fix::new(0), k: Ptr::new(34) } };  // rcvr msg
        quad_mem[34]                = Typed::Instr { op: Op::Pick { n: Fix::new(2), k: SEND_0 } };  // rcvr msg rcvr

        /*
        (define once-beh
            (lambda (rcvr)
                (BEH msg
                    (BECOME sink-beh)
                    (SEND rcvr msg) )))
        */
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <rcvr>, k: ... } };
        quad_mem[35]                = Typed::Instr { op: Op::Push { v: COMMIT.val(), k: Ptr::new(36) } };  // rcvr sink-beh
        quad_mem[36]                = Typed::Instr { op: Op::Beh { n: Fix::new(0), k: FWD_BEH } };  // rcvr

        /*
        (define label-beh
            (lambda (rcvr label)
                (BEH msg
                    (SEND rcvr (cons label msg)) )))
        */
        //quad_mem[-2]              = Typed::Instr { op: Op::Push { v: <rcvr>, k: ... } };
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <label>, k: ... } };
        quad_mem[37]                = Typed::Instr { op: Op::Msg { n: Fix::new(0), k: Ptr::new(38) } };  // rcvr label msg
        quad_mem[38]                = Typed::Instr { op: Op::Pick { n: Fix::new(2), k: Ptr::new(39) } };  // rcvr label msg label
        quad_mem[39]                = Typed::Instr { op: Op::Pair { n: Fix::new(1), k: Ptr::new(40) } };  // rcvr label (label . msg)
        quad_mem[40]                = Typed::Instr { op: Op::Pick { n: Fix::new(3), k: SEND_0 } };  // rcvr label (label . msg) rcvr

        /*
        (define tag-beh
            (lambda (rcvr)
                (BEH msg
                    (SEND rcvr (cons SELF msg)) )))
        */
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <rcvr>, k: ... } };
        quad_mem[41]                = Typed::Instr { op: Op::My { op: My::Addr, k: LABEL_BEH } };  // rcvr SELF

        /*
        (define once-tag-beh  ;; FIXME: find a better name for this...
            (lambda (rcvr)
                (BEH msg
                    (BECOME sink-beh)
                    (SEND rcvr (cons SELF msg)) )))
        */
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <rcvr>, k: ... } };
        quad_mem[42]                = Typed::Instr { op: Op::Push { v: COMMIT.val(), k: Ptr::new(43) } };  // rcvr sink-beh
        quad_mem[43]                = Typed::Instr { op: Op::Beh { n: Fix::new(0), k: TAG_BEH } };  // rcvr

        /*
        (define wrap-beh
            (lambda (rcvr)
                (BEH msg
                    (SEND rcvr (list msg)) )))
        */
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <rcvr>, k: ... } };
        quad_mem[44]                = Typed::Instr { op: Op::Msg { n: Fix::new(0), k: Ptr::new(45) } };  // rcvr msg
        quad_mem[45]                = Typed::Instr { op: Op::Pick { n: Fix::new(2), k: Ptr::new(46) } };  // rcvr msg rcvr
        quad_mem[46]                = Typed::Instr { op: Op::Send { n: Fix::new(1), k: COMMIT } };  // rcvr

        /*
        (define unwrap-beh
            (lambda (rcvr)
                (BEH (msg)
                    (SEND rcvr msg) )))
        */
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <rcvr>, k: ... } };
        quad_mem[47]                = Typed::Instr { op: Op::Msg { n: Fix::new(1), k: Ptr::new(48) } };  // rcvr msg
        quad_mem[48]                = Typed::Instr { op: Op::Pick { n: Fix::new(2), k: SEND_0 } };  // rcvr msg rcvr

        /*
        (define future-beh
            (lambda (rcap wcap)
                (BEH (tag . arg)
                    (cond
                        ((eq? tag rcap)
                            (BECOME (wait-beh rcap wcap (list arg))))
                        ((eq? tag wcap)
                            (BECOME (value-beh rcap arg))) ))))
        */
        //quad_mem[-2]              = Typed::Instr { op: Op::Push { v: <rcap>, k: ... } };
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <wcap>, k: ... } };
        quad_mem[49]                = Typed::Instr { op: Op::Msg { n: Fix::new(1), k: Ptr::new(50) } };  // rcap wcap tag
        quad_mem[50]                = Typed::Instr { op: Op::Pick { n: Fix::new(3), k: Ptr::new(51) } };  // rcap wcap tag rcap
        quad_mem[51]                = Typed::Instr { op: Op::Cmp { op: Cmp::Eq, k: Ptr::new(52) } };  // rcap wcap bool
        quad_mem[52]                = Typed::Instr { op: Op::If { t: Ptr::new(53), f: Ptr::new(58) } };  // rcap wcap

        quad_mem[53]                = Typed::Instr { op: Op::Push { v: NIL, k: Ptr::new(54) } };  // rcap wcap ()
        quad_mem[54]                = Typed::Instr { op: Op::Msg { n: Fix::new(-1), k: Ptr::new(55) } };  // rcap wcap () arg
        quad_mem[55]                = Typed::Instr { op: Op::Pair { n: Fix::new(1), k: Ptr::new(56) } };  // rcap wcap (arg)
        quad_mem[56]                = Typed::Instr { op: Op::Push { v: WAIT_BEH.val(), k: Ptr::new(57) } };  // rcap wcap (arg) wait-beh
        quad_mem[57]                = Typed::Instr { op: Op::Beh { n: Fix::new(3), k: COMMIT } };  // wait-beh[rcap wcap (arg)]

        quad_mem[58]                = Typed::Instr { op: Op::Msg { n: Fix::new(1), k: Ptr::new(59) } };  // rcap wcap tag
        quad_mem[59]                = Typed::Instr { op: Op::Pick { n: Fix::new(2), k: Ptr::new(60) } };  // rcap wcap tag wcap
        quad_mem[60]                = Typed::Instr { op: Op::Cmp { op: Cmp::Eq, k: Ptr::new(61) } };  // rcap wcap bool
        quad_mem[61]                = Typed::Instr { op: Op::If { t: Ptr::new(62), f: ABORT } };  // rcap wcap

        quad_mem[62]                = Typed::Instr { op: Op::Drop { n: Fix::new(1), k: Ptr::new(63) } };  // rcap
        quad_mem[63]                = Typed::Instr { op: Op::Msg { n: Fix::new(-1), k: Ptr::new(64) } };  // rcap value=arg
        quad_mem[64]                = Typed::Instr { op: Op::Push { v: VALUE_BEH.val(), k: Ptr::new(65) } };  // rcap value=arg value-beh
        quad_mem[65]                = Typed::Instr { op: Op::Beh { n: Fix::new(2), k: COMMIT } };  // value-beh[rcap value]

        /*
        (define value-beh
            (lambda (rcap value)
                (BEH (tag . arg)
                    (cond
                        ((eq? tag rcap)
                            (SEND arg value))) )))
        */
        //quad_mem[-2]              = Typed::Instr { op: Op::Push { v: <rcap>, k: ... } };
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <value>, k: ... } };
        quad_mem[66]                = Typed::Instr { op: Op::Msg { n: Fix::new(1), k: Ptr::new(67) } };  // rcap value tag
        quad_mem[67]                = Typed::Instr { op: Op::Pick { n: Fix::new(3), k: Ptr::new(68) } };  // rcap value tag rcap
        quad_mem[68]                = Typed::Instr { op: Op::Cmp { op: Cmp::Eq, k: Ptr::new(69) } };  // rcap value bool
        quad_mem[69]                = Typed::Instr { op: Op::If { t: Ptr::new(70), f: COMMIT } };  // rcap value
        quad_mem[70]                = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(71) } };  // rcap value value
        quad_mem[71]                = Typed::Instr { op: Op::Msg { n: Fix::new(-1), k: SEND_0 } };  // rcap value value cust=arg

        /*
        (define serial-beh
            (lambda (svc)
                (BEH (cust . req)
                    (define tag (CREATE (once-tag-beh SELF)))
                    (SEND svc (tag . req))
                    (BECOME (busy-beh svc cust tag (deque-new))) )))
        */
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <svc>, k: ... } };
        quad_mem[72]                = Typed::Instr { op: Op::Msg { n: Fix::new(1), k: Ptr::new(73) } };  // svc cust
        quad_mem[73]                = Typed::Instr { op: Op::My { op: My::Addr, k: Ptr::new(74) } };  // svc cust SELF
        quad_mem[74]                = Typed::Instr { op: Op::Push { v: ONCE_TAG_BEH.val(), k: Ptr::new(75) } };  // svc cust SELF once-tag-beh
        quad_mem[75]                = Typed::Instr { op: Op::New { n: Fix::new(1), k: Ptr::new(76) } };  // svc cust tag=once-tag-beh[SELF]

        quad_mem[76]                = Typed::Instr { op: Op::Msg { n: Fix::new(-1), k: Ptr::new(77) } };  // svc cust tag req
        quad_mem[77]                = Typed::Instr { op: Op::Pick { n: Fix::new(2), k: Ptr::new(78) } };  // svc cust tag req tag
        quad_mem[78]                = Typed::Instr { op: Op::Pair { n: Fix::new(1), k: Ptr::new(79) } };  // svc cust tag (tag . req)
        quad_mem[79]                = Typed::Instr { op: Op::Pick { n: Fix::new(4), k: Ptr::new(80) } };  // svc cust tag (tag . req) svc
        quad_mem[80]                = Typed::Instr { op: Op::Send { n: Fix::new(0), k: Ptr::new(81) } };  // svc cust tag

        quad_mem[81]                = Typed::Instr { op: Op::Deque { op: Deque::New, k: Ptr::new(82) } };  // svc cust tag pending
        quad_mem[82]                = Typed::Instr { op: Op::Push { v: BUSY_BEH.val(), k: Ptr::new(83) } };  // svc cust tag pending busy-beh
        quad_mem[83]                = Typed::Instr { op: Op::Beh { n: Fix::new(4), k: COMMIT } };  // busy-beh[svc cust tag pending]

        /* DQ_EMPTY */
        quad_mem[84]                = Typed::Pair { car: DQ_EMPTY.val(), cdr: DDEQUE.val() };
        quad_mem[85]                = Typed::Pair { car: NIL, cdr: NIL };

        /* (ABORT #?) */
        quad_mem[86]                = Typed::Instr { op: Op::Push { v: UNDEF, k: Ptr::new(87) } };
        quad_mem[87]                = Typed::Instr { op: Op::End { op: End::Abort } };

        /* (STOP) */
        quad_mem[88]                = Typed::Instr { op: Op::End { op: End::Stop } };
pub const A_STOP: Cap               = Cap { raw: 89 };
        quad_mem[89]                = Typed::Actor { beh: STOP.ptr(), state: NIL.ptr(), events: None };

        /*
        (define wait-beh
            (lambda (rcap wcap waiting)
                (BEH (tag . arg)
                    (cond
                        ((eq? tag rcap)
                            (BECOME (wait-beh rcap wcap (cons arg waiting))))
                        ((eq? tag wcap)
                            (send-to-all waiting arg)
                            (BECOME (value-beh rcap arg))) ))))
        */
        //quad_mem[-3]              = Typed::Instr { op: Op::Push { v: <rcap>, k: ... } };
        //quad_mem[-2]              = Typed::Instr { op: Op::Push { v: <wcap>, k: ... } };
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <waiting>, k: ... } };
        quad_mem[90]                = Typed::Instr { op: Op::Msg { n: Fix::new(1), k: Ptr::new(91) } };  // rcap wcap waiting tag
        quad_mem[91]                = Typed::Instr { op: Op::Pick { n: Fix::new(4), k: Ptr::new(92) } };  // rcap wcap waiting tag rcap
        quad_mem[92]                = Typed::Instr { op: Op::Cmp { op: Cmp::Eq, k: Ptr::new(93) } };  // rcap wcap waiting bool
        quad_mem[93]                = Typed::Instr { op: Op::If { t: Ptr::new(94), f: Ptr::new(98) } };  // rcap wcap waiting

        quad_mem[94]                = Typed::Instr { op: Op::Msg { n: Fix::new(-1), k: Ptr::new(95) } };  // rcap wcap waiting arg
        quad_mem[95]                = Typed::Instr { op: Op::Pair { n: Fix::new(1), k: Ptr::new(96) } };  // rcap wcap (arg . waiting)
        quad_mem[96]                = Typed::Instr { op: Op::Push { v: WAIT_BEH.val(), k: Ptr::new(97) } };  // rcap wcap (arg . waiting) wait-beh
        quad_mem[97]                = Typed::Instr { op: Op::Beh { n: Fix::new(3), k: COMMIT } };  // wait-beh[rcap wcap (arg . waiting)]

        quad_mem[98]                = Typed::Instr { op: Op::Msg { n: Fix::new(1), k: Ptr::new(99) } };  // rcap wcap waiting tag
        quad_mem[99]                = Typed::Instr { op: Op::Pick { n: Fix::new(2), k: Ptr::new(100) } };  // rcap wcap waiting tag wcap
        quad_mem[100]               = Typed::Instr { op: Op::Cmp { op: Cmp::Eq, k: Ptr::new(101) } };  // rcap wcap waiting bool
        quad_mem[101]               = Typed::Instr { op: Op::If { t: Ptr::new(102), f: ABORT } };  // rcap wcap waiting

        quad_mem[102]               = Typed::Instr { op: Op::Dup { n: Fix::new(1), k: Ptr::new(103) } };  // rcap wcap waiting waiting
        quad_mem[103]               = Typed::Instr { op: Op::Typeq { t: PAIR_T.ptr(), k: Ptr::new(104) } };  // rcap wcap waiting bool
        quad_mem[104]               = Typed::Instr { op: Op::If { t: Ptr::new(105), f: Ptr::new(109) } };  // rcap wcap waiting
        quad_mem[105]               = Typed::Instr { op: Op::Part { n: Fix::new(1), k: Ptr::new(106) } };  // rcap wcap rest first
        quad_mem[106]               = Typed::Instr { op: Op::Msg { n: Fix::new(-1), k: Ptr::new(107) } };  // rcap wcap rest first value=arg
        quad_mem[107]               = Typed::Instr { op: Op::Roll { n: Fix::new(2), k: Ptr::new(108) } };  // rcap wcap rest value=arg first
        quad_mem[108]               = Typed::Instr { op: Op::Send { n: Fix::new(0), k: Ptr::new(102) } };  // rcap wcap rest

        quad_mem[109]               = Typed::Instr { op: Op::Drop { n: Fix::new(2), k: Ptr::new(110) } };  // rcap
        quad_mem[110]               = Typed::Instr { op: Op::Msg { n: Fix::new(-1), k: Ptr::new(111) } };  // rcap value=arg
        quad_mem[111]               = Typed::Instr { op: Op::Push { v: VALUE_BEH.val(), k: Ptr::new(112) } };  // rcap value=arg value-beh
        quad_mem[112]               = Typed::Instr { op: Op::Beh { n: Fix::new(2), k: COMMIT } };  // value-beh[rcap value]

        /*
        (define busy-beh
            (lambda (svc cust tag pending)
                (BEH (cust0 . req0)
                    (cond
                        ((eq? cust0 tag)
                            (SEND cust req0)
                            (define (next pending1) (deque-pop pending))
                            (cond
                                ((eq? next #?)
                                    (BECOME (serial-beh svc)))  ; return to "ready" state
                                (#t
                                    (define (cust1 . req1) next)
                                    (define tag1 (CREATE (once-tag-beh SELF)))
                                    (SEND svc (tag1 . req1))
                                    (BECOME (busy-beh svc cust1 tag1 pending1)) )))
                        (#t
                            (define pending1 (deque-put pending (cons cust0 req0)))
                            (BECOME (busy-beh svc cust tag pending1))) ))))
                    )))
        */
        //quad_mem[-4]              = Typed::Instr { op: Op::Push { v: <svc>, k: ... } };
        //quad_mem[-3]              = Typed::Instr { op: Op::Push { v: <cust>, k: ... } };
        //quad_mem[-2]              = Typed::Instr { op: Op::Push { v: <tag>, k: ... } };
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <pending>, k: ... } };
        quad_mem[113]               = Typed::Instr { op: Op::Msg { n: Fix::new(1), k: Ptr::new(114) } };  // svc cust tag pending cust0
        quad_mem[114]               = Typed::Instr { op: Op::Pick { n: Fix::new(3), k: Ptr::new(115) } };  // svc cust tag pending cust0 tag
        quad_mem[115]               = Typed::Instr { op: Op::Cmp { op: Cmp::Eq, k: Ptr::new(116) } };  // svc cust tag pending bool
        quad_mem[116]               = Typed::Instr { op: Op::If { t: Ptr::new(117), f: Ptr::new(141) } };  // svc cust tag pending

        quad_mem[117]               = Typed::Instr { op: Op::Msg { n: Fix::new(-1), k: Ptr::new(118) } };  // svc cust tag pending req0
        quad_mem[118]               = Typed::Instr { op: Op::Roll { n: Fix::new(4), k: Ptr::new(119) } };  // svc tag pending req0 cust
        quad_mem[119]               = Typed::Instr { op: Op::Send { n: Fix::new(0), k: Ptr::new(120) } };  // svc tag pending
        quad_mem[120]               = Typed::Instr { op: Op::Deque { op: Deque::Pop, k: Ptr::new(121) } };  // svc tag pending1 next
        quad_mem[121]               = Typed::Instr { op: Op::Dup { n: Fix::new(1), k: Ptr::new(122) } };  // svc tag pending1 next next
        quad_mem[122]               = Typed::Instr { op: Op::Eq { v: UNDEF, k: Ptr::new(123) } };  // svc tag pending1 next bool
        quad_mem[123]               = Typed::Instr { op: Op::If { t: Ptr::new(124), f: Ptr::new(127) } };  // svc tag pending1 next

        quad_mem[124]               = Typed::Instr { op: Op::Drop { n: Fix::new(3), k: Ptr::new(112) } };  // svc
        quad_mem[125]               = Typed::Instr { op: Op::Push { v: SERIAL_BEH.val(), k: Ptr::new(112) } };  // svc serial-beh
        quad_mem[126]               = Typed::Instr { op: Op::Beh { n: Fix::new(1), k: COMMIT } };  // serial-beh[svc]

        quad_mem[127]               = Typed::Instr { op: Op::Part { n: Fix::new(1), k: Ptr::new(128) } };  // svc tag pending1 req1 cust1
        quad_mem[128]               = Typed::Instr { op: Op::My { op: My::Addr, k: Ptr::new(129) } };  // svc tag pending1 req1 cust1 SELF
        quad_mem[129]               = Typed::Instr { op: Op::Push { v: ONCE_TAG_BEH.val(), k: Ptr::new(130) } };  // svc tag pending1 req1 cust1 SELF once-tag-beh
        quad_mem[130]               = Typed::Instr { op: Op::New { n: Fix::new(1), k: Ptr::new(131) } };  // svc tag pending1 req1 cust1 tag1=once-tag-beh[SELF]
        quad_mem[131]               = Typed::Instr { op: Op::Roll { n: Fix::new(3), k: Ptr::new(132) } };  // svc tag pending1 cust1 tag1 req1
        quad_mem[132]               = Typed::Instr { op: Op::Pick { n: Fix::new(2), k: Ptr::new(133) } };  // svc tag pending1 cust1 tag1 req1 tag1
        quad_mem[133]               = Typed::Instr { op: Op::Pair { n: Fix::new(1), k: Ptr::new(134) } };  // svc tag pending1 cust1 tag1 (tag1 . req1)
        quad_mem[134]               = Typed::Instr { op: Op::Pick { n: Fix::new(6), k: Ptr::new(135) } };  // svc tag pending1 cust1 tag1 (tag1 . req1) svc
        quad_mem[135]               = Typed::Instr { op: Op::Send { n: Fix::new(0), k: Ptr::new(136) } };  // svc tag pending1 cust1 tag1
        quad_mem[136]               = Typed::Instr { op: Op::Roll { n: Fix::new(5), k: Ptr::new(137) } };  // tag pending1 cust1 tag1 svc
        quad_mem[137]               = Typed::Instr { op: Op::Roll { n: Fix::new(-3), k: Ptr::new(138) } };  // tag pending1 svc cust1 tag1
        quad_mem[138]               = Typed::Instr { op: Op::Roll { n: Fix::new(4), k: Ptr::new(139) } };  // tag svc cust1 tag1 pending1

        quad_mem[139]               = Typed::Instr { op: Op::Push { v: BUSY_BEH.val(), k: Ptr::new(140) } };  // ... svc cust1 tag1 pending1 busy-beh
        quad_mem[140]               = Typed::Instr { op: Op::Beh { n: Fix::new(4), k: COMMIT } };  // busy-beh[svc cust1 tag1 pending1]

        quad_mem[141]               = Typed::Instr { op: Op::Msg { n: Fix::new(0), k: Ptr::new(142) } };  // svc cust tag pending (cust0 . req0)
        quad_mem[142]               = Typed::Instr { op: Op::Deque { op: Deque::Put, k: Ptr::new(139) } };  // svc cust tag pending1

        /*
        (define fib                 ; O(n!) performance?
          (lambda (n)               ; msg: (cust n)
            (if (< n 2)
                n
                (+ (fib (- n 1)) (fib (- n 2))))))
        */
pub const F_FIB_RAW: Raw            = 150;
pub const F_FIB_ADDR: usize         = F_FIB_RAW as usize;
//pub const F_FIB: Cap                = Cap { raw: F_FIB_RAW };
        quad_mem[F_FIB_ADDR+0]      = Typed::Actor { beh: F_FIB_BEH, state: NIL.ptr(), events: None };
pub const F_FIB_BEH: Ptr            = Ptr { raw: F_FIB_RAW+1 };
        quad_mem[F_FIB_ADDR+1]      = Typed::Instr { op: Op::Msg { n: Fix::new(2), k: Ptr::new(F_FIB_RAW+2) } };  // n
        quad_mem[F_FIB_ADDR+2]      = Typed::Instr { op: Op::Dup { n: Fix::new(1), k: Ptr::new(F_FIB_RAW+3) } };  // n n
        quad_mem[F_FIB_ADDR+3]      = Typed::Instr { op: Op::Push { v: fixnum(2), k: Ptr::new(F_FIB_RAW+4) } };  // n n 2
        quad_mem[F_FIB_ADDR+4]      = Typed::Instr { op: Op::Cmp { op: Cmp::Lt, k: Ptr::new(F_FIB_RAW+5) } };  // n n<2
        quad_mem[F_FIB_ADDR+5]      = Typed::Instr { op: Op::If { t: CUST_SEND, f: Ptr::new(F_FIB_RAW+6) } };  // n

        quad_mem[F_FIB_ADDR+6]      = Typed::Instr { op: Op::Msg { n: Fix::new(1), k: Ptr::new(F_FIB_RAW+7) } };  // n cust
        quad_mem[F_FIB_ADDR+7]      = Typed::Instr { op: Op::Push { v: F_FIB_K.val(), k: Ptr::new(F_FIB_RAW+8) } };  // n cust fib-k
        quad_mem[F_FIB_ADDR+8]      = Typed::Instr { op: Op::New { n: Fix::new(1), k: Ptr::new(F_FIB_RAW+9) } };  // n k=fib-k[cust]

        quad_mem[F_FIB_ADDR+9]      = Typed::Instr { op: Op::Pick { n: Fix::new(2), k: Ptr::new(F_FIB_RAW+10) } };  // n k n
        quad_mem[F_FIB_ADDR+10]     = Typed::Instr { op: Op::Push { v: fixnum(1), k: Ptr::new(F_FIB_RAW+11) } };  // n k n 1
        quad_mem[F_FIB_ADDR+11]     = Typed::Instr { op: Op::Alu { op: Alu::Sub, k: Ptr::new(F_FIB_RAW+12) } };  // n k n-1
        quad_mem[F_FIB_ADDR+12]     = Typed::Instr { op: Op::Pick { n: Fix::new(2), k: Ptr::new(F_FIB_RAW+13) } };  // n k n-1 k
        //quad_mem[F_FIB_ADDR+13]     = Typed::Instr { op: Op::Push { v: F_FIB.val(), k: Ptr::new(F_FIB_RAW+14) } };  // n k n-1 k fib
        quad_mem[F_FIB_ADDR+13]     = Typed::Instr { op: Op::Push { v: FN_FIB.val(), k: Ptr::new(F_FIB_RAW+14) } };  // n k n-1 k fn-fib
        quad_mem[F_FIB_ADDR+14]     = Typed::Instr { op: Op::Send { n: Fix::new(2), k: Ptr::new(F_FIB_RAW+15) } };  // n k

        quad_mem[F_FIB_ADDR+15]     = Typed::Instr { op: Op::Roll { n: Fix::new(2), k: Ptr::new(F_FIB_RAW+16) } };  // k n
        quad_mem[F_FIB_ADDR+16]     = Typed::Instr { op: Op::Push { v: fixnum(2), k: Ptr::new(F_FIB_RAW+17) } };  // k n 2
        quad_mem[F_FIB_ADDR+17]     = Typed::Instr { op: Op::Alu { op: Alu::Sub, k: Ptr::new(F_FIB_RAW+18) } };  // k n-2
        quad_mem[F_FIB_ADDR+18]     = Typed::Instr { op: Op::Roll { n: Fix::new(2), k: Ptr::new(F_FIB_RAW+19) } };  // n-2 k
        //quad_mem[F_FIB_ADDR+19]     = Typed::Instr { op: Op::My { op: My::Addr, k: Ptr::new(F_FIB_RAW+20) } };  // n-2 k fib
        quad_mem[F_FIB_ADDR+19]     = Typed::Instr { op: Op::Push { v: FN_FIB.val(), k: Ptr::new(F_FIB_RAW+20) } };  // n-2 k fn-fib
        quad_mem[F_FIB_ADDR+20]     = Typed::Instr { op: Op::Send { n: Fix::new(2), k: COMMIT } };  // --

pub const F_FIB_K: Ptr              = Ptr { raw: F_FIB_RAW+21 };
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <cust>, k: ... } };
        quad_mem[F_FIB_ADDR+21]     = Typed::Instr { op: Op::Msg { n: Fix::new(0), k: Ptr::new(F_FIB_RAW+22) } };  // cust m
        quad_mem[F_FIB_ADDR+22]     = Typed::Instr { op: Op::Push { v: F_FIB_K2.val(), k: Ptr::new(F_FIB_RAW+23) } };  // cust m fib-k2
        quad_mem[F_FIB_ADDR+23]     = Typed::Instr { op: Op::Beh { n: Fix::new(2), k: COMMIT } };  // fib-k2[cust m]

pub const F_FIB_K2: Ptr             = Ptr { raw: F_FIB_RAW+24 };
        //quad_mem[-2]              = Typed::Instr { op: Op::Push { v: <cust>, k: ... } };
        //quad_mem[-1]              = Typed::Instr { op: Op::Push { v: <m>, k: ... } };
        quad_mem[F_FIB_ADDR+24]     = Typed::Instr { op: Op::Msg { n: Fix::new(0), k: Ptr::new(F_FIB_RAW+25) } };  // cust m n
        quad_mem[F_FIB_ADDR+25]     = Typed::Instr { op: Op::Alu { op: Alu::Add, k: Ptr::new(F_FIB_RAW+26) } };  // cust m+n
        quad_mem[F_FIB_ADDR+26]     = Typed::Instr { op: Op::Roll { n: Fix::new(2), k: SEND_0 } };  // m+n cust

pub const FN_FIB: Cap               = Cap { raw: F_FIB_RAW+27 };        // worker-generator facade for `fib`
        quad_mem[F_FIB_ADDR+27]     = Typed::Actor { beh: Ptr::new(F_FIB_RAW+28), state: NIL.ptr(), events: None };
        quad_mem[F_FIB_ADDR+28]     = Typed::Instr { op: Op::Msg { n: Fix::new(0), k: Ptr::new(F_FIB_RAW+29) } };  // msg
        quad_mem[F_FIB_ADDR+29]     = Typed::Instr { op: Op::Push { v: F_FIB_BEH.val(), k: Ptr::new(F_FIB_RAW+30) } };  // msg fib-beh
        quad_mem[F_FIB_ADDR+30]     = Typed::Instr { op: Op::New { n: Fix::new(0), k: SEND_0 } };  // msg fn=fib-beh[]

        /*
        (define COMMIT
          (vm-end-commit))
        (define SEND-0  ; msg target
          (vm-send 0 COMMIT))
        (define CUST-SEND  ; msg
          (vm-msg 1 SEND-0))
        (define fib-k2  ; cust m
          (vm-msg 0  ; cust m n
            (vm-alu-add  ; cust m+n
              (vm-roll 2  ; m+n cust
                SEND-0))))
        (define fib-k  ; cust
          (vm-msg 0  ; cust m
            (vm-push fib-k2  ; cust m fib-k2
              (vm-beh 2  ; (fib-k2 cust m)
                COMMIT))))
        (define fib  ; (n)
          (CREATE  ; (cust n)
            (vm-msg 2  ; n
              (vm-dup 1  ; n n
                (vm-push 2  ; n n 2
                  (vm-cmp-lt  ; n n<2
                    (vm-if  ; n
                      CUST-SEND
                      (vm-msg 1  ; n cust
                        (vm-push fib-k  ; n cust fib-k
                          (vm-new 1  ; n k=(fib-k cust)
                            (vm-pick 2  ; n k n
                              (vm-push 1  ; n k n 1
                                (vm-alu-sub  ; n k n-1
                                  (vm-pick 2  ; n k n-1 k
                                    (vm-push fib  ; n k n-1 k fib
                                      (vm-send 2  ; n k
                                        (vm-roll 2  ; k n
                                          (vm-push 2  ; k n 2
                                            (vm-alu-sub  ; k n-2
                                              (vm-roll 2  ; n-2 k
                                                (vm-my-self  ; n-2 k fib
                                                  (vm-send 2  ; --
                                                    COMMIT))))))
                                      ))))))
                          )))
                    )))))))
        */

        /* bootstrap event/actor */
        quad_mem[184]               = Typed::Pair { car: fixnum(6), cdr: NIL };
        quad_mem[185]               = Typed::Pair { car: A_STOP.val(), cdr: ptrval(184) };
        quad_mem[186]               = Typed::Pair { car: fixnum(-3), cdr: NIL };
        quad_mem[187]               = Typed::Pair { car: fixnum(-2), cdr: ptrval(186) };
        quad_mem[188]               = Typed::Pair { car: fixnum(-1), cdr: ptrval(187) };
        quad_mem[189]               = Typed::Pair { car: UNIT, cdr: NIL };
        //quad_mem[190]               = Typed::Event { target: Cap::new(191), msg: ptrval(188), next: NIL.ptr() };  // run loop demo
        quad_mem[190]               = Typed::Event { target: Cap::new(100), msg: ptrval(188), next: NIL.ptr() };  // run test suite
        //quad_mem[190]               = Typed::Event { target: FN_FIB, msg: ptrval(185), next: NIL.ptr() };  // run (fib 6)
        quad_mem[191]               = Typed::Actor { beh: RESEND, state: Ptr::new(189), events: None };

        /* Op::Dict test suite */
        /*
        quad_mem[100]               = Typed::Actor { beh: Ptr::new(101), state: NIL.ptr(), events: None };
        quad_mem[101]               = Typed::Instr { op: Op::Dict { op: Dict::Has, k: Ptr::new(102) } };
        quad_mem[102]               = Typed::Instr { op: Op::IsEq { v: FALSE, k: Ptr::new(103) } };
        quad_mem[103]               = Typed::Instr { op: Op::Push { v: NIL, k: Ptr::new(104) } };
        quad_mem[104]               = Typed::Instr { op: Op::Push { v: fixnum(0), k: Ptr::new(105) } };
        quad_mem[105]               = Typed::Instr { op: Op::Dup { n: Fix::new(2), k: Ptr::new(106) } };
        quad_mem[106]               = Typed::Instr { op: Op::Dict { op: Dict::Has, k: Ptr::new(107) } };
        quad_mem[107]               = Typed::Instr { op: Op::IsEq { v: FALSE, k: Ptr::new(108) } };
        quad_mem[108]               = Typed::Instr { op: Op::Dict { op: Dict::Get, k: Ptr::new(109) } };
        quad_mem[109]               = Typed::Instr { op: Op::IsEq { v: UNDEF, k: Ptr::new(110) } };
        quad_mem[110]               = Typed::Instr { op: Op::Push { v: NIL, k: Ptr::new(111) } };
        quad_mem[111]               = Typed::Instr { op: Op::Push { v: fixnum(0), k: Ptr::new(112) } };
        quad_mem[112]               = Typed::Instr { op: Op::Push { v: UNIT, k: Ptr::new(113) } };
        quad_mem[113]               = Typed::Instr { op: Op::Dict { op: Dict::Set, k: Ptr::new(114) } };
        quad_mem[114]               = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(115) } };
        quad_mem[115]               = Typed::Instr { op: Op::Push { v: fixnum(0), k: Ptr::new(116) } };
        quad_mem[116]               = Typed::Instr { op: Op::Dict { op: Dict::Get, k: Ptr::new(117) } };
        quad_mem[117]               = Typed::Instr { op: Op::IsEq { v: UNIT, k: Ptr::new(118) } };
        quad_mem[118]               = Typed::Instr { op: Op::Push { v: fixnum(1), k: Ptr::new(119) } };
        quad_mem[119]               = Typed::Instr { op: Op::Push { v: fixnum(-1), k: Ptr::new(120) } };
        quad_mem[120]               = Typed::Instr { op: Op::Dict { op: Dict::Add, k: Ptr::new(121) } };
        quad_mem[121]               = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(122) } };
        quad_mem[122]               = Typed::Instr { op: Op::Push { v: fixnum(0), k: Ptr::new(123) } };
        quad_mem[123]               = Typed::Instr { op: Op::Dict { op: Dict::Get, k: Ptr::new(124) } };
        quad_mem[124]               = Typed::Instr { op: Op::IsEq { v: UNIT, k: Ptr::new(125) } };
        quad_mem[125]               = Typed::Instr { op: Op::Push { v: fixnum(0), k: Ptr::new(126) } };
        quad_mem[126]               = Typed::Instr { op: Op::Dict { op: Dict::Del, k: Ptr::new(127) } };
        quad_mem[127]               = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(128) } };
        quad_mem[128]               = Typed::Instr { op: Op::Push { v: UNIT, k: Ptr::new(129) } };
        quad_mem[129]               = Typed::Instr { op: Op::Dict { op: Dict::Get, k: Ptr::new(130) } };
        quad_mem[130]               = Typed::Instr { op: Op::IsEq { v: UNDEF, k: Ptr::new(131) } };
        quad_mem[131]               = Typed::Instr { op: Op::Push { v: fixnum(1), k: Ptr::new(132) } };
        quad_mem[132]               = Typed::Instr { op: Op::Push { v: FALSE, k: Ptr::new(133) } };
        quad_mem[133]               = Typed::Instr { op: Op::Dict { op: Dict::Add, k: Ptr::new(134) } };
        quad_mem[134]               = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(135) } };
        quad_mem[135]               = Typed::Instr { op: Op::Push { v: fixnum(1), k: Ptr::new(136) } };
        quad_mem[136]               = Typed::Instr { op: Op::Push { v: TRUE, k: Ptr::new(137) } };
        quad_mem[137]               = Typed::Instr { op: Op::Dict { op: Dict::Set, k: Ptr::new(138) } };
        quad_mem[138]               = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(139) } };
        quad_mem[139]               = Typed::Instr { op: Op::Push { v: fixnum(1), k: Ptr::new(140) } };
        quad_mem[140]               = Typed::Instr { op: Op::Dict { op: Dict::Del, k: Ptr::new(141) } };
        quad_mem[141]               = Typed::Instr { op: Op::Dup { n: Fix::new(1), k: Ptr::new(142) } };
        quad_mem[142]               = Typed::Instr { op: Op::Push { v: fixnum(1), k: Ptr::new(143) } };
        quad_mem[143]               = Typed::Instr { op: Op::Dict { op: Dict::Get, k: Ptr::new(144) } };
        quad_mem[144]               = Typed::Instr { op: Op::IsEq { v: fixnum(-1), k: Ptr::new(16) } };
        */

        /* Op::Deque test suite */
        /*
        */
        quad_mem[100]               = Typed::Actor { beh: Ptr::new(101), state: NIL.ptr(), events: None };
        quad_mem[101]               = Typed::Instr { op: Op::Deque { op: Deque::Empty, k: Ptr::new(102) } };
        quad_mem[102]               = Typed::Instr { op: Op::IsEq { v: TRUE, k: Ptr::new(103) } };
        quad_mem[103]               = Typed::Instr { op: Op::Deque { op: Deque::New, k: Ptr::new(104) } };
        quad_mem[104]               = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(105) } };
        quad_mem[105]               = Typed::Instr { op: Op::Deque { op: Deque::Empty, k: Ptr::new(106) } };
        quad_mem[106]               = Typed::Instr { op: Op::IsEq { v: TRUE, k: Ptr::new(107) } };
        quad_mem[107]               = Typed::Instr { op: Op::Push { v: fixnum(1), k: Ptr::new(108) } };
        quad_mem[108]               = Typed::Instr { op: Op::Deque { op: Deque::Push, k: Ptr::new(109) } };
        quad_mem[109]               = Typed::Instr { op: Op::Push { v: fixnum(2), k: Ptr::new(110) } };
        quad_mem[110]               = Typed::Instr { op: Op::Deque { op: Deque::Push, k: Ptr::new(111) } };
        quad_mem[111]               = Typed::Instr { op: Op::Push { v: fixnum(3), k: Ptr::new(112) } };
        quad_mem[112]               = Typed::Instr { op: Op::Deque { op: Deque::Push, k: Ptr::new(113) } };
        quad_mem[113]               = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(114) } };
        quad_mem[114]               = Typed::Instr { op: Op::Deque { op: Deque::Empty, k: Ptr::new(115) } };
        quad_mem[115]               = Typed::Instr { op: Op::IsEq { v: FALSE, k: Ptr::new(116) } };
        quad_mem[116]               = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(117) } };
        quad_mem[117]               = Typed::Instr { op: Op::Deque { op: Deque::Len, k: Ptr::new(118) } };
        quad_mem[118]               = Typed::Instr { op: Op::IsEq { v: fixnum(3), k: Ptr::new(119) } };
        quad_mem[119]               = Typed::Instr { op: Op::Deque { op: Deque::Pull, k: Ptr::new(120) } };
        quad_mem[120]               = Typed::Instr { op: Op::IsEq { v: fixnum(1), k: Ptr::new(121) } };
        quad_mem[121]               = Typed::Instr { op: Op::Deque { op: Deque::Pull, k: Ptr::new(122) } };
        quad_mem[122]               = Typed::Instr { op: Op::IsEq { v: fixnum(2), k: Ptr::new(123) } };
        quad_mem[123]               = Typed::Instr { op: Op::Deque { op: Deque::Pull, k: Ptr::new(124) } };
        quad_mem[124]               = Typed::Instr { op: Op::IsEq { v: fixnum(3), k: Ptr::new(125) } };
        quad_mem[125]               = Typed::Instr { op: Op::Deque { op: Deque::Pull, k: Ptr::new(126) } };
        quad_mem[126]               = Typed::Instr { op: Op::IsEq { v: UNDEF, k: Ptr::new(127) } };
        quad_mem[127]               = Typed::Instr { op: Op::Dup { n: Fix::new(1), k: Ptr::new(128) } };
        quad_mem[128]               = Typed::Instr { op: Op::Deque { op: Deque::Len, k: Ptr::new(129) } };
        quad_mem[129]               = Typed::Instr { op: Op::IsEq { v: fixnum(0), k: Ptr::new(130) } };
        quad_mem[130]               = Typed::Instr { op: Op::Dup { n: Fix::new(1), k: Ptr::new(131) } };
        quad_mem[131]               = Typed::Instr { op: Op::Msg { n: Fix::new(0), k: Ptr::new(132) } };
        quad_mem[132]               = Typed::Instr { op: Op::Deque { op: Deque::Put, k: Ptr::new(133) } };
        quad_mem[133]               = Typed::Instr { op: Op::Msg { n: Fix::new(-1), k: Ptr::new(134) } };
        quad_mem[134]               = Typed::Instr { op: Op::Deque { op: Deque::Put, k: Ptr::new(135) } };
        quad_mem[135]               = Typed::Instr { op: Op::Msg { n: Fix::new(-2), k: Ptr::new(136) } };
        quad_mem[136]               = Typed::Instr { op: Op::Deque { op: Deque::Put, k: Ptr::new(137) } };
        quad_mem[137]               = Typed::Instr { op: Op::Deque { op: Deque::Pop, k: Ptr::new(138) } };
        quad_mem[138]               = Typed::Instr { op: Op::Roll { n: Fix::new(-2), k: Ptr::new(139) } };
        quad_mem[139]               = Typed::Instr { op: Op::Deque { op: Deque::Pop, k: Ptr::new(140) } };
        quad_mem[140]               = Typed::Instr { op: Op::Roll { n: Fix::new(-3), k: Ptr::new(141) } };
        quad_mem[141]               = Typed::Instr { op: Op::Deque { op: Deque::Pop, k: Ptr::new(142) } };
        quad_mem[142]               = Typed::Instr { op: Op::IsNe { v: NIL, k: Ptr::new(143) } };
        quad_mem[143]               = Typed::Instr { op: Op::Push { v: fixnum(1), k: Ptr::new(144) } };
        quad_mem[144]               = Typed::Instr { op: Op::Deque { op: Deque::Put, k: Ptr::new(145) } };
        quad_mem[145]               = Typed::Instr { op: Op::Push { v: fixnum(2), k: Ptr::new(146) } };
        quad_mem[146]               = Typed::Instr { op: Op::Deque { op: Deque::Put, k: Ptr::new(147) } };
        quad_mem[147]               = Typed::Instr { op: Op::Push { v: fixnum(3), k: Ptr::new(148) } };
        quad_mem[148]               = Typed::Instr { op: Op::Deque { op: Deque::Put, k: Ptr::new(149) } };
        quad_mem[149]               = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(150) } };
        quad_mem[150]               = Typed::Instr { op: Op::Deque { op: Deque::Empty, k: Ptr::new(151) } };
        quad_mem[151]               = Typed::Instr { op: Op::IsEq { v: FALSE, k: Ptr::new(152) } };
        quad_mem[152]               = Typed::Instr { op: Op::Pick { n: Fix::new(1), k: Ptr::new(153) } };
        quad_mem[153]               = Typed::Instr { op: Op::Deque { op: Deque::Len, k: Ptr::new(154) } };
        quad_mem[154]               = Typed::Instr { op: Op::IsEq { v: fixnum(3), k: Ptr::new(155) } };
        quad_mem[155]               = Typed::Instr { op: Op::Deque { op: Deque::Pop, k: Ptr::new(156) } };
        quad_mem[156]               = Typed::Instr { op: Op::IsEq { v: fixnum(1), k: Ptr::new(157) } };
        quad_mem[157]               = Typed::Instr { op: Op::Deque { op: Deque::Pop, k: Ptr::new(158) } };
        quad_mem[158]               = Typed::Instr { op: Op::IsEq { v: fixnum(2), k: Ptr::new(159) } };
        quad_mem[159]               = Typed::Instr { op: Op::Deque { op: Deque::Pop, k: Ptr::new(160) } };
        quad_mem[160]               = Typed::Instr { op: Op::IsEq { v: fixnum(3), k: Ptr::new(161) } };
        quad_mem[161]               = Typed::Instr { op: Op::Deque { op: Deque::Pop, k: Ptr::new(162) } };
        quad_mem[162]               = Typed::Instr { op: Op::IsEq { v: UNDEF, k: Ptr::new(163) } };
        quad_mem[163]               = Typed::Instr { op: Op::Dup { n: Fix::new(1), k: Ptr::new(164) } };
        quad_mem[164]               = Typed::Instr { op: Op::Deque { op: Deque::Len, k: Ptr::new(165) } };
        quad_mem[165]               = Typed::Instr { op: Op::IsEq { v: fixnum(0), k: Ptr::new(16) } };

        let mut quad_rom = [
            Quad::empty_t();
            QUAD_MAX
        ];
        for addr in 0..256 {
            let q = &quad_mem[addr];
            quad_rom[addr] = q.quad();
        }

        Core {
            quad_rom,
            quad_ram,
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
            let event = self.ram(ep);
            println!("dispatch_event: event={} -> {}", ep, event);
            let target = event.x();
            let a_ptr = self.cap_to_ptr(target);
            let a_quad = self.mem(a_ptr);
            println!("dispatch_event: target={} -> {}", a_ptr, a_quad);
            let beh = a_quad.x();
            let state = a_quad.y();
            let events = a_quad.z();
            if events == UNDEF.any() {
                // begin actor-event transaction
                self.ram_mut(a_ptr).set_z(NIL.any());
                let kp = self.new_cont(beh, state, ep);
                println!("dispatch_event: cont={} -> {}", kp, self.mem(kp));
                self.cont_enqueue(kp);
                true  // event dispatched
            } else {
                // target actor is busy, retry later...
                self.event_enqueue(ep);
                false  // no event dispatched
            }
        } else {
            println!("dispatch_event: event queue empty");
            false
        }
    }
    pub fn execute_instruction(&mut self) -> bool {
        let kp = self.k_first();
        if kp.is_ram() {
            let cont = self.ram(kp);
            println!("execute_instruction: kp={} -> {}", kp, cont);
            let ep = self.ep().any();//cont.y();
            println!("execute_instruction: ep={} -> {}", ep, self.mem(ep));
            let ip = self.ip().any();//cont.t();
            let instr = self.mem(ip);
            println!("execute_instruction: ip={} -> {}", ip, instr);
            if let Some(Typed::Instr { op }) = Typed::from(instr) {
                let ip_ = self.perform_op(&op);
                println!("execute_instruction: ip'={} -> {}", ip_, self.typed(ip_));
                self.set_ip(ip_.any());
                let kp_ = self.cont_dequeue().unwrap();
                assert_eq!(kp, kp_);
                if self.in_heap(ip_.any()) {
                    // re-queue updated continuation
                    self.cont_enqueue(kp_);
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
                println!("vm_typeq: typ={}", t);
                let val = self.stack_pop();
                println!("vm_typeq: val={}", val);
                let r = if self.typeq(t.val(), val.any()) { TRUE } else { FALSE };
                self.stack_push(r.any());
                *k
            },
            Op::Dict { op, k } => {
                println!("vm_dict: op={}", op);
                match op {
                    Dict::Has => {
                        let key = self.stack_pop();
                        let dict = self.stack_pop().ptr();
                        let b = self.dict_has(dict, key);
                        let v = if b { TRUE } else { FALSE };
                        self.stack_push(v.any());
                    },
                    Dict::Get => {
                        let key = self.stack_pop();
                        let dict = self.stack_pop().ptr();
                        let v = self.dict_get(dict, key);
                        self.stack_push(v.any());
                    },
                    Dict::Add => {
                        let value = self.stack_pop();
                        let key = self.stack_pop();
                        let dict = self.stack_pop().ptr();
                        let d = self.dict_add(dict, key, value);
                        self.stack_push(d.any());
                    },
                    Dict::Set => {
                        let value = self.stack_pop();
                        let key = self.stack_pop();
                        let dict = self.stack_pop().ptr();
                        let d = self.dict_set(dict, key, value);
                        self.stack_push(d.any());
                    },
                    Dict::Del => {
                        let key = self.stack_pop();
                        let dict = self.stack_pop().ptr();
                        let d = self.dict_del(dict, key);
                        self.stack_push(d.any());
                    },
                };
                *k
            },
            Op::Deque { op, k } => {
                println!("vm_deque: op={}", op);
                match op {
                    Deque::New => {
                        let deque = self.deque_new();
                        self.stack_push(deque.any());
                    },
                    Deque::Empty => {
                        let deque = self.stack_pop().ptr();
                        let b = self.deque_empty(deque);
                        let v = if b { TRUE } else { FALSE };
                        self.stack_push(v.any());
                    },
                    Deque::Push => {
                        let item = self.stack_pop();
                        let old = self.stack_pop().ptr();
                        let new = self.deque_push(old, item);
                        self.stack_push(new.any());
                    },
                    Deque::Pop => {
                        let old = self.stack_pop().ptr();
                        let (new, item) = self.deque_pop(old);
                        self.stack_push(new.any());
                        self.stack_push(item.any());
                    },
                    Deque::Put => {
                        let item = self.stack_pop();
                        let old = self.stack_pop().ptr();
                        let new = self.deque_put(old, item);
                        self.stack_push(new.any());
                    },
                    Deque::Pull => {
                        let old = self.stack_pop().ptr();
                        let (new, item) = self.deque_pull(old);
                        self.stack_push(new.any());
                        self.stack_push(item.any());
                    },
                    Deque::Len => {
                        let deque = self.stack_pop().ptr();
                        let n = self.deque_len(deque);
                        self.stack_push(Any::fix(n));
                    },
                };
                *k
            },
            Op::Pair { n, k } => {
                println!("vm_pair: cnt={}", n);
                let mut num = n.num();
                assert!(num < 64);
                if num > 0 {
                    let h = self.stack_pop();
                    let lst = self.cons(h.any(), NIL.any());
                    let mut p = lst;
                    while num > 1 {
                        let h = self.stack_pop();
                        let q = self.cons(h.any(), NIL.any());
                        self.set_cdr(p.any(), q.any());
                        p = q;
                        num -= 1;
                    }
                    let t = self.stack_pop();
                    self.set_cdr(p.any(), t.any());
                    self.stack_push(lst.any());
                };
                *k
            },
            Op::Part { n, k } => {
                println!("vm_part: cnt={}", n);
                let mut num = n.num();
                assert!(num < 64);
                let mut s = match Ptr::from(self.stack_pop()) {
                    Some(ptr) => ptr,
                    None => UNDEF.ptr(),
                };
                if num > 0 {
                    let lst = self.cons(self.car(s.any()).any(), NIL.any());
                    let mut p = lst;
                    while num > 1 {
                        s = match Ptr::from(self.cdr(s.any())) {
                            Some(ptr) => ptr,
                            None => UNDEF.ptr(),
                        };
                        let q = self.cons(self.car(s.any()).any(), NIL.any());
                        self.set_cdr(p.any(), q.any());
                        p = q;
                        num -= 1;
                    }
                    let t = self.cons(self.cdr(s.any()).any(), self.sp().any());
                    self.set_cdr(p.any(), t.any());
                    self.set_sp(lst.any());
                }
                *k
            },
            Op::Nth { n, k } => {
                println!("vm_nth: idx={}", n);
                let lst = self.stack_pop();
                println!("vm_nth: lst={}", lst);
                let r = self.extract_nth(lst, n.num());
                println!("vm_nth: r={}", r);
                self.stack_push(r.any());
                *k
            },
            Op::Push { v, k } => {
                println!("vm_push: val={}", v);
                self.stack_push(v.any());
                *k
            },
            Op::Depth { k } => {
                let mut num: Num = 0;
                let mut p = self.sp().val();
                while self.typeq(PAIR_T, p.any()) {
                    p = self.cdr(p.any());
                    num += 1;
                };
                let n = Fix::new(num);
                println!("vm_depth: n={}", n);
                self.stack_push(n.any());
                *k
            },
            Op::Drop { n, k } => {
                println!("vm_drop: n={}", n);
                let mut num = n.num();
                assert!(num < 64);
                while num > 0 {
                    self.stack_pop();
                    num -= 1;
                };
                *k
            },
            Op::Pick { n, k } => {
                println!("vm_pick: idx={}", n);
                let num = n.num();
                let r = if num > 0 {
                    let lst = self.sp().val();
                    self.extract_nth(lst, num)
                } else {
                    UNDEF
                };
                println!("vm_pick: r={}", r);
                self.stack_push(r.any());
                *k
            },
            Op::Dup { n, k } => {
                println!("vm_dup: n={}", n);
                let num = n.num();
                self.stack_dup(num);
                *k
            },
            Op::Roll { n, k } => {
                println!("vm_roll: idx={}", n);
                let num = n.num();
                if num > 1 {
                    assert!(num < 64);
                    let sp = self.sp().val();
                    let (q, p) = self.split_nth(sp, num);
                    if self.typeq(PAIR_T, p.any()) {
                        self.set_cdr(q.any(), self.cdr(p.any()).any());
                        self.set_cdr(p.any(), sp.any());
                        self.set_sp(p.any());
                    } else {
                        self.stack_push(UNDEF.any());  // out of range
                    }
                } else if num < -1 {
                    assert!(num > -64);
                    let sp = self.sp().val();
                    let (_q, p) = self.split_nth(sp, -num);
                    if self.typeq(PAIR_T, p.any()) {
                        self.set_sp(self.cdr(sp.any()).any());
                        self.set_cdr(sp.any(), self.cdr(p.any()).any());
                        self.set_cdr(p.any(), sp.any());
                    } else {
                        self.stack_pop();  // out of range
                    }
                };
                *k
            },
            Op::Alu { op, k } => {
                println!("vm_alu: op={}", op);
                let r = if *op == Alu::Not {
                    let v = self.stack_pop();
                    println!("vm_alu: v={}", v);
                    match Fix::from(v) {
                        Some(n) => Fix::new(!n.num()).val(),
                        _ => UNDEF,
                    }
                } else {
                    let vv = self.stack_pop();
                    println!("vm_alu: vv={}", vv);
                    let v = self.stack_pop();
                    println!("vm_alu: v={}", v);
                        match (Fix::from(v), Fix::from(vv)) {
                        (Some(n), Some(nn)) => {
                            match op {
                                Alu::And => Fix::new(n.num() & nn.num()).val(),
                                Alu::Or => Fix::new(n.num() | nn.num()).val(),
                                Alu::Xor => Fix::new(n.num() ^ nn.num()).val(),
                                Alu::Add => Fix::new(n.num() + nn.num()).val(),
                                Alu::Sub => Fix::new(n.num() - nn.num()).val(),
                                Alu::Mul => Fix::new(n.num() * nn.num()).val(),
                                _ => UNDEF,
                            }
                        }
                        _ => UNDEF
                    }
                };
                println!("vm_alu: r={}", r);
                self.stack_push(r.any());
                *k
            },
            Op::Eq { v, k } => {
                println!("vm_eq: v={}", v);
                let vv = self.stack_pop();
                println!("vm_eq: vv={}", vv);
                let r = if *v == vv { TRUE } else { FALSE };
                println!("vm_eq: r={}", r);
                self.stack_push(r.any());
                *k
            },
            Op::Cmp { op, k } => {
                println!("vm_cmp: op={}", op);
                let vv = self.stack_pop();
                println!("vm_cmp: vv={}", vv);
                let v = self.stack_pop();
                println!("vm_cmp: v={}", v);
                let b = if *op == Cmp::Eq {
                    v == vv
                } else if *op == Cmp::Ne {
                    v != vv
                } else {
                    match (Fix::from(v), Fix::from(vv)) {
                        (Some(n), Some(nn)) => {
                            match op {
                                Cmp::Ge => n.num() >= nn.num(),
                                Cmp::Gt => n.num() > nn.num(),
                                Cmp::Lt => n.num() < nn.num(),
                                Cmp::Le => n.num() <= nn.num(),
                                _ => false,
                            }
                        }
                        _ => false
                    }
                };
                let r = if b { TRUE } else { FALSE };
                println!("vm_cmp: r={}", r);
                self.stack_push(r.any());
                *k
            },
            Op::If { t, f } => {
                let b = self.stack_pop().any();
                println!("vm_if: b={}", b);
                println!("vm_if: t={}", t);
                println!("vm_if: f={}", f);
                if falsey(b) { *f } else { *t }
            },
            Op::Msg { n, k } => {
                println!("vm_msg: idx={}", n);
                let r = match self.typed(self.ep()) {
                    Typed::Event { msg, .. } => {
                        let lst = *msg;
                        println!("vm_msg: lst={}", lst);
                        let r = self.extract_nth(lst, n.num());
                        r
                    },
                    _ => UNDEF,
                };
                println!("vm_msg: r={}", r);
                self.stack_push(r.any());
                *k
            },
            Op::My { op, k } => {
                println!("vm_my: op={}", op);
                let me = self.self_ptr();
                println!("vm_my: me={} -> {}", me, self.ram(me));
                match op {
                    My::Addr => {
                        let ep = self.ep();
                        let target = self.ram(ep.any()).get_x();
                        println!("vm_my: self={}", target);
                        self.stack_push(target.any());
                    },
                    My::Beh => {
                        let beh = self.ram(me).get_x();
                        println!("vm_my: beh={}", beh);
                        self.stack_push(beh.any());
                    },
                    My::State => {
                        let state = self.ram(me).get_y();
                        println!("vm_my: state={}", state);
                        self.push_list(state.ptr());
                    },
                }
                *k
            }
            Op::Send { n, k } => {
                println!("vm_send: idx={}", n);
                let num = n.num();
                let target = self.stack_pop();
                println!("vm_send: target={}", target);
                assert!(self.typeq(ACTOR_T, target.any()));
                let msg = if num > 0 {
                    self.pop_counted(num)
                } else {
                    self.stack_pop()
                };
                println!("vm_send: msg={}", msg);
                let ep = self.new_event(target.cap(), msg);
                let me = self.self_ptr();
                println!("vm_send: me={} -> {}", me, self.ram(me));
                let next = self.ram(me).z();
                if next.is_ram() {
                    self.ram_mut(ep).set_z(next);
                    println!("vm_send: ep={} -> {}", ep, self.mem(ep));
                }
                self.ram_mut(me).set_z(ep);
                println!("vm_send: me'={} -> {}", me, self.mem(me));
                *k
            },
            Op::New { n, k } => {
                println!("vm_new: idx={}", n);
                let num = n.num();
                let ip = self.stack_pop();
                println!("vm_new: ip={}", ip);
                assert!(self.typeq(INSTR_T, ip.any()));
                let sp = self.pop_counted(num);
                println!("vm_new: sp={}", sp);
                let a = self.new_actor(ip.any(), sp.any());
                println!("vm_new: actor={}", a);
                self.stack_push(a);
                *k
            },
            Op::Beh { n, k } => {
                println!("vm_beh: idx={}", n);
                let num = n.num();
                let ip = self.stack_pop();
                println!("vm_beh: ip={}", ip);
                assert!(self.typeq(INSTR_T, ip.any()));
                let sp = self.pop_counted(num);
                println!("vm_beh: sp={}", sp);
                let me = self.self_ptr();
                let actor = self.ram_mut(me);
                println!("vm_beh: me={} -> {}", me, actor);
                actor.set_x(ip.any());  // replace behavior function
                actor.set_y(ip.any());  // replace state data
                println!("vm_beh: me'={} -> {}", me, self.ram(me));
                *k
            },
            Op::End { op } => {
                println!("vm_end: op={}", op);
                let me = self.self_ptr();
                println!("vm_my: me={} -> {}", me, self.ram(me));
                match op {
                    End::Abort => {
                        let _r = self.stack_pop();  // reason for abort
                        println!("vm_end: reason={}", _r);
                        self.actor_abort(me);
                        //UNDEF.ptr()
                        panic!("End::Abort should signal controller")
                    },
                    End::Stop => {
                        //UNIT.ptr()
                        panic!("End::Stop terminated continuation")
                    },
                    End::Commit => {
                        self.actor_commit(me);
                        TRUE.ptr()
                    },
                    End::Release => {
                        self.ram_mut(me).set_y(NIL.any());  // no retained stack
                        self.actor_commit(me);
                        self.free(me);  // free actor
                        FALSE.ptr()
                    },
                }
            },
            Op::IsEq { v, k } => {
                println!("vm_is_eq: expect={}", v);
                let vv = self.stack_pop();
                println!("vm_is_eq: actual={}", vv);
                assert_eq!(*v, vv);
                *k
            },
            Op::IsNe { v, k } => {
                println!("vm_is_ne: expect={}", v);
                let vv = self.stack_pop();
                println!("vm_is_ne: actual={}", vv);
                assert_ne!(*v, vv);
                *k
            },
        }
    }

    fn event_enqueue(&mut self, ep: Any) {
        self.ram_mut(ep).set_z(NIL.any());
        if !self.e_first().is_ram() {
            self.set_e_first(ep);
        } else if self.e_last().is_ram() {
            self.ram_mut(self.e_last()).set_z(ep);
        }
        self.set_e_last(ep);
    }
    fn event_dequeue(&mut self) -> Option<Any> {
        let ep = self.e_first();
        if ep.is_ram() {
            let event = self.ram(ep);
            let next = event.z();
            self.set_e_first(next);
            if !next.is_ram() {
                self.set_e_last(NIL.any())
            }
            Some(ep)
        } else {
            None
        }
    }

    fn cont_enqueue(&mut self, kp: Any) {
        self.ram_mut(kp).set_z(NIL.any());
        if !self.k_first().is_ram() {
            self.set_k_first(kp);
        } else if self.k_last().is_ram() {
            self.ram_mut(self.k_last()).set_z(kp);
        }
        self.set_k_last(kp);
    }
    fn cont_dequeue(&mut self) -> Option<Any> {
        let kp = self.k_first();
        if kp.is_ram() {
            let cont = self.ram(kp);
            let next = cont.z();
            self.set_k_first(next);
            if !next.is_ram() {
                self.set_k_last(NIL.any())
            }
            Some(kp)
        } else {
            None
        }
    }

    fn actor_commit(&mut self, me: Any) {
        let state = self.ram(me).y();
        self.stack_clear(state);
        // move sent-message events to event queue
        let mut ep = self.ram(me).get_z().any();
        while ep.is_ram() {
            let event = self.ram(ep);
            println!("actor_commit: ep={} -> {}", ep, event);
            let next = event.get_z().any();
            self.event_enqueue(ep);
            ep = next;
        }
        // end actor transaction
        self.ram_mut(me).set_z(UNDEF.any());
    }
    fn actor_abort(&mut self, me: Any) {
        let state = self.ram(me).y();
        self.stack_clear(state);
        // free sent-message events
        let mut ep = self.ram(me).get_z().any();
        while ep.is_ram() {
            let event = self.ram(ep);
            println!("actor_abort: ep={} -> {}", ep, event);
            let next = event.get_z().any();
            self.free(ep);
            ep = next;
        }
        // end actor transaction
        self.ram_mut(me).set_z(UNDEF.any());
    }
    fn self_ptr(&self) -> Any {
        let ep = self.ep().any();
        let target = self.ram(ep).x();
        let a_ptr = self.cap_to_ptr(target);
        a_ptr
    }

    fn push_list(&mut self, ptr: Ptr) {
        if let Typed::Pair { car, cdr } = *self.typed(ptr) {
            self.push_list(cdr.ptr());
            self.stack_push(car.any());
        }
    }
    fn pop_counted(&mut self, num: Num) -> Val {
        let mut n = num;
        if n > 0 {  // build list from stack
            let sp = self.sp().val();
            let mut v = sp;
            let mut p = UNDEF.ptr();
            while n > 0 && self.typeq(PAIR_T, v.any()) {
                p = v.ptr();
                v = self.cdr(p.any());
                n -= 1;
            }
            if self.typeq(PAIR_T, p.any()) {
                self.set_cdr(p.any(), NIL.any());
            }
            self.set_sp(v.any());
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
        while n > 1 && self.typeq(PAIR_T, p.any()) {
            q = p;
            p = self.cdr(p.any());
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
            while self.typeq(PAIR_T, p.any()) {
                n -= 1;
                if n <= 0 { break; }
                p = self.cdr(p.any());
            }
            if n == 0 {
                v = self.car(p.any());
            }
        } else {  // `-n` selects the n-th tail
            assert!(n > -64);
            while self.typeq(PAIR_T, p.any()) {
                n += 1;
                if n >= 0 { break; }
                p = self.cdr(p.any());
            }
            if n == 0 {
                v = self.cdr(p.any());
            }
        }
        v
    }

    pub fn dict_has(&self, dict: Ptr, key: Val) -> bool {
        let mut d = dict;
        while let Typed::Dict { key: k, next, .. } = *self.typed(d) {
            if key == k {
                return true
            }
            d = next;
        }
        false
    }
    pub fn dict_get(&self, dict: Ptr, key: Val) -> Val {
        let mut d = dict;
        while let Typed::Dict { key: k, value, next } = *self.typed(d) {
            if key == k {
                return value
            }
            d = next;
        }
        UNDEF
    }
    pub fn dict_add(&mut self, dict: Ptr, key: Val, value: Val) -> Ptr {
        let dict = Quad::dict_t(key.any(), value.any(), dict.any());
        self.alloc(&dict).val().ptr()
    }
    pub fn dict_set(&mut self, dict: Ptr, key: Val, value: Val) -> Ptr {
        let d = if self.dict_has(dict, key) {
            self.dict_del(dict, key)
        } else {
            dict
        };
        self.dict_add(d, key, value)
    }
    pub fn dict_del(&mut self, dict: Ptr, key: Val) -> Ptr {
        let typed = *self.typed(dict);
        if let Typed::Dict { key: k, value, next } = typed {
            if key == k {
                next
            } else {
                let d = self.dict_del(next, key);
                self.dict_add(d, k, value)
            }
        } else {
            NIL.ptr()
        }
    }

    pub fn deque_new(&mut self) -> Ptr {
        DQ_EMPTY
    }
    pub fn deque_empty(&self, deque: Ptr) -> bool {
        if let Typed::Pair { car: front, cdr: back } = *self.typed(deque) {
            !self.typeq(PAIR_T, front.any()) && !self.typeq(PAIR_T, back.any())
        } else {
            true  // default = empty
        }
    }
    pub fn deque_push(&mut self, deque: Ptr, item: Val) -> Ptr {
        let front = self.cons(item.any(), self.car(deque.any()).any());
        self.cons(front.any(), self.cdr(deque.any()).any())
    }
    pub fn deque_pop(&mut self, deque: Ptr) -> (Ptr, Val) {
        if let Typed::Pair { car, cdr } = *self.typed(deque) {
            let mut front = car;
            let mut back = cdr;
            if !self.typeq(PAIR_T, front.any()) {
                if self.typeq(PAIR_T, back.any()) {
                    // transfer back to front
                    while let Typed::Pair { car: item, cdr: rest } = *self.typed(back.ptr()) {
                        front = self.cons(item.any(), front.any()).val();
                        back = rest;
                    }
                } else {
                    return (deque, UNDEF)
                }
            }
            if let Typed::Pair { car: item, cdr: rest } = *self.typed(front.ptr()) {
                let new = self.cons(rest.any(), back.any());
                (new, item)
            } else {
                (deque, UNDEF)
            }
        } else {
            (deque, UNDEF)
        }
    }
    pub fn deque_put(&mut self, deque: Ptr, item: Val) -> Ptr {
        let back = self.cons(item.any(), self.cdr(deque.any()).any());
        self.cons(self.car(deque.any()).any(), back.any())
    }
    pub fn deque_pull(&mut self, deque: Ptr) -> (Ptr, Val) {
        if let Typed::Pair { car, cdr } = *self.typed(deque) {
            let mut front = car;
            let mut back = cdr;
            if !self.typeq(PAIR_T, back.any()) {
                if self.typeq(PAIR_T, front.any()) {
                    // transfer front to back
                    while let Typed::Pair { car: item, cdr: rest } = *self.typed(front.ptr()) {
                        back = self.cons(item.any(), back.any()).val();
                        front = rest;
                    }
                } else {
                    return (deque, UNDEF)
                }
            }
            if let Typed::Pair { car: item, cdr: rest } = *self.typed(back.ptr()) {
                let new = self.cons(front.any(), rest.any());
                (new, item)
            } else {
                (deque, UNDEF)
            }
        } else {
            (deque, UNDEF)
        }
    }
    pub fn deque_len(&self, deque: Ptr) -> isize {
        let mut n = 0;
        let mut p = self.car(deque.any());
        while self.typeq(PAIR_T, p.any()) {
            n += 1;
            p = self.cdr(p.any());
        }
        let mut q = self.cdr(deque.any());
        while self.typeq(PAIR_T, q.any()) {
            n += 1;
            q = self.cdr(q.any());
        }
        n
    }

    fn e_first(&self) -> Any {
        self.ram(DDEQUE).t()
    }
    fn set_e_first(&mut self, ptr: Any) {
        self.ram_mut(DDEQUE).set_t(ptr);
    }
    fn e_last(&self) -> Any {
        self.ram(DDEQUE).x()
    }
    fn set_e_last(&mut self, ptr: Any) {
        self.ram_mut(DDEQUE).set_x(ptr);
    }
    fn k_first(&self) -> Any {
        self.ram(DDEQUE).y()
    }
    fn set_k_first(&mut self, ptr: Any) {
        self.ram_mut(DDEQUE).set_y(ptr);
    }
    fn k_last(&self) -> Any {
        self.ram(DDEQUE).z()
    }
    fn set_k_last(&mut self, ptr: Any) {
        self.ram_mut(DDEQUE).set_z(ptr);
    }

    fn mem_top(&self) -> Any {
        self.ram(MEMORY).t()
    }
    fn set_mem_top(&mut self, ptr: Any) {
        self.ram_mut(MEMORY).set_t(ptr);
    }
    fn mem_next(&self) -> Any {
        self.ram(MEMORY).x()
    }
    fn set_mem_next(&mut self, ptr: Any) {
        self.ram_mut(MEMORY).set_x(ptr);
    }
    fn mem_free(&self) -> Any {
        self.ram(MEMORY).y()
    }
    fn set_mem_free(&mut self, fix: Any) {
        self.ram_mut(MEMORY).set_y(fix);
    }
    fn _mem_root(&self) -> Any {
        self.ram(MEMORY).z()
    }
    fn _set_mem_root(&mut self, ptr: Any) {
        self.ram_mut(MEMORY).set_z(ptr);
    }

    pub fn new_event(&mut self, target: Cap, msg: Val) -> Any {
        let event = Quad::event_t(target.any(), msg.any(), NIL.any());
        self.alloc(&event)
    }
    pub fn new_cont(&mut self, ip: Any, sp: Any, ep: Any) -> Any {
        let cont = Quad::cont_t(ip, sp, ep, NIL.any());
        self.alloc(&cont)
    }
    pub fn new_actor(&mut self, beh: Any, state: Any) -> Any {
        let actor = Quad::new_actor(beh, state);
        let ptr = self.alloc(&actor);
        self.ptr_to_cap(ptr)
    }

    fn stack_push(&mut self, val: Any) {
        let sp = self.cons(val, self.sp().any());
        self.set_sp(sp.any());
    }
    fn stack_pop(&mut self) -> Val {
        let sp = self.sp().any();
        if self.typeq(PAIR_T, sp) {
            let item = self.car(sp);
            self.set_sp(self.cdr(sp).any());
            self.free(sp);  // free pair holding stack item
            item
        } else {
            println!("stack_pop: underflow!");
            UNDEF
        }
    }
    fn stack_clear(&mut self, top: Any) {
        let mut sp = self.sp().any();
        while sp != top && self.typeq(PAIR_T, sp) {
            let p = sp;
            sp = self.cdr(p).any();
            self.free(p);  // free pair holding stack item
        }
        self.set_sp(sp);
    }
    fn stack_dup(&mut self, num: Num) {
        let mut n = num;
        if n > 0 {
            let mut s = self.sp().any();
            let sp = self.cons(self.car(s).any(), NIL.any()).any();
            let mut p = sp;
            s = self.cdr(s).any();
            n -= 1;
            while n > 0 {
                let q = self.cons(self.car(s).any(), NIL.any()).any();
                self.set_cdr(p, q);
                p = q;
                s = self.cdr(s).any();
                n -= 1;
            }
            self.set_cdr(p, self.sp().any());
            self.set_sp(sp);
        }
    }

    pub fn cons(&mut self, car: Any, cdr: Any) -> Ptr {
        let pair = Quad::pair_t(car, cdr);
        self.alloc(&pair).val().ptr()  // FIXME: should return `Any`
    }
    pub fn car(&self, pair: Any) -> Val {
        if self.typeq(PAIR_T, pair) {
            self.mem(pair).x().val()  // FIXME: should return `Any`
        } else {
            UNDEF
        }
    }
    pub fn cdr(&self, pair: Any) -> Val {
        if self.typeq(PAIR_T, pair) {
            self.mem(pair).y().val()  // FIXME: should return `Any`
        } else {
            UNDEF
        }
    }
    fn _set_car(&mut self, pair: Any, val: Any) {
        assert!(self.in_heap(pair));
        assert!(self.ram(pair).t() == PAIR_T.any());
        self.ram_mut(pair).set_x(val);
    }
    fn set_cdr(&mut self, pair: Any, val: Any) {
        assert!(self.in_heap(pair));
        assert!(self.ram(pair).t() == PAIR_T.any());
        self.ram_mut(pair).set_y(val);
    }

    pub fn ip(&self) -> Ptr {  // instruction pointer
        let quad = self.ram(self.k_first());
        quad.t().val().ptr()  // FIXME: should return Any...
    }
    pub fn sp(&self) -> Ptr {  // stack pointer
        let quad = self.ram(self.k_first());
        quad.x().val().ptr()  // FIXME: should return Any...
    }
    pub fn ep(&self) -> Ptr {  // event pointer
        let quad = self.ram(self.k_first());
        quad.y().val().ptr()  // FIXME: should return Any...
    }
    fn set_ip(&mut self, ptr: Any) {
        let quad = self.ram_mut(self.k_first());
        quad.set_t(ptr)
    }
    fn set_sp(&mut self, ptr: Any) {
        let quad = self.ram_mut(self.k_first());
        quad.set_x(ptr)
    }

    pub fn typeq(&self, typ: Val, val: Any) -> bool {
        if typ == FIXNUM_T {
            val.is_fix()
        } else if typ == ACTOR_T {
            if val.is_cap() {
                let ptr = Any::ram(val.addr());  // WARNING: converting Cap to Ptr!
                self.ram(ptr).t() == ACTOR_T.any()
            } else {
                false
            }
        } else if val.is_ptr() {
            self.mem(val).t() == typ.any()
        } else {
            false
        }
    }
    pub fn in_heap(&self, val: Any) -> bool {
        val.is_ram() && (val.addr() < self.mem_top().addr())
    }
    fn ptr_to_cap(&self, ptr: Any) -> Any {
        assert!(self.ram(ptr).t() == ACTOR_T.any());
        let cap = Any::cap(ptr.addr());
        cap
    }
    fn cap_to_ptr(&self, cap: Any) -> Any {
        let ptr = Any::ram(cap.addr());
        assert!(self.ram(ptr).t() == ACTOR_T.any());
        ptr
    }

    pub fn alloc(&mut self, quad: &Quad) -> Any {
        let next = self.mem_next();
        let ptr = if self.typeq(FREE_T, next) {
            // use quad from free-list
            let n = self.mem_free().fix_num().unwrap();
            assert!(n > 0);  // number of free cells available
            self.set_mem_free(Any::fix(n - 1));  // decrement cells available
            self.set_mem_next(self.ram(next).z());  // update free-list
            next
        } else {
            // expand top-of-memory
            let next = self.mem_top();
            let top = next.addr();
            if top >= QUAD_MAX {
                panic!("out of memory!");
            }
            self.set_mem_top(Any::ram(top + 1));
            next
        };
        *self.ram_mut(ptr) = *quad;  // copy initial value
        ptr
    }
    pub fn free(&mut self, ptr: Any) {
        assert!(self.in_heap(ptr));
        if self.typeq(FREE_T, ptr) {
            panic!("double-free {}", ptr);
        }
        *self.ram_mut(ptr) = Quad::free_t(self.mem_next());  // clear cell to "free"
        self.set_mem_next(ptr);  // link into free-list
        let n = self.mem_free().fix_num().unwrap();
        self.set_mem_free(Any::fix(n + 1));  // increment cells available
    }

    pub fn mem(&self, ptr: Any) -> &Quad {
        if !ptr.is_ptr() {
            panic!("invalid ptr=${:08x}", ptr.raw());
        }
        if ptr.is_ram() {
            self.ram(ptr)
        } else {
            self.rom(ptr)
        }
    }
    pub fn rom(&self, ptr: Any) -> &Quad {
        if !ptr.is_rom() {
            panic!("invalid ROM ptr=${:08x}", ptr.raw());
        }
        let addr = ptr.addr();
        &self.quad_rom[addr]
    }
    pub fn ram(&self, ptr: Any) -> &Quad {
        if !ptr.is_ram() {
            panic!("invalid RAM ptr=${:08x}", ptr.raw());
        }
        let addr = ptr.addr();
        &self.quad_ram[addr]
    }
    pub fn ram_mut(&mut self, ptr: Any) -> &mut Quad {
        if !ptr.is_ram() {
            panic!("invalid RAM ptr=${:08x}", ptr.raw());
        }
        let addr = ptr.addr();
        &mut self.quad_ram[addr]
    }

    pub fn typed(&self, ptr: Ptr) -> &Typed {
        let addr = ptr.addr();  // FIXME! CONFLATES ROM AND RAM!!
        &self.quad_mem[addr]
    }
    pub fn typed_mut(&mut self, ptr: Ptr) -> &mut Typed {
        assert!(self.in_heap(ptr.any()));
        let addr = ptr.addr();
        &mut self.quad_mem[addr]
    }

    pub fn next(&self, ptr: Ptr) -> Ptr {
        let typed = *self.typed(ptr);
        match typed {
            Typed::Event { next, .. } => next,
            Typed::Cont { next, .. } => next,
            Typed::Dict { next, .. } => next,
            Typed::Free { next } => next,
            Typed::Quad { z, .. } => z.ptr(),
            Typed::Instr { op: Op::Typeq { k, .. } } => k,
            Typed::Instr { op: Op::Dict { k, .. } } => k,
            Typed::Instr { op: Op::Deque { k, .. } } => k,
            Typed::Instr { op: Op::Pair { k, .. } } => k,
            Typed::Instr { op: Op::Part { k, .. } } => k,
            Typed::Instr { op: Op::Nth { k, .. } } => k,
            Typed::Instr { op: Op::Push { k, .. } } => k,
            Typed::Instr { op: Op::Depth { k } } => k,
            Typed::Instr { op: Op::Drop { k, .. } } => k,
            Typed::Instr { op: Op::Pick { k, .. } } => k,
            Typed::Instr { op: Op::Dup { k, .. } } => k,
            Typed::Instr { op: Op::Roll { k, .. } } => k,
            Typed::Instr { op: Op::Alu { k, .. } } => k,
            Typed::Instr { op: Op::Eq { k, .. } } => k,
            Typed::Instr { op: Op::Cmp { k, .. } } => k,
            //Typed::Instr { op: Op::If { f, .. } } => f,
            Typed::Instr { op: Op::Msg { k, .. } } => k,
            Typed::Instr { op: Op::My { k, .. } } => k,
            Typed::Instr { op: Op::Send { k, .. } } => k,
            Typed::Instr { op: Op::New { k, .. } } => k,
            Typed::Instr { op: Op::Beh { k, .. } } => k,
            //Typed::Instr { op: Op::End { .. } } => UNDEF.ptr(),
            //Typed::Instr { op: Op::IsEq { k, .. } } => k,
            //Typed::Instr { op: Op::IsNe { k, .. } } => k,
            _ => UNDEF.ptr(),
        }
    }
}

fn falsey(v: Any) -> bool {
    v == FALSE.any() || v == UNDEF.any() || v == NIL.any() || v == ZERO
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
    //Fexpr { func: Ptr },
    Dict { key: Val, value: Val, next: Ptr },
    Free { next: Ptr },
    Ddeque { e_first: Ptr, e_last: Ptr, k_first: Ptr, k_last: Ptr },
    Memory { top: Ptr, next: Ptr, free: Fix, root: Ptr },
    Quad { t: Val, x: Val, y: Val, z: Val },
}
impl Typed {
    pub fn from(quad: &Quad) -> Option<Typed> {
        match quad.get_t() {
            LITERAL_T => Some(Typed::Literal),
            TYPE_T => Some(Typed::Type),
            EVENT_T => Some(Typed::Event { target: quad.get_x().cap(), msg: quad.get_y(), next: quad.get_z().ptr() }),
            INSTR_T => Op::from(quad),
            ACTOR_T => Some(Typed::Actor { beh: quad.get_x().ptr(), state: quad.get_y().ptr(), events: match quad.get_z() {
                UNDEF => None,
                val => Some(val.ptr()),
            }}),
            SYMBOL_T => Some(Typed::Symbol { hash: quad.get_x().fix(), key: quad.get_y().ptr(), val: quad.get_z() }),
            PAIR_T => Some(Typed::Pair { car: quad.get_x(), cdr: quad.get_y() }),
            //FEXPR_T => Some(Typed::Fexpr { func: quad.x().ptr() }),
            DICT_T => Some(Typed::Dict { key: quad.get_x(), value: quad.get_y(), next: quad.get_z().ptr() }),
            FREE_T => Some(Typed::Free { next: quad.get_z().ptr() }),
            _ => Some(Typed::Quad { t: quad.get_t(), x: quad.get_x(), y: quad.get_y(), z: quad.get_z() }),
        }
    }
    pub fn quad(&self) -> Quad {
        match self {
            Typed::Empty => Quad::init(UNDEF, UNDEF, UNDEF, UNDEF),
            Typed::Literal => Quad::init(LITERAL_T, UNDEF, UNDEF, UNDEF),
            Typed::Type => Quad::init(TYPE_T, UNDEF, UNDEF, UNDEF),
            Typed::Event { target, msg, next } => Quad::init(EVENT_T, target.val(), msg.val(), next.val()),
            Typed::Cont { ip, sp, ep, next } => Quad::init(ip.val(), sp.val(), ep.val(), next.val()),
            Typed::Instr { op } => op.quad(),
            Typed::Actor { beh, state, events } => Quad::init(ACTOR_T, beh.val(), state.val(), match events {
                None => UNDEF,
                Some(ptr) => ptr.val(),
            }),
            Typed::Symbol { hash, key, val } => Quad::init(SYMBOL_T, hash.val(), key.val(), val.val()),
            Typed::Pair { car, cdr } => Quad::init(PAIR_T, car.val(), cdr.val(), UNDEF),
            //Typed::Fexpr { func } => Quad::new(FEXPR_T, func.val(), UNDEF, UNDEF),
            Typed::Dict { key, value, next } => Quad::init(DICT_T, key.val(), value.val(), next.val()),
            Typed::Free { next } => Quad::init(FREE_T, UNDEF, UNDEF, next.val()),
            Typed::Ddeque { e_first, e_last, k_first, k_last } => Quad::init(e_first.val(), e_last.val(), k_first.val(), k_last.val()),
            Typed::Memory { top, next, free, root } => Quad::init(top.val(), next.val(), free.val(), root.val()),
            Typed::Quad { t, x, y, z } => Quad::init(t.val(), x.val(), y.val(), z.val()),
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
            //Typed::Fexpr { func } => write!(fmt, "Fexpr{{ func:{} }}", func),
            Typed::Dict { key, value, next } => write!(fmt, "Dict{{ key:{}, value:{}, next:{} }}", key, value, next),
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
    //Quad { n: Fix, k: Ptr },
    //Get { f: Field, k: Ptr },
    //Set { f: Field, k: Ptr },  // **DEPRECATED**
    Dict { op: Dict, k: Ptr },
    Deque { op: Deque, k: Ptr },
    Pair { n: Fix, k: Ptr },
    Part { n: Fix, k: Ptr },
    Nth { n: Fix, k: Ptr },
    Push { v: Val, k: Ptr },
    Depth { k: Ptr },
    Drop { n: Fix, k: Ptr },
    Pick { n: Fix, k: Ptr },
    Dup { n: Fix, k: Ptr },
    Roll { n: Fix, k: Ptr },
    Alu { op: Alu, k: Ptr },
    Eq { v: Val, k: Ptr },
    Cmp { op: Cmp, k: Ptr },
    If { t: Ptr, f: Ptr },
    Msg { n: Fix, k: Ptr },
    My { op: My, k: Ptr },
    Send { n: Fix, k: Ptr },
    New { n: Fix, k: Ptr },
    Beh { n: Fix, k: Ptr },
    End { op: End },
    IsEq { v: Val, k: Ptr },
    IsNe { v: Val, k: Ptr },
}
impl Op {
    pub fn from(quad: &Quad) -> Option<Typed> {
        assert!(quad.get_t() == INSTR_T);
        match quad.get_x() {
            VM_TYPEQ => Some(Typed::Instr { op: Op::Typeq { t: quad.get_y().ptr(), k: quad.get_z().ptr() } }),
            VM_DICT => Some(Typed::Instr { op: Op::Dict { op: Dict::from(quad.get_y()).unwrap(), k: quad.get_z().ptr() } }),
            VM_DEQUE => Some(Typed::Instr { op: Op::Deque { op: Deque::from(quad.get_y()).unwrap(), k: quad.get_z().ptr() } }),
            VM_PAIR => Some(Typed::Instr { op: Op::Pair { n: quad.get_y().fix(), k: quad.get_z().ptr() } }),
            VM_PART => Some(Typed::Instr { op: Op::Part { n: quad.get_y().fix(), k: quad.get_z().ptr() } }),
            VM_NTH => Some(Typed::Instr { op: Op::Nth { n: quad.get_y().fix(), k: quad.get_z().ptr() } }),
            VM_PUSH => Some(Typed::Instr { op: Op::Push { v: quad.get_y().val(), k: quad.get_z().ptr() } }),
            VM_DEPTH => Some(Typed::Instr { op: Op::Depth { k: quad.get_z().ptr() } }),
            VM_DROP => Some(Typed::Instr { op: Op::Drop { n: quad.get_y().fix(), k: quad.get_z().ptr() } }),
            VM_PICK => Some(Typed::Instr { op: Op::Pick { n: quad.get_y().fix(), k: quad.get_z().ptr() } }),
            VM_DUP => Some(Typed::Instr { op: Op::Dup { n: quad.get_y().fix(), k: quad.get_z().ptr() } }),
            VM_ROLL => Some(Typed::Instr { op: Op::Roll { n: quad.get_y().fix(), k: quad.get_z().ptr() } }),
            VM_ALU => Some(Typed::Instr { op: Op::Alu { op: Alu::from(quad.get_y()).unwrap(), k: quad.get_z().ptr() } }),
            VM_EQ => Some(Typed::Instr { op: Op::Eq { v: quad.get_y().val(), k: quad.get_z().ptr() } }),
            VM_CMP => Some(Typed::Instr { op: Op::Cmp { op: Cmp::from(quad.get_y()).unwrap(), k: quad.get_z().ptr() } }),
            VM_IF => Some(Typed::Instr { op: Op::If { t: quad.get_y().ptr(), f: quad.get_z().ptr() } }),
            VM_MSG => Some(Typed::Instr { op: Op::Msg { n: quad.get_y().fix(), k: quad.get_z().ptr() } }),
            VM_MY => Some(Typed::Instr { op: Op::My { op: My::from(quad.get_y()).unwrap(), k: quad.get_z().ptr() } }),
            VM_SEND => Some(Typed::Instr { op: Op::Send { n: quad.get_y().fix(), k: quad.get_z().ptr() } }),
            VM_NEW => Some(Typed::Instr { op: Op::New { n: quad.get_y().fix(), k: quad.get_z().ptr() } }),
            VM_BEH => Some(Typed::Instr { op: Op::Beh { n: quad.get_y().fix(), k: quad.get_z().ptr() } }),
            VM_END => Some(Typed::Instr { op: Op::End { op: End::from(quad.get_y()).unwrap() } }),
            VM_IS_EQ => Some(Typed::Instr { op: Op::IsEq { v: quad.get_y().val(), k: quad.get_z().ptr() } }),
            VM_IS_NE => Some(Typed::Instr { op: Op::IsNe { v: quad.get_y().val(), k: quad.get_z().ptr() } }),
            _ => None,
        }
    }
    pub fn quad(&self) -> Quad {
        match self {
            Op::Typeq { t, k } => Quad::init(INSTR_T, VM_TYPEQ, t.val(), k.val()),
            Op::Dict { op, k } => Quad::init(INSTR_T, VM_DICT, op.val(), k.val()),
            Op::Deque { op, k } => Quad::init(INSTR_T, VM_DEQUE, op.val(), k.val()),
            Op::Pair { n, k } => Quad::init(INSTR_T, VM_PAIR, n.val(), k.val()),
            Op::Part { n, k } => Quad::init(INSTR_T, VM_PART, n.val(), k.val()),
            Op::Nth { n, k } => Quad::init(INSTR_T, VM_NTH, n.val(), k.val()),
            Op::Push { v, k } => Quad::init(INSTR_T, VM_PUSH, v.val(), k.val()),
            Op::Depth { k } => Quad::init(INSTR_T, VM_DEPTH, UNDEF, k.val()),
            Op::Drop { n, k } => Quad::init(INSTR_T, VM_DROP, n.val(), k.val()),
            Op::Pick { n, k } => Quad::init(INSTR_T, VM_PICK, n.val(), k.val()),
            Op::Dup { n, k } => Quad::init(INSTR_T, VM_DUP, n.val(), k.val()),
            Op::Roll { n, k } => Quad::init(INSTR_T, VM_ROLL, n.val(), k.val()),
            Op::Alu { op, k } => Quad::init(INSTR_T, VM_ALU, op.val(), k.val()),
            Op::Eq { v, k } => Quad::init(INSTR_T, VM_EQ, v.val(), k.val()),
            Op::Cmp { op, k } => Quad::init(INSTR_T, VM_CMP, op.val(), k.val()),
            Op::If { t, f } => Quad::init(INSTR_T, VM_IF, t.val(), f.val()),
            Op::Msg { n, k } => Quad::init(INSTR_T, VM_MSG, n.val(), k.val()),
            Op::My { op, k } => Quad::init(INSTR_T, VM_MY, op.val(), k.val()),
            Op::Send { n, k } => Quad::init(INSTR_T, VM_SEND, n.val(), k.val()),
            Op::New { n, k } => Quad::init(INSTR_T, VM_NEW, n.val(), k.val()),
            Op::Beh { n, k } => Quad::init(INSTR_T, VM_BEH, n.val(), k.val()),
            Op::End { op } => Quad::init(INSTR_T, VM_END, op.val(), UNDEF),
            Op::IsEq { v, k } => Quad::init(INSTR_T, VM_IS_EQ, v.val(), k.val()),
            Op::IsNe { v, k } => Quad::init(INSTR_T, VM_IS_NE, v.val(), k.val()),
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
            Op::Dict { op, k } => write!(fmt, "Dict{{ op:{}, k:{} }}", op, k),
            Op::Deque { op, k } => write!(fmt, "Deque{{ op:{}, k:{} }}", op, k),
            Op::Pair { n, k } => write!(fmt, "Pair{{ n:{}, k:{} }}", n, k),
            Op::Part { n, k } => write!(fmt, "Part{{ n:{}, k:{} }}", n, k),
            Op::Nth { n, k } => write!(fmt, "Nth{{ n:{}, k:{} }}", n, k),
            Op::Push { v, k } => write!(fmt, "Push{{ v:{}, k:{} }}", v, k),
            Op::Depth { k } => write!(fmt, "Depth{{ k:{} }}", k),
            Op::Drop { n, k } => write!(fmt, "Drop{{ n:{}, k:{} }}", n, k),
            Op::Pick { n, k } => write!(fmt, "Pick{{ n:{}, k:{} }}", n, k),
            Op::Dup { n, k } => write!(fmt, "Dup{{ n:{}, k:{} }}", n, k),
            Op::Roll { n, k } => write!(fmt, "Roll{{ n:{}, k:{} }}", n, k),
            Op::Alu { op, k } => write!(fmt, "Alu{{ op:{}, k:{} }}", op, k),
            Op::Eq { v, k } => write!(fmt, "Eq{{ v:{}, k:{} }}", v, k),
            Op::Cmp { op, k } => write!(fmt, "Cmp{{ op:{}, k:{} }}", op, k),
            Op::If { t, f } => write!(fmt, "If{{ t:{}, f:{} }}", t, f),
            Op::Msg { n, k } => write!(fmt, "Msg{{ n:{}, k:{} }}", n, k),
            Op::My { op, k } => write!(fmt, "My{{ op:{}, k:{} }}", op, k),
            Op::Send { n, k } => write!(fmt, "Send{{ n:{}, k:{} }}", n, k),
            Op::New { n, k } => write!(fmt, "New{{ n:{}, k:{} }}", n, k),
            Op::Beh { n, k } => write!(fmt, "Beh{{ n:{}, k:{} }}", n, k),
            Op::End { op } => write!(fmt, "End{{ op:{} }}", op),
            Op::IsEq { v, k } => write!(fmt, "IsEq{{ v:{}, k:{} }}", v, k),
            Op::IsNe { v, k } => write!(fmt, "IsNe{{ v:{}, k:{} }}", v, k),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Dict {
    Has,
    Get,
    Add,
    Set,
    Del,
}
impl Dict {
    pub fn from(val: Val) -> Option<Dict> {
        match val {
            DICT_HAS => Some(Dict::Has),
            DICT_GET => Some(Dict::Get),
            DICT_ADD => Some(Dict::Add),
            DICT_SET => Some(Dict::Set),
            DICT_DEL => Some(Dict::Del),
            _ => None,
        }
    }
    pub fn val(&self) -> Val {
        match self {
            Dict::Has => DICT_HAS,
            Dict::Get => DICT_GET,
            Dict::Add => DICT_ADD,
            Dict::Set => DICT_SET,
            Dict::Del => DICT_DEL,
        }
    }
}
impl fmt::Display for Dict {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Dict::Has => write!(fmt, "Has"),
            Dict::Set => write!(fmt, "Set"),
            Dict::Add => write!(fmt, "Add"),
            Dict::Get => write!(fmt, "Get"),
            Dict::Del => write!(fmt, "Del"),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Deque {
    New,
    Empty,
    Push,
    Pop,
    Put,
    Pull,
    Len,
}
impl Deque {
    pub fn from(val: Val) -> Option<Deque> {
        match val {
            DEQUE_NEW => Some(Deque::New),
            DEQUE_EMPTY => Some(Deque::Empty),
            DEQUE_PUSH => Some(Deque::Push),
            DEQUE_POP => Some(Deque::Pop),
            DEQUE_PUT => Some(Deque::Put),
            DEQUE_PULL => Some(Deque::Pull),
            DEQUE_LEN => Some(Deque::Len),
            _ => None,
        }
    }
    pub fn val(&self) -> Val {
        match self {
            Deque::New => DEQUE_NEW,
            Deque::Empty => DEQUE_EMPTY,
            Deque::Push => DEQUE_PUSH,
            Deque::Pop => DEQUE_POP,
            Deque::Put => DEQUE_PUT,
            Deque::Pull => DEQUE_PULL,
            Deque::Len => DEQUE_LEN,
        }
    }
}
impl fmt::Display for Deque {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Deque::New => write!(fmt, "New"),
            Deque::Empty => write!(fmt, "Empty"),
            Deque::Push => write!(fmt, "Push"),
            Deque::Pop => write!(fmt, "Pop"),
            Deque::Put => write!(fmt, "Put"),
            Deque::Pull => write!(fmt, "Pull"),
            Deque::Len => write!(fmt, "Len"),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Alu {
    Not,
    And,
    Or,
    Xor,
    Add,
    Sub,
    Mul,
}
impl Alu {
    pub fn from(val: Val) -> Option<Alu> {
        match val {
            ALU_NOT => Some(Alu::Not),
            ALU_AND => Some(Alu::And),
            ALU_OR => Some(Alu::Or),
            ALU_XOR => Some(Alu::Xor),
            ALU_ADD => Some(Alu::Add),
            ALU_SUB => Some(Alu::Sub),
            ALU_MUL => Some(Alu::Mul),
            _ => None,
        }
    }
    pub fn val(&self) -> Val {
        match self {
            Alu::Not => ALU_NOT,
            Alu::And => ALU_AND,
            Alu::Or => ALU_OR,
            Alu::Xor => ALU_XOR,
            Alu::Add => ALU_ADD,
            Alu::Sub => ALU_SUB,
            Alu::Mul => ALU_MUL,
        }
    }
}
impl fmt::Display for Alu {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Alu::Not => write!(fmt, "Not"),
            Alu::And => write!(fmt, "And"),
            Alu::Or => write!(fmt, "Or"),
            Alu::Xor => write!(fmt, "Xor"),
            Alu::Add => write!(fmt, "Add"),
            Alu::Sub => write!(fmt, "Sub"),
            Alu::Mul => write!(fmt, "Mul"),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cmp {
    Eq,
    Ge,
    Gt,
    Lt,
    Le,
    Ne,
}
impl Cmp {
    pub fn from(val: Val) -> Option<Cmp> {
        match val {
            CMP_EQ => Some(Cmp::Eq),
            CMP_GE => Some(Cmp::Ge),
            CMP_GT => Some(Cmp::Gt),
            CMP_LT => Some(Cmp::Lt),
            CMP_LE => Some(Cmp::Le),
            CMP_NE => Some(Cmp::Ne),
            _ => None,
        }
    }
    pub fn val(&self) -> Val {
        match self {
            Cmp::Eq => CMP_EQ,
            Cmp::Ge => CMP_GE,
            Cmp::Gt => CMP_GT,
            Cmp::Lt => CMP_LT,
            Cmp::Le => CMP_LE,
            Cmp::Ne => CMP_NE,
        }
    }
}
impl fmt::Display for Cmp {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Cmp::Eq => write!(fmt, "Eq"),
            Cmp::Ge => write!(fmt, "Ge"),
            Cmp::Gt => write!(fmt, "Gt"),
            Cmp::Lt => write!(fmt, "Lt"),
            Cmp::Le => write!(fmt, "Le"),
            Cmp::Ne => write!(fmt, "Ne"),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum My {
    Addr,
    Beh,
    State,
}
impl My {
    pub fn from(val: Val) -> Option<My> {
        match val {
            MY_SELF => Some(My::Addr),
            MY_BEH => Some(My::Beh),
            MY_STATE => Some(My::State),
            _ => None,
        }
    }
    pub fn val(&self) -> Val {
        match self {
            My::Addr => MY_SELF,
            My::Beh => MY_BEH,
            My::State => MY_STATE,
        }
    }
}
impl fmt::Display for My {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            My::Addr => write!(fmt, "Self"),
            My::Beh => write!(fmt, "Beh"),
            My::State => write!(fmt, "State"),
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
    pub fn from(val: Val) -> Option<End> {
        match val {
            END_ABORT => Some(End::Abort),
            END_STOP => Some(End::Stop),
            END_COMMIT => Some(End::Commit),
            END_RELEASE => Some(End::Release),
            _ => None,
        }
    }
    pub fn val(&self) -> Val {
        match self {
            End::Abort => END_ABORT,
            End::Stop => END_STOP,
            End::Commit => END_COMMIT,
            End::Release => END_RELEASE,
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
    pub fn any(self) -> Any {  // NOTE: consumes `self`
        Any::new(self.raw)
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
    pub fn any(self) -> Any {  // NOTE: consumes `self`
        self.val().any()
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
        Ptr { raw: (raw & !(DIR_RAW | OPQ_RAW)) }
    }
    pub fn from(val: Val) -> Option<Ptr> {
        let raw = val.raw();
        if (raw & (DIR_RAW | OPQ_RAW)) == 0 {
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
    pub fn any(self) -> Any {  // NOTE: consumes `self`
        self.val().any()
    }
    pub fn raw(&self) -> Raw {
        self.raw
    }
    pub fn addr(&self) -> usize {
        (self.raw & !MSK_RAW) as usize
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
            //FEXPR_T => write!(fmt, "FEXPR_T"),
            DICT_T => write!(fmt, "DICT_T"),
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
        Cap { raw: (raw & !(DIR_RAW | OPQ_RAW)) }
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
    pub fn any(self) -> Any {  // NOTE: consumes `self`
        self.val().any()
    }
    pub fn raw(&self) -> Raw {
        self.raw
    }
    pub fn addr(&self) -> usize {
        (self.raw & !MSK_RAW) as usize
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
    //assert_eq!(0, core.mem_free().fix_num().unwrap());
    assert_eq!(Any::fix(0), core.mem_free());
    assert_eq!(NIL.any(), core.mem_next());
    assert_ne!(NIL.any(), core.e_first());
    assert_eq!(NIL.any(), core.k_first());
    for raw in 0..256 {
        let typed = core.typed(Ptr::new(raw));
        println!("{:5}: {} = {}", raw, typed.quad(), typed);
    }
    //assert!(false);  // force output to be displayed
}

#[test]
fn basic_memory_allocation() {
    let mut core = Core::new();
    let top_before = core.mem_top().addr();
    println!("mem_top: {}", core.mem_top());
    let m1 = core.alloc(&Quad::pair_t(Any::fix(1), Any::fix(1)));
    println!("m1:{} -> {}", m1, core.mem(m1));
    println!("mem_top: {}", core.mem_top());
    let m2 = core.alloc(&Quad::pair_t(Any::fix(2), Any::fix(2)));
    println!("mem_top: {}", core.mem_top());
    let m3 = core.alloc(&Quad::pair_t(Any::fix(3), Any::fix(3)));
    println!("mem_top: {}", core.mem_top());
    println!("mem_free: {}", core.mem_free());
    core.free(m2);
    println!("mem_free: {}", core.mem_free());
    core.free(m3);
    println!("mem_free: {}", core.mem_free());
    let _m4 = core.alloc(&Quad::pair_t(Any::fix(4), Any::fix(4)));
    println!("mem_top: {}", core.mem_top());
    println!("mem_free: {}", core.mem_free());
    let top_after = core.mem_top().addr();
    assert_eq!(3, top_after - top_before);
    //assert_eq!(1, core.mem_free().fix_num().unwrap());
    assert_eq!(Any::fix(1), core.mem_free());
    println!("mem_next: {} -> {}", core.mem_next(), core.mem(core.mem_next()));
    //assert!(false);  // force output to be displayed
}

#[test]
fn run_loop_terminates() {
    let mut core = Core::new();
    core.run_loop();
    assert!(false);  // force output to be displayed
}
