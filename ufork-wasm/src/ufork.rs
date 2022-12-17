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
        let raw = num as Raw;
        Any::new(DIR_RAW | raw)
    }
    pub fn cap(ofs: usize) -> Any {
        let raw = (ofs as Raw) & !MSK_RAW;
        Any::new(OPQ_RAW | MUT_RAW | raw)
    }
    pub fn rom(ofs: usize) -> Any {
        let raw = (ofs as Raw) & !MSK_RAW;
        Any::new(raw)
    }
    pub fn ram(ofs: usize) -> Any {
        let raw = (ofs as Raw) & !MSK_RAW;
        Any::new(MUT_RAW | raw)
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
        (self.raw & (DIR_RAW | OPQ_RAW)) == OPQ_RAW
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
        } else if self.raw() < START.raw() {
            match *self {
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
                //DEQUE_T => write!(fmt, "DEQUE_T"),
                EMPTY_DQ => write!(fmt, "EMPTY_DQ"),
                _ => write!(fmt, "#{}", self.raw()),  // FIXME: should not occur
            }
        } else if self.is_rom() {
            write!(fmt, "*{}", self.ptr_ofs().unwrap())
        } else if self.is_ram() {
            write!(fmt, "^{}", self.ptr_ofs().unwrap())
        } else {
            write!(fmt, "${:08x}", self.raw)
        }
    }
}

// INSTR_T values
pub const VM_TYPEQ: Any     = Any { raw: DIR_RAW | 0 };
pub const VM_CELL: Any      = Any { raw: DIR_RAW | 1 };
pub const VM_GET: Any       = Any { raw: DIR_RAW | 2 };
//pub const VM_SET: Any     = Any { raw: DIR_RAW | 3 };
pub const VM_DICT: Any      = Any { raw: DIR_RAW | 3 };
pub const VM_PAIR: Any      = Any { raw: DIR_RAW | 4 };
pub const VM_PART: Any      = Any { raw: DIR_RAW | 5 };
pub const VM_NTH: Any       = Any { raw: DIR_RAW | 6 };
pub const VM_PUSH: Any      = Any { raw: DIR_RAW | 7 };
pub const VM_DEPTH: Any     = Any { raw: DIR_RAW | 8 };
pub const VM_DROP: Any      = Any { raw: DIR_RAW | 9 };
pub const VM_PICK: Any      = Any { raw: DIR_RAW | 10 };
pub const VM_DUP: Any       = Any { raw: DIR_RAW | 11 };
pub const VM_ROLL: Any      = Any { raw: DIR_RAW | 12 };
pub const VM_ALU: Any       = Any { raw: DIR_RAW | 13 };
pub const VM_EQ: Any        = Any { raw: DIR_RAW | 14 };
pub const VM_CMP: Any       = Any { raw: DIR_RAW | 15 };
pub const VM_IF: Any        = Any { raw: DIR_RAW | 16 };
pub const VM_MSG: Any       = Any { raw: DIR_RAW | 17 };
pub const VM_MY: Any        = Any { raw: DIR_RAW | 18 };
pub const VM_SEND: Any      = Any { raw: DIR_RAW | 19 };
pub const VM_NEW: Any       = Any { raw: DIR_RAW | 20 };
pub const VM_BEH: Any       = Any { raw: DIR_RAW | 21 };
pub const VM_END: Any       = Any { raw: DIR_RAW | 22 };
//pub const VM_CVT: Any       = Any { raw: DIR_RAW | 23 };
//pub const VM_PUTC: Any      = Any { raw: DIR_RAW | 24 };
//pub const VM_GETC: Any      = Any { raw: DIR_RAW | 25 };
//pub const VM_DEBUG: Any     = Any { raw: DIR_RAW | 26 };
pub const VM_DEQUE: Any     = Any { raw: DIR_RAW | 27 };
pub const VM_IS_EQ: Any     = Any { raw: DIR_RAW | 30 };
pub const VM_IS_NE: Any     = Any { raw: DIR_RAW | 31 };

// VM_DICT dictionary operations
pub const DICT_HAS: Any     = Any { raw: DIR_RAW | 0 };
pub const DICT_GET: Any     = Any { raw: DIR_RAW | 1 };
pub const DICT_ADD: Any     = Any { raw: DIR_RAW | 2 };
pub const DICT_SET: Any     = Any { raw: DIR_RAW | 3 };
pub const DICT_DEL: Any     = Any { raw: DIR_RAW | 4 };

// VM_DEQUE deque operations
pub const DEQUE_NEW: Any    = Any { raw: DIR_RAW | 0 };
pub const DEQUE_EMPTY: Any  = Any { raw: DIR_RAW | 1 };
pub const DEQUE_PUSH: Any   = Any { raw: DIR_RAW | 2 };
pub const DEQUE_POP: Any    = Any { raw: DIR_RAW | 3 };
pub const DEQUE_PUT: Any    = Any { raw: DIR_RAW | 4 };
pub const DEQUE_PULL: Any   = Any { raw: DIR_RAW | 5 };
pub const DEQUE_LEN: Any    = Any { raw: DIR_RAW | 6 };

// VM_ALU arithmetic/logical operations
pub const ALU_NOT: Any      = Any { raw: DIR_RAW | 0 };
pub const ALU_AND: Any      = Any { raw: DIR_RAW | 1 };
pub const ALU_OR: Any       = Any { raw: DIR_RAW | 2 };
pub const ALU_XOR: Any      = Any { raw: DIR_RAW | 3 };
pub const ALU_ADD: Any      = Any { raw: DIR_RAW | 4 };
pub const ALU_SUB: Any      = Any { raw: DIR_RAW | 5 };
pub const ALU_MUL: Any      = Any { raw: DIR_RAW | 6 };

// VM_CMP comparison operations
pub const CMP_EQ: Any       = Any { raw: DIR_RAW | 0 };
pub const CMP_GE: Any       = Any { raw: DIR_RAW | 1 };
pub const CMP_GT: Any       = Any { raw: DIR_RAW | 2 };
pub const CMP_LT: Any       = Any { raw: DIR_RAW | 3 };
pub const CMP_LE: Any       = Any { raw: DIR_RAW | 4 };
pub const CMP_NE: Any       = Any { raw: DIR_RAW | 5 };

// VM_MY actor operations
pub const MY_SELF: Any      = Any { raw: DIR_RAW | 0 };
pub const MY_BEH: Any       = Any { raw: DIR_RAW | 1 };
pub const MY_STATE: Any     = Any { raw: DIR_RAW | 2 };

// VM_END thread actions
pub const END_ABORT: Any    = Any { raw: DIR_RAW | -1 as Num as Raw };
pub const END_STOP: Any     = Any { raw: DIR_RAW | 0 };
pub const END_COMMIT: Any   = Any { raw: DIR_RAW | 1 };
pub const END_RELEASE: Any  = Any { raw: DIR_RAW | 2 };

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
        Self::new(UNDEF, UNDEF, UNDEF, UNDEF)
    }
    pub fn literal_t() -> Quad {
        Self::new(LITERAL_T, UNDEF, UNDEF, UNDEF)
    }
    pub fn type_t() -> Quad {
        Self::new(TYPE_T, UNDEF, UNDEF, UNDEF)
    }
    pub fn event_t(target: Any, msg: Any, next: Any) -> Quad {
        assert!(target.is_cap());
        assert!(next.is_ptr());
        Self::new(EVENT_T, target, msg, next)
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
        Self::new(INSTR_T, vm, v, k)
    }
    pub fn actor_t(beh: Any, state: Any, events: Any) -> Quad {
        assert!(beh.is_ptr());
        assert!(events.is_ptr());
        Self::new(ACTOR_T, beh, state, events)
    }
    pub fn symbol_t(hash: Any, key: Any, value: Any) -> Quad {
        assert!(hash.is_fix());
        assert!(key.is_ptr());
        Self::new(SYMBOL_T, hash, key, value)
    }
    pub fn pair_t(car: Any, cdr: Any) -> Quad {
        Self::new(PAIR_T, car, cdr, UNDEF)
    }
    pub fn dict_t(key: Any, value: Any, next: Any) -> Quad {
        assert!(next.is_ptr());
        Self::new(DICT_T, key, value, next)
    }
    pub fn free_t(next: Any) -> Quad {
        Self::new(FREE_T, UNDEF, UNDEF, next)
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
        Self::instr_t(VM_TYPEQ, t, k)
    }
    pub fn vm_dict(op: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_DICT, op, k)
    }
    pub fn vm_deque(op: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_DEQUE, op, k)
    }
    pub fn vm_pair(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_PAIR, n, k)
    }
    pub fn vm_part(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_PART, n, k)
    }
    pub fn vm_nth(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_NTH, n, k)
    }
    pub fn vm_push(v: Any, k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::instr_t(VM_PUSH, v, k)
    }
    pub fn vm_depth(k: Any) -> Quad {
        Self::instr_t(VM_DEPTH, UNDEF, k)
    }
    pub fn vm_drop(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_DROP, n, k)
    }
    pub fn vm_pick(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_PICK, n, k)
    }
    pub fn vm_dup(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_DUP, n, k)
    }
    pub fn vm_roll(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_ROLL, n, k)
    }
    pub fn vm_alu(op: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_ALU, op, k)
    }
    pub fn vm_eq(v: Any, k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::instr_t(VM_EQ, v, k)
    }
    pub fn vm_cmp(op: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_CMP, op, k)
    }
    pub fn vm_if(t: Any, f: Any) -> Quad {
        assert!(t.is_ptr());
        assert!(f.is_ptr());
        Self::instr_t(VM_IF, t, f)
    }
    pub fn vm_msg(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_MSG, n, k)
    }
    pub fn vm_my(op: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_MY, op, k)
    }
    pub fn vm_send(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_SEND, n, k)
    }
    pub fn vm_new(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_NEW, n, k)
    }
    pub fn vm_beh(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_BEH, n, k)
    }
    pub fn vm_end(op: Any) -> Quad {
        assert!(op.is_fix());
        Self::instr_t(VM_END, op, UNDEF)
    }
    pub fn vm_is_eq(v: Any, k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::instr_t(VM_IS_EQ, v, k)
    }
    pub fn vm_is_ne(v: Any, k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::instr_t(VM_IS_NE, v, k)
    }

    // construct VM_DICT instructions
    pub fn vm_dict_has(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_dict(DICT_HAS, k)
    }
    pub fn vm_dict_get(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_dict(DICT_GET, k)
    }
    pub fn vm_dict_add(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_dict(DICT_ADD, k)
    }
    pub fn vm_dict_set(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_dict(DICT_SET, k)
    }
    pub fn vm_dict_del(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_dict(DICT_DEL, k)
    }

    // construct VM_DEQUE instructions
    pub fn vm_deque_new(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_NEW, k)
    }
    pub fn vm_deque_empty(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_EMPTY, k)
    }
    pub fn vm_deque_push(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_PUSH, k)
    }
    pub fn vm_deque_pop(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_POP, k)
    }
    pub fn vm_deque_put(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_PUT, k)
    }
    pub fn vm_deque_pull(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_PULL, k)
    }
    pub fn vm_deque_len(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_LEN, k)
    }

    // construct VM_ALU instructions
    pub fn vm_alu_not(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_NOT, k)
    }
    pub fn vm_alu_and(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_AND, k)
    }
    pub fn vm_alu_or(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_OR, k)
    }
    pub fn vm_alu_xor(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_XOR, k)
    }
    pub fn vm_alu_add(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_ADD, k)
    }
    pub fn vm_alu_sub(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_SUB, k)
    }
    pub fn vm_alu_mul(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_MUL, k)
    }

    // construct VM_CMP instructions
    pub fn vm_cmp_eq(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_EQ, k)
    }
    pub fn vm_cmp_ge(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_GE, k)
    }
    pub fn vm_cmp_gt(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_GT, k)
    }
    pub fn vm_cmp_lt(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_LT, k)
    }
    pub fn vm_cmp_le(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_LE, k)
    }
    pub fn vm_cmp_ne(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_NE, k)
    }

    // construct VM_MY instructions
    pub fn vm_my_self(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_my(MY_SELF, k)
    }
    pub fn vm_my_beh(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_my(MY_BEH, k)
    }
    pub fn vm_my_state(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_my(MY_STATE, k)
    }

    // construct VM_END instructions
    pub fn vm_end_abort() -> Quad {
        Self::vm_end(END_ABORT)
    }
    pub fn vm_end_stop() -> Quad {
        Self::vm_end(END_STOP)
    }
    pub fn vm_end_commit() -> Quad {
        Self::vm_end(END_COMMIT)
    }
    pub fn vm_end_release() -> Quad {
        Self::vm_end(END_RELEASE)
    }

    // construct idle Actor
    pub fn new_actor(beh: Any, state: Any) -> Quad {
        Self::actor_t(beh, state, UNDEF)
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
        let mut t = self.t().to_string();
        if self.t() == UNDEF {
            t = String::from("LITERAL_T");
        }
        let mut x = self.x().to_string();
        let mut y = self.y().to_string();
        if self.t() == INSTR_T {
            match self.x() {
                VM_TYPEQ => x = String::from("TYPEQ"),
                VM_CELL => x = String::from("CELL"),
                VM_GET => x = String::from("GET"),
                //VM_GET => x = String::from("SET"),
                VM_DICT => {
                    x = String::from("DICT");
                    match self.y() {
                        DICT_HAS => y = String::from("HAS"),
                        DICT_GET => y = String::from("GET"),
                        DICT_ADD => y = String::from("ADD"),
                        DICT_SET => y = String::from("SET"),
                        DICT_DEL => y = String::from("DEL"),
                        _ => {},
                    }
                },
                VM_PAIR => x = String::from("PAIR"),
                VM_PART => x = String::from("PART"),
                VM_NTH => x = String::from("NTH"),
                VM_PUSH => x = String::from("PUSH"),
                VM_DEPTH => x = String::from("DEPTH"),
                VM_DROP => x = String::from("DROP"),
                VM_PICK => x = String::from("PICK"),
                VM_DUP => x = String::from("DUP"),
                VM_ROLL => x = String::from("ROLL"),
                VM_ALU => {
                    x = String::from("ALU");
                    match self.y() {
                        ALU_NOT => y = String::from("NOT"),
                        ALU_AND => y = String::from("AND"),
                        ALU_OR => y = String::from("OR"),
                        ALU_XOR => y = String::from("XOR"),
                        ALU_ADD => y = String::from("ADD"),
                        ALU_SUB => y = String::from("SUB"),
                        ALU_MUL => y = String::from("MUL"),
                        _ => {},
                    }
                },
                VM_EQ => x = String::from("EQ"),
                VM_CMP => {
                    x = String::from("CMP");
                    match self.y() {
                        CMP_EQ => y = String::from("EQ"),
                        CMP_GE => y = String::from("GE"),
                        CMP_GT => y = String::from("GT"),
                        CMP_LT => y = String::from("LT"),
                        CMP_LE => y = String::from("LE"),
                        CMP_NE => y = String::from("NE"),
                        _ => {},
                    }
                },
                VM_IF => x = String::from("IF"),
                VM_MSG => x = String::from("MSG"),
                VM_MY => {
                    x = String::from("MY");
                    match self.y() {
                        MY_SELF => y = String::from("SELF"),
                        MY_BEH => y = String::from("BEH"),
                        MY_STATE => y = String::from("STATE"),
                        _ => {},
                    }
                },
                VM_SEND => x = String::from("SEND"),
                VM_NEW => x = String::from("NEW"),
                VM_BEH => x = String::from("BEH"),
                VM_END => {
                    x = String::from("END");
                    match self.y() {
                        END_ABORT => y = String::from("ABORT"),
                        END_STOP => y = String::from("STOP"),
                        END_COMMIT => y = String::from("COMMIT"),
                        END_RELEASE => y = String::from("RELEASE"),
                        _ => {},
                    }
                },
                VM_DEQUE => {
                    x = String::from("DEQUE");
                    match self.y() {
                        DEQUE_NEW => y = String::from("NEW"),
                        DEQUE_EMPTY => y = String::from("EMPTY"),
                        DEQUE_PUSH => y = String::from("PUSH"),
                        DEQUE_POP => y = String::from("POP"),
                        DEQUE_PUT => y = String::from("PUT"),
                        DEQUE_PULL => y = String::from("PULL"),
                        DEQUE_LEN => y = String::from("LEN"),
                        _ => {},
                    }
                },
                VM_IS_EQ => x = String::from("IS_EQ"),
                VM_IS_NE => x = String::from("IS_NE"),
                _ => {},
            }
        };
        let z = self.z().to_string();
        write!(fmt, "{{t:{}, x:{}, y:{}, z:{}}}", t, x, y, z)
    }
}

// literal values (`Any` type)
pub const MINUS_5: Any      = Any { raw: DIR_RAW | -5 as Num as Raw };
pub const MINUS_4: Any      = Any { raw: DIR_RAW | -4 as Num as Raw };
pub const MINUS_3: Any      = Any { raw: DIR_RAW | -3 as Num as Raw };
pub const MINUS_2: Any      = Any { raw: DIR_RAW | -2 as Num as Raw };
pub const MINUS_1: Any      = Any { raw: DIR_RAW | -1 as Num as Raw };
pub const ZERO: Any         = Any { raw: DIR_RAW | 0 };
pub const PLUS_1: Any       = Any { raw: DIR_RAW | 1 };
pub const PLUS_2: Any       = Any { raw: DIR_RAW | 2 };
pub const PLUS_3: Any       = Any { raw: DIR_RAW | 3 };
pub const PLUS_4: Any       = Any { raw: DIR_RAW | 4 };
pub const PLUS_5: Any       = Any { raw: DIR_RAW | 5 };
pub const PLUS_6: Any       = Any { raw: DIR_RAW | 6 };
pub const PLUS_7: Any       = Any { raw: DIR_RAW | 7 };
pub const PLUS_8: Any       = Any { raw: DIR_RAW | 8 };

pub const UNDEF: Any        = Any { raw: 0 };
pub const NIL: Any          = Any { raw: 1 };
pub const FALSE: Any        = Any { raw: 2 };
pub const TRUE: Any         = Any { raw: 3 };
pub const UNIT: Any         = Any { raw: 4 };
pub const LITERAL_T: Any    = Any { raw: 0 };  // == UNDEF
pub const TYPE_T: Any       = Any { raw: 5 };
pub const EVENT_T: Any      = Any { raw: 6 };
pub const INSTR_T: Any      = Any { raw: 7 };
pub const ACTOR_T: Any      = Any { raw: 8 };
pub const FIXNUM_T: Any     = Any { raw: 9 };
pub const SYMBOL_T: Any     = Any { raw: 10 };
pub const PAIR_T: Any       = Any { raw: 11 };
//pub const FEXPR_T: Any      = Any { raw: 12 };
pub const DICT_T: Any       = Any { raw: 12 };
pub const FREE_T: Any       = Any { raw: 13 };
//pub const DEQUE_T: Any      = Any { raw: 14 };
pub const EMPTY_DQ: Any     = Any { raw: 15 };

pub const START: Any        = Any { raw: 16 };

pub const MEMORY: Any       = Any { raw: MUT_RAW | 0 };
pub const DDEQUE: Any       = Any { raw: MUT_RAW | 1 };


// core memory limit
const QUAD_MAX: usize = 1<<10;  // 1K quad-cells
//const QUAD_MAX: usize = 1<<12;  // 4K quad-cells

pub struct Core {
    quad_rom: [Quad; QUAD_MAX],
    quad_ram: [Quad; QUAD_MAX],
}

impl Core {
    pub fn new() -> Core {
        let mut quad_ram = [
            Quad::empty_t();
            QUAD_MAX
        ];
        quad_ram[MEMORY.addr()]     = Quad::memory_t(Any::ram(MEM_TOP_ADDR), NIL, ZERO, DDEQUE);
        quad_ram[DDEQUE.addr()]     = Quad::ddeque_t(E_BOOT, E_BOOT, NIL, NIL);
pub const E_BOOT: Any       = Any { raw: MUT_RAW | 2 };
        //quad_ram[E_BOOT.addr()]     = Quad::event_t(A_STOP, TEST_MSG, NIL);  // stop actor
        //quad_ram[E_BOOT.addr()]     = Quad::event_t(A_LOOP, TEST_MSG, NIL);  // run loop demo
        quad_ram[E_BOOT.addr()]     = Quad::event_t(A_TEST, TEST_MSG, NIL);  // run test suite
pub const A_SINK: Any       = Any { raw: OPQ_RAW | MUT_RAW | 3 };
        quad_ram[A_SINK.addr()]     = Quad::new_actor(SINK_BEH, NIL);
pub const A_STOP: Any       = Any { raw: OPQ_RAW | MUT_RAW | 4 };
        quad_ram[A_STOP.addr()]     = Quad::new_actor(STOP, NIL);
pub const A_TEST: Any       = Any { raw: OPQ_RAW | MUT_RAW | 5 };
        quad_ram[A_TEST.addr()]     = Quad::new_actor(TEST_BEH, TEST_SP);
pub const A_LOOP: Any       = Any { raw: OPQ_RAW | MUT_RAW | 6 };
        quad_ram[A_LOOP.addr()]     = Quad::new_actor(RESEND, TEST_SP);
pub const F_FIB: Any        = Any { raw: OPQ_RAW | MUT_RAW | 7 };
        //quad_ram[7]                 = Quad::new_actor(F_FIB_BEH, NIL);  // function-actor
        quad_ram[7]                 = Quad::new_actor(_F_FIB_GEN, NIL);  // worker-generator
pub const TEST_MSG: Any     = Any { raw: MUT_RAW | 8 };
        quad_ram[8]                 = Quad::pair_t(A_STOP, Any::ram(9));
        quad_ram[9]                 = Quad::pair_t(UNIT, NIL);
pub const TEST_SP: Any      = Any { raw: MUT_RAW | 10 };
        quad_ram[10]                = Quad::pair_t(MINUS_1, Any::ram(11));
        quad_ram[11]                = Quad::pair_t(MINUS_2, Any::ram(12));
        quad_ram[12]                = Quad::pair_t(MINUS_3, NIL);
pub const MEM_TOP_ADDR: usize = 16;

        let mut quad_rom = [
            Quad::empty_t();
            QUAD_MAX
        ];

        quad_rom[UNDEF.addr()]      = Quad::literal_t();
        quad_rom[NIL.addr()]        = Quad::literal_t();
        quad_rom[FALSE.addr()]      = Quad::literal_t();
        quad_rom[TRUE.addr()]       = Quad::literal_t();
        quad_rom[UNIT.addr()]       = Quad::literal_t();

        quad_rom[TYPE_T.addr()]     = Quad::type_t();
        quad_rom[EVENT_T.addr()]    = Quad::type_t();
        quad_rom[INSTR_T.addr()]    = Quad::type_t();
        quad_rom[ACTOR_T.addr()]    = Quad::type_t();
        quad_rom[FIXNUM_T.addr()]   = Quad::type_t();
        quad_rom[SYMBOL_T.addr()]   = Quad::type_t();
        quad_rom[PAIR_T.addr()]     = Quad::type_t();
        //quad_rom[FEXPR_T.addr()]    = Quad::type_t();
        quad_rom[DICT_T.addr()]     = Quad::type_t();
        quad_rom[FREE_T.addr()]     = Quad::type_t();
        //quad_rom[DEQUE_T.addr()]    = Quad::type_t();

        quad_rom[EMPTY_DQ.addr()]   = Quad::pair_t(NIL, NIL);

pub const SINK_BEH: Any     = Any { raw: 16 };  // alias for no-op behavior
pub const COMMIT: Any       = Any { raw: 16 };
        quad_rom[COMMIT.addr()]     = Quad::vm_end_commit();
pub const SEND_0: Any       = Any { raw: 17 };
        quad_rom[SEND_0.addr()]     = Quad::vm_send(ZERO, COMMIT);
pub const CUST_SEND: Any    = Any { raw: 18 };
        quad_rom[CUST_SEND.addr()]  = Quad::vm_msg(PLUS_1, SEND_0);
pub const RV_SELF: Any      = Any { raw: 19 };
        quad_rom[RV_SELF.addr()]    = Quad::vm_my_self(CUST_SEND);
pub const RV_UNDEF: Any     = Any { raw: 20 };
        quad_rom[RV_UNDEF.addr()]   = Quad::vm_push(UNDEF, CUST_SEND);
pub const RV_NIL: Any       = Any { raw: 21 };
        quad_rom[RV_NIL.addr()]     = Quad::vm_push(NIL, CUST_SEND);
pub const RV_FALSE: Any     = Any { raw: 22 };
        quad_rom[RV_FALSE.addr()]   = Quad::vm_push(FALSE, CUST_SEND);
pub const RV_TRUE: Any      = Any { raw: 23 };
        quad_rom[RV_TRUE.addr()]    = Quad::vm_push(TRUE, CUST_SEND);
pub const RV_UNIT: Any      = Any { raw: 24 };
        quad_rom[RV_UNIT.addr()]    = Quad::vm_push(UNIT, CUST_SEND);
pub const RV_ZERO: Any      = Any { raw: 25 };
        quad_rom[RV_ZERO.addr()]    = Quad::vm_push(ZERO, CUST_SEND);
pub const RV_ONE: Any       = Any { raw: 26 };
        quad_rom[RV_ONE.addr()]     = Quad::vm_push(PLUS_1, CUST_SEND);
pub const RESEND: Any       = Any { raw: 27 };
        quad_rom[RESEND.addr()+0]   = Quad::vm_msg(ZERO, Any::rom(RESEND.addr()+1));
        quad_rom[RESEND.addr()+1]   = Quad::vm_my_self(SEND_0);
pub const RELEASE: Any      = Any { raw: 29 };
        quad_rom[RELEASE.addr()]    = Quad::vm_end_release();
pub const RELEASE_0: Any    = Any { raw: 30 };
        quad_rom[RELEASE_0.addr()]  = Quad::vm_send(ZERO, RELEASE);
pub const STOP: Any         = Any { raw: 31 };
        quad_rom[STOP.addr()]       = Quad::vm_end_stop();
pub const ABORT: Any        = Any { raw: 32 };
        quad_rom[ABORT.addr()+0]    = Quad::vm_push(UNDEF, Any::rom(ABORT.addr()+1));  // #?
        quad_rom[ABORT.addr()+1]    = Quad::vm_end_abort();

pub const MEMO_ADDR: usize = 34;
pub const _MEMO_BEH: Any = Any { raw: MEMO_ADDR as Raw };
        /*
        (define memo-beh
            (lambda (value)
                (BEH (cust . _)
                    (SEND cust value) )))
        */
        // stack: value
        quad_rom[MEMO_ADDR+0]   = Quad::vm_dup(PLUS_1, CUST_SEND);  // value value

pub const FWD_ADDR: usize = MEMO_ADDR+1;
pub const _FWD_BEH: Any = Any { raw: FWD_ADDR as Raw };
        /*
        (define fwd-beh
            (lambda (rcvr)
                (BEH msg
                    (SEND rcvr msg) )))
        */
        // stack: rcvr
        quad_rom[FWD_ADDR+0]        = Quad::vm_msg(ZERO, Any::rom(FWD_ADDR+1));  // rcvr msg
        quad_rom[FWD_ADDR+1]        = Quad::vm_pick(PLUS_2, SEND_0);  // rcvr msg rcvr

pub const ONCE_ADDR: usize = FWD_ADDR+2;
pub const _ONCE_BEH: Any = Any { raw: ONCE_ADDR as Raw };
        /*
        (define once-beh
            (lambda (rcvr)
                (BEH msg
                    (BECOME sink-beh)
                    (SEND rcvr msg) )))
        */
        // stack: rcvr
        quad_rom[ONCE_ADDR+0]       = Quad::vm_push(SINK_BEH, Any::rom(ONCE_ADDR+1));  // rcvr sink-beh
        quad_rom[ONCE_ADDR+1]       = Quad::vm_beh(ZERO, _FWD_BEH);  // rcvr

pub const LABEL_ADDR: usize = ONCE_ADDR+2;
pub const _LABEL_BEH: Any = Any { raw: LABEL_ADDR as Raw };
        /*
        (define label-beh
            (lambda (rcvr label)
                (BEH msg
                    (SEND rcvr (cons label msg)) )))
        */
        // stack: rcvr label
        quad_rom[LABEL_ADDR+0]      = Quad::vm_msg(ZERO, Any::rom(LABEL_ADDR+1));  // rcvr label msg
        quad_rom[LABEL_ADDR+1]      = Quad::vm_pick(PLUS_2, Any::rom(LABEL_ADDR+2));  // rcvr label msg label
        quad_rom[LABEL_ADDR+2]      = Quad::vm_pair(PLUS_1, Any::rom(LABEL_ADDR+3));  // rcvr label (label . msg)
        quad_rom[LABEL_ADDR+3]      = Quad::vm_pick(PLUS_3, SEND_0);  // rcvr label (label . msg) rcvr

pub const TAG_ADDR: usize = LABEL_ADDR+4;
pub const _TAG_BEH: Any = Any { raw: TAG_ADDR as Raw };
        /*
        (define tag-beh
            (lambda (rcvr)
                (BEH msg
                    (SEND rcvr (cons SELF msg)) )))
        */
        // stack: rcvr
        quad_rom[TAG_ADDR+0]        = Quad::vm_my_self(_LABEL_BEH);  // rcvr SELF

pub const ONCE_TAG_ADDR: usize = TAG_ADDR+1;
pub const ONCE_TAG_BEH: Any = Any { raw: ONCE_TAG_ADDR as Raw };
        /*
        (define once-tag-beh  ;; FIXME: find a better name for this?
            (lambda (rcvr)
                (BEH msg
                    (BECOME sink-beh)
                    (SEND rcvr (cons SELF msg)) )))
        */
        // stack: rcvr
        quad_rom[ONCE_TAG_ADDR+0]   = Quad::vm_push(SINK_BEH, Any::rom(ONCE_TAG_ADDR+1));  // rcvr sink-beh
        quad_rom[ONCE_TAG_ADDR+1]   = Quad::vm_beh(ZERO, _TAG_BEH);  // rcvr

pub const WRAP_ADDR: usize = ONCE_TAG_ADDR+2;
pub const _WRAP_BEH: Any = Any { raw: WRAP_ADDR as Raw };
        /*
        (define wrap-beh
            (lambda (rcvr)
                (BEH msg
                    (SEND rcvr (list msg)) )))
        */
        // stack: rcvr
        quad_rom[WRAP_ADDR+0]       = Quad::vm_msg(ZERO, Any::rom(WRAP_ADDR+1));  // rcvr msg
        quad_rom[WRAP_ADDR+1]       = Quad::vm_pick(PLUS_2, Any::rom(WRAP_ADDR+2));  // rcvr msg rcvr
        quad_rom[WRAP_ADDR+2]       = Quad::vm_send(PLUS_1, COMMIT);  // rcvr

pub const UNWRAP_ADDR: usize = WRAP_ADDR+3;
pub const _UNWRAP_BEH: Any = Any { raw: UNWRAP_ADDR as Raw };
        /*
        (define unwrap-beh
            (lambda (rcvr)
                (BEH (msg)
                    (SEND rcvr msg) )))
        */
        // stack: rcvr
        quad_rom[UNWRAP_ADDR+0]     = Quad::vm_msg(PLUS_1, Any::rom(UNWRAP_ADDR+1));  // rcvr msg
        quad_rom[UNWRAP_ADDR+1]     = Quad::vm_pick(PLUS_2, SEND_0);  // rcvr msg rcvr

pub const FUTURE_ADDR: usize = UNWRAP_ADDR+2;
pub const _FUTURE_BEH: Any = Any { raw: FUTURE_ADDR as Raw };
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
        // stack: rcap wcap
        quad_rom[FUTURE_ADDR+0]     = Quad::vm_msg(PLUS_1, Any::rom(FUTURE_ADDR+1));  // rcap wcap tag
        quad_rom[FUTURE_ADDR+1]     = Quad::vm_pick(PLUS_3, Any::rom(FUTURE_ADDR+2));  // rcap wcap tag rcap
        quad_rom[FUTURE_ADDR+2]     = Quad::vm_cmp_eq(Any::rom(FUTURE_ADDR+3));  // rcap wcap tag==rcap
        quad_rom[FUTURE_ADDR+3]     = Quad::vm_if(Any::rom(FUTURE_ADDR+4), Any::rom(FUTURE_ADDR+9));  // rcap wcap

        quad_rom[FUTURE_ADDR+4]     = Quad::vm_push(NIL, Any::rom(FUTURE_ADDR+5));  // rcap wcap ()
        quad_rom[FUTURE_ADDR+5]     = Quad::vm_msg(MINUS_1, Any::rom(FUTURE_ADDR+6));  // rcap wcap () arg
        quad_rom[FUTURE_ADDR+6]     = Quad::vm_pair(PLUS_1, Any::rom(FUTURE_ADDR+7));  // rcap wcap (arg)
        quad_rom[FUTURE_ADDR+7]     = Quad::vm_push(_WAIT_BEH, Any::rom(FUTURE_ADDR+8));  // rcap wcap (arg) wait-beh
        quad_rom[FUTURE_ADDR+8]     = Quad::vm_beh(PLUS_3, COMMIT);  // wait-beh[rcap wcap (arg)]

        quad_rom[FUTURE_ADDR+9]     = Quad::vm_msg(PLUS_1, Any::rom(FUTURE_ADDR+10));  // rcap wcap tag
        quad_rom[FUTURE_ADDR+10]    = Quad::vm_pick(PLUS_2, Any::rom(FUTURE_ADDR+11));  // rcap wcap tag wcap
        quad_rom[FUTURE_ADDR+11]    = Quad::vm_cmp_eq(Any::rom(FUTURE_ADDR+12));  // rcap wcap tag==wcap
        quad_rom[FUTURE_ADDR+12]    = Quad::vm_if(Any::rom(FUTURE_ADDR+13), ABORT);  // rcap wcap

        quad_rom[FUTURE_ADDR+13]    = Quad::vm_drop(PLUS_1, Any::rom(FUTURE_ADDR+14));  // rcap
        quad_rom[FUTURE_ADDR+14]    = Quad::vm_msg(MINUS_1, Any::rom(FUTURE_ADDR+15));  // rcap value=arg
        quad_rom[FUTURE_ADDR+15]    = Quad::vm_push(_VALUE_BEH, Any::rom(FUTURE_ADDR+16));  // rcap value=arg value-beh
        quad_rom[FUTURE_ADDR+16]    = Quad::vm_beh(PLUS_2, COMMIT);  // value-beh[rcap value]

pub const WAIT_ADDR: usize = FUTURE_ADDR+17;
pub const _WAIT_BEH: Any = Any { raw: WAIT_ADDR as Raw };
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
        // stack: rcap wcap waiting
        quad_rom[WAIT_ADDR+0]       = Quad::vm_msg(PLUS_1, Any::rom(WAIT_ADDR+1));  // rcap wcap waiting tag
        quad_rom[WAIT_ADDR+1]       = Quad::vm_pick(PLUS_4, Any::rom(WAIT_ADDR+2));  // rcap wcap waiting tag rcap
        quad_rom[WAIT_ADDR+2]       = Quad::vm_cmp_eq(Any::rom(WAIT_ADDR+3));  // rcap wcap waiting tag==rcap
        quad_rom[WAIT_ADDR+3]       = Quad::vm_if(Any::rom(WAIT_ADDR+4), Any::rom(WAIT_ADDR+8));  // rcap wcap waiting

        quad_rom[WAIT_ADDR+4]       = Quad::vm_msg(MINUS_1, Any::rom(WAIT_ADDR+5));  // rcap wcap waiting arg
        quad_rom[WAIT_ADDR+5]       = Quad::vm_pair(PLUS_1, Any::rom(WAIT_ADDR+6));  // rcap wcap (arg . waiting)
        quad_rom[WAIT_ADDR+6]       = Quad::vm_push(_WAIT_BEH, Any::rom(WAIT_ADDR+7));  // rcap wcap (arg . waiting) wait-beh
        quad_rom[WAIT_ADDR+7]       = Quad::vm_beh(PLUS_3, COMMIT);  // wait-beh[rcap wcap (arg . waiting)]

        quad_rom[WAIT_ADDR+8]       = Quad::vm_msg(PLUS_1, Any::rom(WAIT_ADDR+9));  // rcap wcap waiting tag
        quad_rom[WAIT_ADDR+9]       = Quad::vm_pick(PLUS_2, Any::rom(WAIT_ADDR+10));  // rcap wcap waiting tag wcap
        quad_rom[WAIT_ADDR+10]      = Quad::vm_cmp_eq(Any::rom(WAIT_ADDR+11));  // rcap wcap waiting tag==wcap
        quad_rom[WAIT_ADDR+11]      = Quad::vm_if(Any::rom(WAIT_ADDR+12), ABORT);  // rcap wcap waiting

        quad_rom[WAIT_ADDR+12]      = Quad::vm_dup(PLUS_1, Any::rom(WAIT_ADDR+13));  // rcap wcap waiting waiting
        quad_rom[WAIT_ADDR+13]      = Quad::vm_typeq(PAIR_T, Any::rom(WAIT_ADDR+14));  // rcap wcap waiting is_pair(waiting)
        quad_rom[WAIT_ADDR+14]      = Quad::vm_if(Any::rom(WAIT_ADDR+15), Any::rom(WAIT_ADDR+19));  // rcap wcap waiting
        quad_rom[WAIT_ADDR+15]      = Quad::vm_part(PLUS_1, Any::rom(WAIT_ADDR+16));  // rcap wcap rest first
        quad_rom[WAIT_ADDR+16]      = Quad::vm_msg(MINUS_1, Any::rom(WAIT_ADDR+17));  // rcap wcap rest first value=arg
        quad_rom[WAIT_ADDR+17]      = Quad::vm_roll(PLUS_2, Any::rom(WAIT_ADDR+18));  // rcap wcap rest value=arg first
        quad_rom[WAIT_ADDR+18]      = Quad::vm_send(ZERO, Any::rom(WAIT_ADDR+12));  // rcap wcap rest

        quad_rom[WAIT_ADDR+19]      = Quad::vm_drop(PLUS_2, Any::rom(WAIT_ADDR+20));  // rcap
        quad_rom[WAIT_ADDR+20]      = Quad::vm_msg(MINUS_1, Any::rom(WAIT_ADDR+21));  // rcap value=arg
        quad_rom[WAIT_ADDR+21]      = Quad::vm_push(_VALUE_BEH, Any::rom(WAIT_ADDR+22));  // rcap value=arg value-beh
        quad_rom[WAIT_ADDR+22]      = Quad::vm_beh(PLUS_2, COMMIT);  // value-beh[rcap value]

pub const VALUE_ADDR: usize = WAIT_ADDR+23;
pub const _VALUE_BEH: Any = Any { raw: VALUE_ADDR as Raw };
        /*
        (define value-beh
            (lambda (rcap value)
                (BEH (tag . arg)
                    (cond
                        ((eq? tag rcap)
                            (SEND arg value))) )))
        */
        // stack: rcap value
        quad_rom[VALUE_ADDR+0]      = Quad::vm_msg(PLUS_1, Any::rom(VALUE_ADDR+1));  // rcap value tag
        quad_rom[VALUE_ADDR+1]      = Quad::vm_pick(PLUS_3, Any::rom(VALUE_ADDR+2));  // rcap value tag rcap
        quad_rom[VALUE_ADDR+2]      = Quad::vm_cmp_eq(Any::rom(VALUE_ADDR+3));  // rcap value tag==rcap
        quad_rom[VALUE_ADDR+3]      = Quad::vm_if(Any::rom(VALUE_ADDR+4), COMMIT);  // rcap value
        quad_rom[VALUE_ADDR+4]      = Quad::vm_pick(PLUS_1, Any::rom(VALUE_ADDR+5));  // rcap value value
        quad_rom[VALUE_ADDR+5]      = Quad::vm_msg(MINUS_1, SEND_0);  // rcap value value cust=arg

pub const SERIAL_ADDR: usize = VALUE_ADDR+6;
pub const _SERIAL_BEH: Any = Any { raw: SERIAL_ADDR as Raw };
        /*
        (define serial-beh
            (lambda (svc)
                (BEH (cust . req)
                    (define tag (CREATE (once-tag-beh SELF)))
                    (SEND svc (tag . req))
                    (BECOME (busy-beh svc cust tag (deque-new))) )))
        */
        // stack: svc
        quad_rom[SERIAL_ADDR+0]     = Quad::vm_msg(PLUS_1, Any::rom(SERIAL_ADDR+1));  // svc cust
        quad_rom[SERIAL_ADDR+1]     = Quad::vm_my_self(Any::rom(SERIAL_ADDR+2));  // svc cust SELF
        quad_rom[SERIAL_ADDR+2]     = Quad::vm_push(ONCE_TAG_BEH, Any::rom(SERIAL_ADDR+3));  // svc cust SELF once-tag-beh
        quad_rom[SERIAL_ADDR+3]     = Quad::vm_new(PLUS_1, Any::rom(SERIAL_ADDR+4));  // svc cust tag=once-tag-beh[SELF]

        quad_rom[SERIAL_ADDR+4]     = Quad::vm_msg(MINUS_1, Any::rom(SERIAL_ADDR+5));  // svc cust tag req
        quad_rom[SERIAL_ADDR+5]     = Quad::vm_pick(PLUS_2, Any::rom(SERIAL_ADDR+6));  // svc cust tag req tag
        quad_rom[SERIAL_ADDR+6]     = Quad::vm_pair(PLUS_1, Any::rom(SERIAL_ADDR+7));  // svc cust tag (tag . req)
        quad_rom[SERIAL_ADDR+7]     = Quad::vm_pick(PLUS_4, Any::rom(SERIAL_ADDR+8));  // svc cust tag (tag . req) svc
        quad_rom[SERIAL_ADDR+8]     = Quad::vm_send(ZERO, Any::rom(SERIAL_ADDR+9));  // svc cust tag

        quad_rom[SERIAL_ADDR+9]     = Quad::vm_deque_new(Any::rom(SERIAL_ADDR+10));  // svc cust tag pending
        quad_rom[SERIAL_ADDR+10]    = Quad::vm_push(_BUSY_BEH, Any::rom(SERIAL_ADDR+11));  // svc cust tag pending busy-beh
        quad_rom[SERIAL_ADDR+11]    = Quad::vm_beh(PLUS_4, COMMIT);  // busy-beh[svc cust tag pending]

pub const BUSY_ADDR: usize = SERIAL_ADDR+12;
pub const _BUSY_BEH: Any = Any { raw: BUSY_ADDR as Raw };
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
        // stack: svc cust tag pending
        quad_rom[BUSY_ADDR+0]       = Quad::vm_msg(PLUS_1, Any::rom(BUSY_ADDR+1));  // svc cust tag pending cust0
        quad_rom[BUSY_ADDR+1]       = Quad::vm_pick(PLUS_3, Any::rom(BUSY_ADDR+2));  // svc cust tag pending cust0 tag
        quad_rom[BUSY_ADDR+2]       = Quad::vm_cmp_eq(Any::rom(BUSY_ADDR+3));  // svc cust tag pending cust0==tag
        quad_rom[BUSY_ADDR+3]       = Quad::vm_if(Any::rom(BUSY_ADDR+4), Any::rom(BUSY_ADDR+28));  // svc cust tag pending

        quad_rom[BUSY_ADDR+4]       = Quad::vm_msg(MINUS_1, Any::rom(BUSY_ADDR+5));  // svc cust tag pending req0
        quad_rom[BUSY_ADDR+5]       = Quad::vm_roll(PLUS_4, Any::rom(BUSY_ADDR+6));  // svc tag pending req0 cust
        quad_rom[BUSY_ADDR+6]       = Quad::vm_send(ZERO, Any::rom(BUSY_ADDR+7));  // svc tag pending
        quad_rom[BUSY_ADDR+7]       = Quad::vm_deque_pop(Any::rom(BUSY_ADDR+8));  // svc tag pending1 next
        quad_rom[BUSY_ADDR+8]       = Quad::vm_dup(PLUS_1, Any::rom(BUSY_ADDR+9));  // svc tag pending1 next next
        quad_rom[BUSY_ADDR+9]       = Quad::vm_eq(UNDEF, Any::rom(BUSY_ADDR+10));  // svc tag pending1 next next==#?
        quad_rom[BUSY_ADDR+10]      = Quad::vm_if(Any::rom(BUSY_ADDR+11), Any::rom(BUSY_ADDR+14));  // svc tag pending1 next

        quad_rom[BUSY_ADDR+11]      = Quad::vm_drop(PLUS_3, Any::rom(BUSY_ADDR+12));  // svc
        quad_rom[BUSY_ADDR+12]      = Quad::vm_push(_SERIAL_BEH, Any::rom(BUSY_ADDR+13));  // svc serial-beh
        quad_rom[BUSY_ADDR+13]      = Quad::vm_beh(PLUS_1, COMMIT);  // serial-beh[svc]

        quad_rom[BUSY_ADDR+14]      = Quad::vm_part(PLUS_1, Any::rom(BUSY_ADDR+15));  // svc tag pending1 req1 cust1
        quad_rom[BUSY_ADDR+15]      = Quad::vm_my_self(Any::rom(BUSY_ADDR+16));  // svc tag pending1 req1 cust1 SELF
        quad_rom[BUSY_ADDR+16]      = Quad::vm_push(ONCE_TAG_BEH, Any::rom(BUSY_ADDR+17));  // svc tag pending1 req1 cust1 SELF once-tag-beh
        quad_rom[BUSY_ADDR+17]      = Quad::vm_new(PLUS_1, Any::rom(BUSY_ADDR+18));  // svc tag pending1 req1 cust1 tag1=once-tag-beh[SELF]
        quad_rom[BUSY_ADDR+18]      = Quad::vm_roll(PLUS_3, Any::rom(BUSY_ADDR+19));  // svc tag pending1 cust1 tag1 req1
        quad_rom[BUSY_ADDR+19]      = Quad::vm_pick(PLUS_2, Any::rom(BUSY_ADDR+20));  // svc tag pending1 cust1 tag1 req1 tag1
        quad_rom[BUSY_ADDR+20]      = Quad::vm_pair(PLUS_1, Any::rom(BUSY_ADDR+21));  // svc tag pending1 cust1 tag1 (tag1 . req1)
        quad_rom[BUSY_ADDR+21]      = Quad::vm_pick(PLUS_6, Any::rom(BUSY_ADDR+22));  // svc tag pending1 cust1 tag1 (tag1 . req1) svc
        quad_rom[BUSY_ADDR+22]      = Quad::vm_send(ZERO, Any::rom(BUSY_ADDR+23));  // svc tag pending1 cust1 tag1
        quad_rom[BUSY_ADDR+23]      = Quad::vm_roll(PLUS_5, Any::rom(BUSY_ADDR+24));  // tag pending1 cust1 tag1 svc
        quad_rom[BUSY_ADDR+24]      = Quad::vm_roll(MINUS_3, Any::rom(BUSY_ADDR+25));  // tag pending1 svc cust1 tag1
        quad_rom[BUSY_ADDR+25]      = Quad::vm_roll(PLUS_4, Any::rom(BUSY_ADDR+26));  // tag svc cust1 tag1 pending1

        quad_rom[BUSY_ADDR+26]      = Quad::vm_push(_BUSY_BEH, Any::rom(BUSY_ADDR+27));  // ... svc cust1 tag1 pending1 busy-beh
        quad_rom[BUSY_ADDR+27]      = Quad::vm_beh(PLUS_4, COMMIT);  // busy-beh[svc cust1 tag1 pending1]

        quad_rom[BUSY_ADDR+28]      = Quad::vm_msg(ZERO, Any::rom(BUSY_ADDR+29));  // svc cust tag pending (cust0 . req0)
        quad_rom[BUSY_ADDR+29]      = Quad::vm_deque_put(Any::rom(BUSY_ADDR+26));  // svc cust tag pending1

pub const F_FIB_ADDR: usize = BUSY_ADDR+30; //was 150;
pub const F_FIB_BEH: Any = Any { raw: F_FIB_ADDR as Raw };
        /*
        (define fib                 ; O(n!) performance?
          (lambda (n)               ; msg: (cust n)
            (if (< n 2)
                n
                (+ (fib (- n 1)) (fib (- n 2))) )))
        */
        quad_rom[F_FIB_ADDR+0]      = Quad::vm_msg(PLUS_2, Any::rom(F_FIB_ADDR+1));  // n
        quad_rom[F_FIB_ADDR+1]      = Quad::vm_dup(PLUS_1, Any::rom(F_FIB_ADDR+2));  // n n
        quad_rom[F_FIB_ADDR+2]      = Quad::vm_push(PLUS_2, Any::rom(F_FIB_ADDR+3));  // n n 2
        quad_rom[F_FIB_ADDR+3]      = Quad::vm_cmp_lt(Any::rom(F_FIB_ADDR+4));  // n n<2
        quad_rom[F_FIB_ADDR+4]      = Quad::vm_if(CUST_SEND, Any::rom(F_FIB_ADDR+5));  // n

        quad_rom[F_FIB_ADDR+5]      = Quad::vm_msg(PLUS_1, Any::rom(F_FIB_ADDR+6));  // n cust
        quad_rom[F_FIB_ADDR+6]      = Quad::vm_push(F_FIB_K, Any::rom(F_FIB_ADDR+7));  // n cust fib-k
        quad_rom[F_FIB_ADDR+7]      = Quad::vm_new(PLUS_1, Any::rom(F_FIB_ADDR+8));  // n k=fib-k[cust]

        quad_rom[F_FIB_ADDR+8]      = Quad::vm_pick(PLUS_2, Any::rom(F_FIB_ADDR+9));  // n k n
        quad_rom[F_FIB_ADDR+9]      = Quad::vm_push(PLUS_1, Any::rom(F_FIB_ADDR+10));  // n k n 1
        quad_rom[F_FIB_ADDR+10]     = Quad::vm_alu_sub(Any::rom(F_FIB_ADDR+11));  // n k n-1
        quad_rom[F_FIB_ADDR+11]     = Quad::vm_pick(PLUS_2, Any::rom(F_FIB_ADDR+12));  // n k n-1 k
        quad_rom[F_FIB_ADDR+12]     = Quad::vm_push(F_FIB, Any::rom(F_FIB_ADDR+13));  // n k n-1 k fib
        quad_rom[F_FIB_ADDR+13]     = Quad::vm_send(PLUS_2, Any::rom(F_FIB_ADDR+14));  // n k

        quad_rom[F_FIB_ADDR+14]     = Quad::vm_roll(PLUS_2, Any::rom(F_FIB_ADDR+15));  // k n
        quad_rom[F_FIB_ADDR+15]     = Quad::vm_push(PLUS_2, Any::rom(F_FIB_ADDR+16));  // k n 2
        quad_rom[F_FIB_ADDR+16]     = Quad::vm_alu_sub(Any::rom(F_FIB_ADDR+17));  // k n-2
        quad_rom[F_FIB_ADDR+17]     = Quad::vm_roll(PLUS_2, Any::rom(F_FIB_ADDR+18));  // n-2 k
        quad_rom[F_FIB_ADDR+18]     = Quad::vm_push(F_FIB, Any::rom(F_FIB_ADDR+19));  // n-2 k fib
        quad_rom[F_FIB_ADDR+19]     = Quad::vm_send(PLUS_2, COMMIT);  // --

pub const F_FIB_K: Any = Any { raw: (F_FIB_ADDR+20) as Raw };
        // stack: cust
        quad_rom[F_FIB_ADDR+20]     = Quad::vm_msg(ZERO, Any::rom(F_FIB_ADDR+21));  // cust m
        quad_rom[F_FIB_ADDR+21]     = Quad::vm_push(F_FIB_K2, Any::rom(F_FIB_ADDR+22));  // cust m fib-k2
        quad_rom[F_FIB_ADDR+22]     = Quad::vm_beh(PLUS_2, COMMIT);  // fib-k2[cust m]

pub const F_FIB_K2: Any = Any { raw: (F_FIB_ADDR+23) as Raw };
        // stack: cust m
        quad_rom[F_FIB_ADDR+23]     = Quad::vm_msg(ZERO, Any::rom(F_FIB_ADDR+24));  // cust m n
        quad_rom[F_FIB_ADDR+24]     = Quad::vm_alu_add(Any::rom(F_FIB_ADDR+25));  // cust m+n
        quad_rom[F_FIB_ADDR+25]     = Quad::vm_roll(PLUS_2, SEND_0);  // m+n cust

pub const _F_FIB_GEN: Any = Any { raw: (F_FIB_ADDR+26) as Raw };  // worker-generator facade for `fib`
        quad_rom[F_FIB_ADDR+26]     = Quad::vm_msg(ZERO, Any::rom(F_FIB_ADDR+27));  // msg
        quad_rom[F_FIB_ADDR+27]     = Quad::vm_push(F_FIB_BEH, Any::rom(F_FIB_ADDR+28));  // msg fib-beh
        quad_rom[F_FIB_ADDR+28]     = Quad::vm_new(ZERO, SEND_0);  // msg fib

pub const _F_FIB_END: usize = F_FIB_ADDR+29;
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
                                          (vm-push fib  ; n-2 k fib
                                            (vm-send 2  ; --
                                              COMMIT))))))
                                ))))))
                    )))
            )))))))
*/

pub const IS_EQ_ADDR: usize = _F_FIB_END;
pub const _IS_EQ_BEH: Any    = Any { raw: IS_EQ_ADDR as Raw };
        /*
        (define is-eq-beh
            (lambda (expect)
                (BEH actual
                    (assert-eq expect actual) )))
        */
        // stack: expect
        quad_rom[IS_EQ_ADDR+0]      = Quad::vm_dup(PLUS_1, Any::rom(IS_EQ_ADDR+1));  // expect expect
        quad_rom[IS_EQ_ADDR+1]      = Quad::vm_msg(ZERO, Any::rom(IS_EQ_ADDR+2));  // expect expect actual
        quad_rom[IS_EQ_ADDR+2]      = Quad::vm_cmp_eq(Any::rom(IS_EQ_ADDR+3));  // expect (expect == actual)
        quad_rom[IS_EQ_ADDR+3]      = Quad::vm_is_eq(TRUE, COMMIT);  // expect

pub const TEST_ADDR: usize = IS_EQ_ADDR+4;
pub const TEST_BEH: Any    = Any { raw: TEST_ADDR as Raw };
        quad_rom[TEST_ADDR+0]       = Quad::vm_drop(PLUS_3, Any::rom(T_DEQUE_ADDR));  // --
        //quad_rom[TEST_ADDR+0]       = Quad::vm_drop(PLUS_3, Any::rom(T_DICT_ADDR));  // --
        //quad_rom[TEST_ADDR+0]       = Quad::vm_drop(PLUS_3, Any::rom(TEST_ADDR+1));  // --
        quad_rom[TEST_ADDR+1]       = Quad::vm_push(PLUS_6, Any::rom(TEST_ADDR+2));  // 6
        quad_rom[TEST_ADDR+2]       = Quad::vm_push(EQ_8_BEH, Any::rom(TEST_ADDR+3));  // 6 eq-8-beh
        quad_rom[TEST_ADDR+3]       = Quad::vm_new(ZERO, Any::rom(TEST_ADDR+4));  // 6 eq-8
        quad_rom[TEST_ADDR+4]       = Quad::vm_push(F_FIB, Any::rom(TEST_ADDR+5));  // 6 eq-8 f-fib
        quad_rom[TEST_ADDR+5]       = Quad::vm_send(PLUS_2, COMMIT);  // --
pub const EQ_8_BEH: Any = Any { raw: (TEST_ADDR+6) as Raw };
        quad_rom[TEST_ADDR+6]       = Quad::vm_msg(ZERO, Any::rom(TEST_ADDR+7));  // msg
        quad_rom[TEST_ADDR+7]       = Quad::vm_is_eq(PLUS_8, COMMIT);  // assert_eq(8, msg)

        /* VM_DICT test suite */
pub const T_DICT_ADDR: usize = TEST_ADDR+8;
pub const _T_DICT_BEH: Any  = Any { raw: T_DICT_ADDR as Raw };
        quad_rom[T_DICT_ADDR+0]     = Quad::vm_dict_has(Any::rom(T_DICT_ADDR+1));  // #f
        quad_rom[T_DICT_ADDR+1]     = Quad::vm_is_eq(FALSE, Any::rom(T_DICT_ADDR+2));  // --
        quad_rom[T_DICT_ADDR+2]     = Quad::vm_push(NIL, Any::rom(T_DICT_ADDR+3));  // ()
        quad_rom[T_DICT_ADDR+3]     = Quad::vm_push(ZERO, Any::rom(T_DICT_ADDR+4));  // () 0
        quad_rom[T_DICT_ADDR+4]     = Quad::vm_dup(PLUS_2, Any::rom(T_DICT_ADDR+5));  // () 0 () 0
        quad_rom[T_DICT_ADDR+5]     = Quad::vm_dict_has(Any::rom(T_DICT_ADDR+6));  // #f
        quad_rom[T_DICT_ADDR+6]     = Quad::vm_is_eq(FALSE, Any::rom(T_DICT_ADDR+7));  // --
        quad_rom[T_DICT_ADDR+7]     = Quad::vm_dict_get(Any::rom(T_DICT_ADDR+8));  // #?
        quad_rom[T_DICT_ADDR+8]     = Quad::vm_is_eq(UNDEF, Any::rom(T_DICT_ADDR+9));  // --

        quad_rom[T_DICT_ADDR+9]     = Quad::vm_push(NIL, Any::rom(T_DICT_ADDR+10));  // ()
        quad_rom[T_DICT_ADDR+10]    = Quad::vm_push(ZERO, Any::rom(T_DICT_ADDR+11));  // () 0
        quad_rom[T_DICT_ADDR+11]    = Quad::vm_push(UNIT, Any::rom(T_DICT_ADDR+12));  // () 0 #unit
        quad_rom[T_DICT_ADDR+12]    = Quad::vm_dict_set(Any::rom(T_DICT_ADDR+13));  // {0:#unit}
        quad_rom[T_DICT_ADDR+13]    = Quad::vm_pick(PLUS_1, Any::rom(T_DICT_ADDR+14));  // {0:#unit} {0:#unit}
        quad_rom[T_DICT_ADDR+14]    = Quad::vm_push(ZERO, Any::rom(T_DICT_ADDR+15));  // {0:#unit} {0:#unit} 0
        quad_rom[T_DICT_ADDR+15]    = Quad::vm_dict_get(Any::rom(T_DICT_ADDR+16));  // {0:#unit} #unit
        quad_rom[T_DICT_ADDR+16]    = Quad::vm_is_eq(UNIT, Any::rom(T_DICT_ADDR+17));  // {0:#unit}

        quad_rom[T_DICT_ADDR+17]    = Quad::vm_push(PLUS_1, Any::rom(T_DICT_ADDR+18));  // {0:#unit} 1
        quad_rom[T_DICT_ADDR+18]    = Quad::vm_push(MINUS_1, Any::rom(T_DICT_ADDR+19));  // {0:#unit} 1 -1
        quad_rom[T_DICT_ADDR+19]    = Quad::vm_dict_add(Any::rom(T_DICT_ADDR+20));  // {1:-1, 0:#unit}
        quad_rom[T_DICT_ADDR+20]    = Quad::vm_pick(PLUS_1, Any::rom(T_DICT_ADDR+21));  // {1:-1, 0:#unit} {1:-1, 0:#unit}
        quad_rom[T_DICT_ADDR+21]    = Quad::vm_push(ZERO, Any::rom(T_DICT_ADDR+22));  // {1:-1, 0:#unit} {1:-1, 0:#unit} 0
        quad_rom[T_DICT_ADDR+22]    = Quad::vm_dict_get(Any::rom(T_DICT_ADDR+23));  // {1:-1, 0:#unit} #unit
        quad_rom[T_DICT_ADDR+23]    = Quad::vm_is_eq(UNIT, Any::rom(T_DICT_ADDR+24));  // {1:-1, 0:#unit}

        quad_rom[T_DICT_ADDR+24]    = Quad::vm_push(ZERO, Any::rom(T_DICT_ADDR+25));  // {1:-1, 0:#unit} 0
        quad_rom[T_DICT_ADDR+25]    = Quad::vm_dict_del(Any::rom(T_DICT_ADDR+26));  // {1:-1}
        quad_rom[T_DICT_ADDR+26]    = Quad::vm_pick(PLUS_1, Any::rom(T_DICT_ADDR+27));  // {1:-1} {1:-1}
        quad_rom[T_DICT_ADDR+27]    = Quad::vm_push(ZERO, Any::rom(T_DICT_ADDR+28));  // {1:-1} {1:-1} 0
        quad_rom[T_DICT_ADDR+28]    = Quad::vm_dict_get(Any::rom(T_DICT_ADDR+29));  // {1:-1} #undef
        quad_rom[T_DICT_ADDR+29]    = Quad::vm_is_eq(UNDEF, Any::rom(T_DICT_ADDR+30));  // {1:-1}

        quad_rom[T_DICT_ADDR+30]    = Quad::vm_push(PLUS_1, Any::rom(T_DICT_ADDR+31));  // {1:-1} 1
        quad_rom[T_DICT_ADDR+31]    = Quad::vm_push(FALSE, Any::rom(T_DICT_ADDR+32));  // {1:-1} 1 #f
        quad_rom[T_DICT_ADDR+32]    = Quad::vm_dict_add(Any::rom(T_DICT_ADDR+33));  // {1:#f, 1:-1}
        quad_rom[T_DICT_ADDR+33]    = Quad::vm_pick(PLUS_1, Any::rom(T_DICT_ADDR+34));  // {1:#f, 1:-1} {1:#f, 1:-1}
        quad_rom[T_DICT_ADDR+34]    = Quad::vm_push(PLUS_1, Any::rom(T_DICT_ADDR+35));  // {1:#f, 1:-1} {1:#f, 1:-1} 1
        quad_rom[T_DICT_ADDR+35]    = Quad::vm_push(TRUE, Any::rom(T_DICT_ADDR+36));  // {1:#f, 1:-1} {1:#f, 1:-1} 1 #t
        quad_rom[T_DICT_ADDR+36]    = Quad::vm_dict_set(Any::rom(T_DICT_ADDR+37));  // {1:#f, 1:-1} {1:#t, 1:-1}
        quad_rom[T_DICT_ADDR+37]    = Quad::vm_pick(PLUS_1, Any::rom(T_DICT_ADDR+38));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:#t, 1:-1}
        quad_rom[T_DICT_ADDR+38]    = Quad::vm_push(PLUS_1, Any::rom(T_DICT_ADDR+39));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:#t, 1:-1} 1
        quad_rom[T_DICT_ADDR+39]    = Quad::vm_dict_del(Any::rom(T_DICT_ADDR+40));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:-1}

        quad_rom[T_DICT_ADDR+40]    = Quad::vm_dup(PLUS_1, Any::rom(T_DICT_ADDR+41));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:-1} {1:-1}
        quad_rom[T_DICT_ADDR+41]    = Quad::vm_push(PLUS_1, Any::rom(T_DICT_ADDR+42));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:-1} {1:-1} 1
        quad_rom[T_DICT_ADDR+42]    = Quad::vm_dict_get(Any::rom(T_DICT_ADDR+43));  // {1:#f, 1:-1} {1:#t, 1:-1} {1:-1} -1
        quad_rom[T_DICT_ADDR+43]    = Quad::vm_is_eq(MINUS_1, COMMIT);  // {1:#f, 1:-1} {1:#t, 1:-1} {1:-1}

        /* VM_DEQUE test suite */
pub const T_DEQUE_ADDR: usize = T_DICT_ADDR+44;
pub const _T_DEQUE_BEH: Any  = Any { raw: T_DEQUE_ADDR as Raw };
        quad_rom[T_DEQUE_ADDR+0]    = Quad::vm_deque_empty(Any::rom(T_DEQUE_ADDR+1));  // #t
        quad_rom[T_DEQUE_ADDR+1]    = Quad::vm_is_eq(TRUE, Any::rom(T_DEQUE_ADDR+2));  // --
        quad_rom[T_DEQUE_ADDR+2]    = Quad::vm_deque_new(Any::rom(T_DEQUE_ADDR+3));  // (())
        quad_rom[T_DEQUE_ADDR+3]    = Quad::vm_dup(PLUS_1, Any::rom(T_DEQUE_ADDR+4));  // (()) (())
        quad_rom[T_DEQUE_ADDR+4]    = Quad::vm_deque_empty(Any::rom(T_DEQUE_ADDR+5));  // (()) #t
        quad_rom[T_DEQUE_ADDR+5]    = Quad::vm_is_eq(TRUE, Any::rom(T_DEQUE_ADDR+6));  // (())

        quad_rom[T_DEQUE_ADDR+6]    = Quad::vm_push(PLUS_1, Any::rom(T_DEQUE_ADDR+7));  // (()) 1
        quad_rom[T_DEQUE_ADDR+7]    = Quad::vm_deque_push(Any::rom(T_DEQUE_ADDR+8));  // ((1))
        quad_rom[T_DEQUE_ADDR+8]    = Quad::vm_push(PLUS_2, Any::rom(T_DEQUE_ADDR+9));  // ((1)) 2
        quad_rom[T_DEQUE_ADDR+9]    = Quad::vm_deque_push(Any::rom(T_DEQUE_ADDR+10));  // ((2 1))
        quad_rom[T_DEQUE_ADDR+10]   = Quad::vm_push(PLUS_3, Any::rom(T_DEQUE_ADDR+11));  // ((2 1)) 3
        quad_rom[T_DEQUE_ADDR+11]   = Quad::vm_deque_push(Any::rom(T_DEQUE_ADDR+12));  // ((3 2 1))
        quad_rom[T_DEQUE_ADDR+12]   = Quad::vm_pick(PLUS_1, Any::rom(T_DEQUE_ADDR+13));  // ((3 2 1)) ((3 2 1))
        quad_rom[T_DEQUE_ADDR+13]   = Quad::vm_deque_empty(Any::rom(T_DEQUE_ADDR+14));  // ((3 2 1)) #f
        quad_rom[T_DEQUE_ADDR+14]   = Quad::vm_is_eq(FALSE, Any::rom(T_DEQUE_ADDR+15));  // ((3 2 1))

        quad_rom[T_DEQUE_ADDR+15]   = Quad::vm_pick(PLUS_1, Any::rom(T_DEQUE_ADDR+16));  // ((3 2 1)) ((3 2 1))
        quad_rom[T_DEQUE_ADDR+16]   = Quad::vm_deque_len(Any::rom(T_DEQUE_ADDR+17));  // ((3 2 1)) 3
        quad_rom[T_DEQUE_ADDR+17]   = Quad::vm_is_eq(PLUS_3, Any::rom(T_DEQUE_ADDR+18));  // ((3 2 1))

        quad_rom[T_DEQUE_ADDR+18]   = Quad::vm_deque_pull(Any::rom(T_DEQUE_ADDR+19));  // (() 2 3) 1
        quad_rom[T_DEQUE_ADDR+19]   = Quad::vm_is_eq(PLUS_1, Any::rom(T_DEQUE_ADDR+20));  // (() 2 3)
        quad_rom[T_DEQUE_ADDR+20]   = Quad::vm_deque_pull(Any::rom(T_DEQUE_ADDR+21));  // (() 3) 2
        quad_rom[T_DEQUE_ADDR+21]   = Quad::vm_is_eq(PLUS_2, Any::rom(T_DEQUE_ADDR+22));  // (() 3) 2
        quad_rom[T_DEQUE_ADDR+22]   = Quad::vm_deque_pull(Any::rom(T_DEQUE_ADDR+23));  // (()) 3
        quad_rom[T_DEQUE_ADDR+23]   = Quad::vm_is_eq(PLUS_3, Any::rom(T_DEQUE_ADDR+24));  // (())
        quad_rom[T_DEQUE_ADDR+24]   = Quad::vm_deque_pull(Any::rom(T_DEQUE_ADDR+25));  // (()) #?
        quad_rom[T_DEQUE_ADDR+25]   = Quad::vm_is_eq(UNDEF, Any::rom(T_DEQUE_ADDR+26));  // (())

        quad_rom[T_DEQUE_ADDR+26]   = Quad::vm_dup(PLUS_1, Any::rom(T_DEQUE_ADDR+27));  // (()) (())
        quad_rom[T_DEQUE_ADDR+27]   = Quad::vm_deque_len(Any::rom(T_DEQUE_ADDR+28));  // (()) 0
        quad_rom[T_DEQUE_ADDR+28]   = Quad::vm_is_eq(ZERO, Any::rom(T_DEQUE_ADDR+29));  // (())

        quad_rom[T_DEQUE_ADDR+29]   = Quad::vm_dup(PLUS_1, Any::rom(T_DEQUE_ADDR+30));  // (()) (())
        quad_rom[T_DEQUE_ADDR+30]   = Quad::vm_msg(ZERO, Any::rom(T_DEQUE_ADDR+31));  // (()) (()) (@4 #unit)
        quad_rom[T_DEQUE_ADDR+31]   = Quad::vm_deque_put(Any::rom(T_DEQUE_ADDR+32));  // (()) (() (@4 #unit))
        quad_rom[T_DEQUE_ADDR+32]   = Quad::vm_msg(MINUS_1, Any::rom(T_DEQUE_ADDR+33));  // (()) (() (@4 #unit)) (#unit)
        quad_rom[T_DEQUE_ADDR+33]   = Quad::vm_deque_put(Any::rom(T_DEQUE_ADDR+34));  // (()) (() (#unit) (@4 #unit))
        quad_rom[T_DEQUE_ADDR+34]   = Quad::vm_msg(MINUS_2, Any::rom(T_DEQUE_ADDR+35));  // (()) (() (#unit) (@4 #unit)) ()
        quad_rom[T_DEQUE_ADDR+35]   = Quad::vm_deque_put(Any::rom(T_DEQUE_ADDR+36));  // (()) (() () (#unit) (@4 #unit))
        quad_rom[T_DEQUE_ADDR+36]   = Quad::vm_deque_pop(Any::rom(T_DEQUE_ADDR+37));  // (()) (((#unit) ())) (@4 #unit)
        quad_rom[T_DEQUE_ADDR+37]   = Quad::vm_roll(MINUS_2, Any::rom(T_DEQUE_ADDR+38));  // (()) (@4 #unit) (((#unit) ()))
        quad_rom[T_DEQUE_ADDR+38]   = Quad::vm_deque_pop(Any::rom(T_DEQUE_ADDR+39));  // (()) (@4 #unit) ((())) (#unit)
        quad_rom[T_DEQUE_ADDR+39]   = Quad::vm_roll(MINUS_3, Any::rom(T_DEQUE_ADDR+40));  // (()) (#unit) (@4 #unit) ((()))
        quad_rom[T_DEQUE_ADDR+40]   = Quad::vm_deque_pop(Any::rom(T_DEQUE_ADDR+41));  // (()) (#unit) (@4 #unit) (()) ()
        quad_rom[T_DEQUE_ADDR+41]   = Quad::vm_is_eq(NIL, Any::rom(T_DEQUE_ADDR+42));  // (()) (#unit) (@4 #unit) (())

        quad_rom[T_DEQUE_ADDR+42]   = Quad::vm_push(PLUS_1, Any::rom(T_DEQUE_ADDR+43));  // (()) (#unit) (@4 #unit) (()) 1
        quad_rom[T_DEQUE_ADDR+43]   = Quad::vm_deque_put(Any::rom(T_DEQUE_ADDR+44));  // (()) (#unit) (@4 #unit) (() 1)
        quad_rom[T_DEQUE_ADDR+44]   = Quad::vm_push(PLUS_2, Any::rom(T_DEQUE_ADDR+45));  // (()) (#unit) (@4 #unit) (() 1) 2
        quad_rom[T_DEQUE_ADDR+45]   = Quad::vm_deque_put(Any::rom(T_DEQUE_ADDR+46));  // (()) (#unit) (@4 #unit) (() 2 1)
        quad_rom[T_DEQUE_ADDR+46]   = Quad::vm_dup(PLUS_1, Any::rom(T_DEQUE_ADDR+47));  // (()) (#unit) (@4 #unit) (() 2 1) (() 2 1)
        quad_rom[T_DEQUE_ADDR+47]   = Quad::vm_deque_empty(Any::rom(T_DEQUE_ADDR+48));  // (()) (#unit) (@4 #unit) (() 2 1) #f
        quad_rom[T_DEQUE_ADDR+48]   = Quad::vm_is_eq(FALSE, Any::rom(T_DEQUE_ADDR+49));  // (()) (#unit) (@4 #unit) (() 2 1)

        quad_rom[T_DEQUE_ADDR+49]   = Quad::vm_deque_pop(Any::rom(T_DEQUE_ADDR+50));  // (()) (#unit) (@4 #unit) ((2)) 1
        quad_rom[T_DEQUE_ADDR+50]   = Quad::vm_is_eq(PLUS_1, Any::rom(T_DEQUE_ADDR+51));  // (()) (#unit) (@4 #unit) ((2))
        quad_rom[T_DEQUE_ADDR+51]   = Quad::vm_push(PLUS_3, Any::rom(T_DEQUE_ADDR+52));  // (()) (#unit) (@4 #unit) ((2)) 3
        quad_rom[T_DEQUE_ADDR+52]   = Quad::vm_deque_put(Any::rom(T_DEQUE_ADDR+53));  // (()) (#unit) (@4 #unit) ((2) 3)
        quad_rom[T_DEQUE_ADDR+53]   = Quad::vm_dup(PLUS_1, Any::rom(T_DEQUE_ADDR+54));  // (()) (#unit) (@4 #unit) ((2) 3) ((2) 3)
        quad_rom[T_DEQUE_ADDR+54]   = Quad::vm_deque_len(Any::rom(T_DEQUE_ADDR+55));  // (()) (#unit) (@4 #unit) ((2) 3) 2
        quad_rom[T_DEQUE_ADDR+55]   = Quad::vm_is_eq(PLUS_2, Any::rom(T_DEQUE_ADDR+56));  // (()) (#unit) (@4 #unit) ((2) 3)

        quad_rom[T_DEQUE_ADDR+56]   = Quad::vm_deque_pop(Any::rom(T_DEQUE_ADDR+57));  // (()) (#unit) (@4 #unit) (() 3) 2
        quad_rom[T_DEQUE_ADDR+57]   = Quad::vm_is_eq(PLUS_2, Any::rom(T_DEQUE_ADDR+58));  // (()) (#unit) (@4 #unit) (() 3)
        quad_rom[T_DEQUE_ADDR+58]   = Quad::vm_deque_pop(Any::rom(T_DEQUE_ADDR+59));  // (()) (#unit) (@4 #unit) (()) 3
        quad_rom[T_DEQUE_ADDR+59]   = Quad::vm_is_eq(PLUS_3, Any::rom(T_DEQUE_ADDR+60));  // (()) (#unit) (@4 #unit) (())
        quad_rom[T_DEQUE_ADDR+60]   = Quad::vm_deque_pop(Any::rom(T_DEQUE_ADDR+61));  // (()) (#unit) (@4 #unit) (()) #?
        quad_rom[T_DEQUE_ADDR+61]   = Quad::vm_is_eq(UNDEF, Any::rom(T_DEQUE_ADDR+62));  // (()) (#unit) (@4 #unit) (())
        quad_rom[T_DEQUE_ADDR+62]   = Quad::vm_dup(PLUS_1, Any::rom(T_DEQUE_ADDR+63));  // (()) (#unit) (@4 #unit) (()) (())
        quad_rom[T_DEQUE_ADDR+63]   = Quad::vm_deque_len(Any::rom(T_DEQUE_ADDR+64));  // (()) (#unit) (@4 #unit) (()) 0
        quad_rom[T_DEQUE_ADDR+64]   = Quad::vm_is_eq(ZERO, COMMIT);  // (()) (#unit) (@4 #unit) (())

        Core {
            quad_rom,
            quad_ram,
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
            if events == UNDEF {
                // begin actor-event transaction
                self.ram_mut(a_ptr).set_z(NIL);
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
            let ep = self.ep();//cont.y();
            println!("execute_instruction: ep={} -> {}", ep, self.mem(ep));
            let ip = self.ip();//cont.t();
            let ip_ = self.perform_op(ip);
            self.set_ip(ip_);
            let kp_ = self.cont_dequeue().unwrap();
            assert_eq!(kp, kp_);
            if self.typeq(INSTR_T, ip_) {
                // re-queue updated continuation
                println!("execute_instruction: kp'={} -> {}", kp_, self.ram(kp_));
                self.cont_enqueue(kp_);
            } else {
                // free dead continuation and associated event
                self.free(ep);
                self.free(kp);
            }
            true  // instruction executed
        } else {
            println!("execute_instruction: continuation queue empty");
            false  // continuation queue is empty
        }
    }
    fn perform_op(&mut self, ip: Any) -> Any {
        let instr = self.mem(ip);
        println!("perform_op: ip={} -> {}", ip, instr);
        assert!(instr.t() == INSTR_T);
        let _opr = instr.x();  // operation code
        let imm = instr.y();  // immediate argument
        let kip = instr.z();  // next instruction
        let ip_ = if let Some(Typed::Instr { op }) = Typed::from(instr) {
            println!("perform_op: op={}", op);
            match op {
                Op::Typeq { t, .. } => {
                    println!("vm_typeq: typ={}", t);
                    let val = self.stack_pop();
                    println!("vm_typeq: val={}", val);
                    let r = if self.typeq(t.any(), val) { TRUE } else { FALSE };
                    self.stack_push(r);
                    kip
                },
                Op::Dict { op, .. } => {
                    println!("vm_dict: op={}", op);
                    match op {
                        Dict::Has => {
                            let key = self.stack_pop();
                            let dict = self.stack_pop();
                            let b = self.dict_has(dict, key);
                            let v = if b { TRUE } else { FALSE };
                            self.stack_push(v);
                        },
                        Dict::Get => {
                            let key = self.stack_pop();
                            let dict = self.stack_pop();
                            let v = self.dict_get(dict, key);
                            self.stack_push(v);
                        },
                        Dict::Add => {
                            let value = self.stack_pop();
                            let key = self.stack_pop();
                            let dict = self.stack_pop();
                            let d = self.dict_add(dict, key, value);
                            self.stack_push(d);
                        },
                        Dict::Set => {
                            let value = self.stack_pop();
                            let key = self.stack_pop();
                            let dict = self.stack_pop();
                            let d = self.dict_set(dict, key, value);
                            self.stack_push(d);
                        },
                        Dict::Del => {
                            let key = self.stack_pop();
                            let dict = self.stack_pop();
                            let d = self.dict_del(dict, key);
                            self.stack_push(d);
                        },
                    };
                    kip
                },
                Op::Deque { op, .. } => {
                    println!("vm_deque: op={}", op);
                    match op {
                        Deque::New => {
                            let deque = self.deque_new();
                            self.stack_push(deque);
                        },
                        Deque::Empty => {
                            let deque = self.stack_pop();
                            let b = self.deque_empty(deque);
                            let v = if b { TRUE } else { FALSE };
                            self.stack_push(v);
                        },
                        Deque::Push => {
                            let item = self.stack_pop();
                            let old = self.stack_pop();
                            let new = self.deque_push(old, item);
                            self.stack_push(new);
                        },
                        Deque::Pop => {
                            let old = self.stack_pop();
                            let (new, item) = self.deque_pop(old);
                            self.stack_push(new);
                            self.stack_push(item);
                        },
                        Deque::Put => {
                            let item = self.stack_pop();
                            let old = self.stack_pop();
                            let new = self.deque_put(old, item);
                            self.stack_push(new);
                        },
                        Deque::Pull => {
                            let old = self.stack_pop();
                            let (new, item) = self.deque_pull(old);
                            self.stack_push(new);
                            self.stack_push(item);
                        },
                        Deque::Len => {
                            let deque = self.stack_pop();
                            let n = self.deque_len(deque);
                            self.stack_push(Any::fix(n));
                        },
                    };
                    kip
                },
                Op::Pair { n, .. } => {
                    println!("vm_pair: cnt={}", n);
                    let n = n.any().fix_num().unwrap();
                    self.stack_pairs(n);
                    kip
                },
                Op::Part { n, .. } => {
                    println!("vm_part: cnt={}", n);
                    let n = n.any().fix_num().unwrap();
                    self.stack_parts(n);
                    kip
                },
                Op::Nth { n, .. } => {
                    println!("vm_nth: idx={}", n);
                    let lst = self.stack_pop();
                    println!("vm_nth: lst={}", lst);
                    let n = n.any().fix_num().unwrap();
                    let r = self.extract_nth(lst, n);
                    println!("vm_nth: r={}", r);
                    self.stack_push(r);
                    kip
                },
                Op::Push { v, .. } => {
                    println!("vm_push: val={}", v);
                    self.stack_push(v.any());
                    kip
                },
                Op::Depth { .. } => {
                    let lst = self.sp();
                    println!("vm_depth: lst={}", lst);
                    let n = self.list_len(lst);
                    let n = Any::fix(n);
                    println!("vm_depth: n={}", n);
                    self.stack_push(n);
                    kip
                },
                Op::Drop { n, .. } => {
                    println!("vm_drop: n={}", n);
                    let mut n = n.any().fix_num().unwrap();
                    assert!(n < 64);  // FIXME: replace with cycle-limit(s) in Sponsor
                    while n > 0 {
                        self.stack_pop();
                        n -= 1;
                    };
                    kip
                },
                Op::Pick { n, .. } => {
                    println!("vm_pick: idx={}", n);
                    let n = n.any().fix_num().unwrap();
                    let r = if n > 0 {
                        let lst = self.sp();
                        self.extract_nth(lst, n)
                    } else {
                        UNDEF
                    };
                    println!("vm_pick: r={}", r);
                    self.stack_push(r);
                    kip
                },
                Op::Dup { n, .. } => {
                    println!("vm_dup: n={}", n);
                    let n = n.any().fix_num().unwrap();
                    self.stack_dup(n);
                    kip
                },
                Op::Roll { n, .. } => {
                    println!("vm_roll: idx={}", n);
                    let n = n.any().fix_num().unwrap();
                    self.stack_roll(n);
                    kip
                },
                Op::Alu { op, .. } => {
                    println!("vm_alu: op={}", op);
                    let r = if op == Alu::Not {
                        let v = self.stack_pop();
                        println!("vm_alu: v={}", v);
                        match v.fix_num() {
                            Some(n) => Any::fix(!n),
                            _ => UNDEF,
                        }
                    } else {
                        let vv = self.stack_pop();
                        println!("vm_alu: vv={}", vv);
                        let v = self.stack_pop();
                        println!("vm_alu: v={}", v);
                            match (v.fix_num(), vv.fix_num()) {
                            (Some(n), Some(nn)) => {
                                match op {
                                    Alu::And => Any::fix(n & nn),
                                    Alu::Or => Any::fix(n | nn),
                                    Alu::Xor => Any::fix(n ^ nn),
                                    Alu::Add => Any::fix(n + nn),
                                    Alu::Sub => Any::fix(n - nn),
                                    Alu::Mul => Any::fix(n * nn),
                                    _ => UNDEF,
                                }
                            }
                            _ => UNDEF
                        }
                    };
                    println!("vm_alu: r={}", r);
                    self.stack_push(r);
                    kip
                },
                Op::Eq { v, .. } => {
                    println!("vm_eq: v={}", v);
                    let vv = self.stack_pop();
                    println!("vm_eq: vv={}", vv);
                    let r = if imm == vv { TRUE } else { FALSE };
                    println!("vm_eq: r={}", r);
                    self.stack_push(r);
                    kip
                },
                Op::Cmp { op, .. } => {
                    println!("vm_cmp: op={}", op);
                    let vv = self.stack_pop();
                    println!("vm_cmp: vv={}", vv);
                    let v = self.stack_pop();
                    println!("vm_cmp: v={}", v);
                    let b = if op == Cmp::Eq {
                        v == vv
                    } else if op == Cmp::Ne {
                        v != vv
                    } else {
                        match (v.fix_num(), vv.fix_num()) {
                            (Some(n), Some(nn)) => {
                                match op {
                                    Cmp::Ge => n >= nn,
                                    Cmp::Gt => n > nn,
                                    Cmp::Lt => n < nn,
                                    Cmp::Le => n <= nn,
                                    _ => false,
                                }
                            }
                            _ => false
                        }
                    };
                    let r = if b { TRUE } else { FALSE };
                    println!("vm_cmp: r={}", r);
                    self.stack_push(r);
                    kip
                },
                Op::If { .. } => {
                    let b = self.stack_pop();
                    println!("vm_if: b={}", b);
                    println!("vm_if: t={}", imm);
                    println!("vm_if: f={}", kip);
                    //if falsey(b) { f.any() } else { t.any() }
                    if falsey(b) { kip } else { imm }
                },
                Op::Msg { n, .. } => {
                    println!("vm_msg: idx={}", n);
                    let n = n.any().fix_num().unwrap();
                    let ep = self.ep();
                    let event = self.mem(ep);
                    let msg = event.y();
                    let r = self.extract_nth(msg, n);
                    println!("vm_msg: r={}", r);
                    self.stack_push(r);
                    kip
                },
                Op::My { op, .. } => {
                    println!("vm_my: op={}", op);
                    let me = self.self_ptr();
                    println!("vm_my: me={} -> {}", me, self.ram(me));
                    match op {
                        My::Addr => {
                            let ep = self.ep();
                            let target = self.ram(ep).x();
                            println!("vm_my: self={}", target);
                            self.stack_push(target);
                        },
                        My::Beh => {
                            let beh = self.ram(me).x();
                            println!("vm_my: beh={}", beh);
                            self.stack_push(beh);
                        },
                        My::State => {
                            let state = self.ram(me).y();
                            println!("vm_my: state={}", state);
                            self.push_list(state);
                        },
                    }
                    kip
                }
                Op::Send { n, .. } => {
                    println!("vm_send: idx={}", n);
                    let num = n.any().fix_num().unwrap();
                    let target = self.stack_pop();
                    println!("vm_send: target={}", target);
                    assert!(self.typeq(ACTOR_T, target));
                    let msg = if num > 0 {
                        self.pop_counted(num)
                    } else {
                        self.stack_pop()
                    };
                    println!("vm_send: msg={}", msg);
                    let ep = self.new_event(target, msg);
                    let me = self.self_ptr();
                    println!("vm_send: me={} -> {}", me, self.ram(me));
                    let next = self.ram(me).z();
                    if next.is_ram() {
                        self.ram_mut(ep).set_z(next);
                        println!("vm_send: ep={} -> {}", ep, self.mem(ep));
                    }
                    self.ram_mut(me).set_z(ep);
                    println!("vm_send: me'={} -> {}", me, self.mem(me));
                    kip
                },
                Op::New { n, .. } => {
                    println!("vm_new: idx={}", n);
                    let num = n.any().fix_num().unwrap();
                    let ip = self.stack_pop();
                    println!("vm_new: ip={}", ip);
                    assert!(self.typeq(INSTR_T, ip));
                    let sp = self.pop_counted(num);
                    println!("vm_new: sp={}", sp);
                    let a = self.new_actor(ip, sp);
                    println!("vm_new: actor={}", a);
                    self.stack_push(a);
                    kip
                },
                Op::Beh { n, .. } => {
                    println!("vm_beh: idx={}", n);
                    let num = n.any().fix_num().unwrap();
                    let ip = self.stack_pop();
                    println!("vm_beh: ip={}", ip);
                    assert!(self.typeq(INSTR_T, ip));
                    let sp = self.pop_counted(num);
                    println!("vm_beh: sp={}", sp);
                    let me = self.self_ptr();
                    let actor = self.ram_mut(me);
                    println!("vm_beh: me={} -> {}", me, actor);
                    actor.set_x(ip);  // replace behavior function
                    actor.set_y(sp);  // replace state data
                    println!("vm_beh: me'={} -> {}", me, self.ram(me));
                    kip
                },
                Op::End { op } => {
                    println!("vm_end: op={}", op);
                    let me = self.self_ptr();
                    println!("vm_end: me={} -> {}", me, self.ram(me));
                    match op {
                        End::Abort => {
                            let _r = self.stack_pop();  // reason for abort
                            println!("vm_end: reason={}", _r);
                            self.actor_abort(me);
                            //UNDEF
                            panic!("End::Abort should signal controller")
                        },
                        End::Stop => {
                            println!("vm_end: MEMORY={}", self.ram(MEMORY));
                            //UNIT
                            panic!("End::Stop terminated continuation")
                        },
                        End::Commit => {
                            self.actor_commit(me);
                            TRUE
                        },
                        End::Release => {
                            self.ram_mut(me).set_y(NIL);  // no retained stack
                            self.actor_commit(me);
                            self.free(me);  // free actor
                            FALSE
                        },
                    }
                },
                Op::IsEq { .. } => {
                    println!("vm_is_eq: expect={}", imm);
                    let vv = self.stack_pop();
                    println!("vm_is_eq: actual={}", vv);
                    assert_eq!(imm, vv);
                    kip
                },
                Op::IsNe { .. } => {
                    println!("vm_is_ne: expect={}", imm);
                    let vv = self.stack_pop();
                    println!("vm_is_ne: actual={}", vv);
                    assert_ne!(imm, vv);
                    kip
                },
            }
        } else {
            panic!("Illegal instruction!");
        };
        println!("perform_op: ip'={} -> {}", ip_, self.mem(ip_));
        ip_
    }

    fn event_enqueue(&mut self, ep: Any) {
        self.ram_mut(ep).set_z(NIL);
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
                self.set_e_last(NIL)
            }
            Some(ep)
        } else {
            None
        }
    }

    fn cont_enqueue(&mut self, kp: Any) {
        self.ram_mut(kp).set_z(NIL);
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
                self.set_k_last(NIL)
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
        self.ram_mut(me).set_z(UNDEF);
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
        self.ram_mut(me).set_z(UNDEF);
    }
    pub fn self_ptr(&self) -> Any {
        let ep = self.ep();
        let target = self.ram(ep).x();
        let a_ptr = self.cap_to_ptr(target);
        a_ptr
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
    fn push_list(&mut self, ptr: Any) {
        if self.typeq(PAIR_T, ptr) {
            self.push_list(self.cdr(ptr));
            self.stack_push(self.car(ptr));
        }
    }
    fn pop_counted(&mut self, n: isize) -> Any {
        let mut n = n;
        if n > 0 {  // build list from stack
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
        } else {  // empty list
            NIL
        }
    }
    fn split_nth(&self, lst: Any, n: isize) -> (Any, Any) {
        let mut p = lst;
        let mut q = UNDEF;
        let mut n = n;
        assert!(n < 64);
        while n > 1 && self.typeq(PAIR_T, p) {
            q = p;
            p = self.cdr(p);
            n -= 1;
        }
        (q, p)
    }
    fn extract_nth(&self, lst: Any, n: isize) -> Any {
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
    pub fn dict_add(&mut self, dict: Any, key: Any, value: Any) -> Any {
        let dict = Quad::dict_t(key, value, dict);
        self.alloc(&dict)
    }
    pub fn dict_set(&mut self, dict: Any, key: Any, value: Any) -> Any {
        let d = if self.dict_has(dict, key) {
            self.dict_del(dict, key)
        } else {
            dict
        };
        self.dict_add(d, key, value)
    }
    pub fn dict_del(&mut self, dict: Any, key: Any) -> Any {
        if self.typeq(DICT_T, dict) {
            let entry = self.mem(dict);
            let k = entry.x();  // key
            let value = entry.y();
            let next = entry.z();
            if key == k {
                next
            } else {
                let d = self.dict_del(next, key);
                self.dict_add(d, k, value)
            }
        } else {
            NIL
        }
    }

    pub fn deque_new(&mut self) -> Any { EMPTY_DQ }
    pub fn deque_empty(&self, deque: Any) -> bool {
        if self.typeq(PAIR_T, deque) {
            let front = self.car(deque);
            let back = self.cdr(deque);
            !(self.typeq(PAIR_T, front) || self.typeq(PAIR_T, back))
        } else {
            true  // default = empty
        }
    }
    pub fn deque_push(&mut self, deque: Any, item: Any) -> Any {
        let front = self.car(deque);
        let front = self.cons(item, front);
        let back = self.cdr(deque);
        self.cons(front, back)
    }
    pub fn deque_pop(&mut self, deque: Any) -> (Any, Any) {
        if self.typeq(PAIR_T, deque) {
            let mut front = self.car(deque);
            let mut back = self.cdr(deque);
            if !self.typeq(PAIR_T, front) {
                while self.typeq(PAIR_T, back) {
                    // transfer back to front
                    let item = self.car(back);
                    back = self.cdr(back);
                    front = self.cons(item, front);
                }
            }
            if self.typeq(PAIR_T, front) {
                let item = self.car(front);
                front = self.cdr(front);
                let deque = self.cons(front, back);
                return (deque, item)
            }
        }
        (deque, UNDEF)
    }
    pub fn deque_put(&mut self, deque: Any, item: Any) -> Any {
        let front = self.car(deque);
        let back = self.cdr(deque);
        let back = self.cons(item, back);
        self.cons(front, back)
    }
    pub fn deque_pull(&mut self, deque: Any) -> (Any, Any) {
        if self.typeq(PAIR_T, deque) {
            let mut front = self.car(deque);
            let mut back = self.cdr(deque);
            if !self.typeq(PAIR_T, back) {
                while self.typeq(PAIR_T, front) {
                    // transfer front to back
                    let item = self.car(front);
                    front = self.cdr(front);
                    back = self.cons(item, back);
                }
            }
            if self.typeq(PAIR_T, back) {
                let item = self.car(back);
                back = self.cdr(back);
                let deque = self.cons(front, back);
                return (deque, item)
            }
        }
        (deque, UNDEF)
    }
    pub fn deque_len(&self, deque: Any) -> isize {
        let front = self.car(deque);
        let back = self.cdr(deque);
        self.list_len(front) + self.list_len(back)
    }

    fn e_first(&self) -> Any { self.ram(DDEQUE).t() }
    fn set_e_first(&mut self, ptr: Any) { self.ram_mut(DDEQUE).set_t(ptr); }
    fn e_last(&self) -> Any { self.ram(DDEQUE).x() }
    fn set_e_last(&mut self, ptr: Any) { self.ram_mut(DDEQUE).set_x(ptr); }
    fn k_first(&self) -> Any { self.ram(DDEQUE).y() }
    fn set_k_first(&mut self, ptr: Any) { self.ram_mut(DDEQUE).set_y(ptr); }
    fn k_last(&self) -> Any { self.ram(DDEQUE).z() }
    fn set_k_last(&mut self, ptr: Any) { self.ram_mut(DDEQUE).set_z(ptr); }

    fn mem_top(&self) -> Any { self.ram(MEMORY).t() }
    fn set_mem_top(&mut self, ptr: Any) { self.ram_mut(MEMORY).set_t(ptr); }
    fn mem_next(&self) -> Any { self.ram(MEMORY).x() }
    fn set_mem_next(&mut self, ptr: Any) { self.ram_mut(MEMORY).set_x(ptr); }
    fn mem_free(&self) -> Any { self.ram(MEMORY).y() }
    fn set_mem_free(&mut self, fix: Any) { self.ram_mut(MEMORY).set_y(fix); }
    fn _mem_root(&self) -> Any { self.ram(MEMORY).z() }
    fn _set_mem_root(&mut self, ptr: Any) { self.ram_mut(MEMORY).set_z(ptr); }

    pub fn new_event(&mut self, target: Any, msg: Any) -> Any {
        assert!(self.typeq(ACTOR_T, target));
        let event = Quad::event_t(target, msg, NIL);
        self.alloc(&event)
    }
    pub fn new_cont(&mut self, ip: Any, sp: Any, ep: Any) -> Any {
        let cont = Quad::cont_t(ip, sp, ep, NIL);
        self.alloc(&cont)
    }
    pub fn new_actor(&mut self, beh: Any, state: Any) -> Any {
        let actor = Quad::new_actor(beh, state);
        let ptr = self.alloc(&actor);
        self.ptr_to_cap(ptr)
    }

    fn stack_pairs(&mut self, n: isize) {
        assert!(n < 64);  // FIXME: replace with cycle-limit(s) in Sponsor
        if n > 0 {
            let mut n = n;
            let h = self.stack_pop();
            let lst = self.cons(h, NIL);
            let mut p = lst;
            while n > 1 {
                let h = self.stack_pop();
                let q = self.cons(h, NIL);
                self.set_cdr(p, q);
                p = q;
                n -= 1;
            }
            let t = self.stack_pop();
            self.set_cdr(p, t);
            self.stack_push(lst);
        };
    }
    fn stack_parts(&mut self, n: isize) {
        assert!(n < 64);  // FIXME: replace with cycle-limit(s) in Sponsor
        let mut s = self.stack_pop();  // list to destructure
        if n > 0 {
            let mut n = n;
            let lst = self.cons(self.car(s), NIL);
            let mut p = lst;
            while n > 1 {
                s = self.cdr(s);
                let q = self.cons(self.car(s), NIL);
                self.set_cdr(p, q);
                p = q;
                n -= 1;
            }
            let t = self.cons(self.cdr(s), self.sp());
            self.set_cdr(p, t);
            self.set_sp(lst);
        }
    }
    fn stack_roll(&mut self, n: isize) {
        if n > 1 {
            assert!(n < 64);  // FIXME: replace with cycle-limit(s) in Sponsor
            let sp = self.sp();
            let (q, p) = self.split_nth(sp, n);
            if self.typeq(PAIR_T, p) {
                self.set_cdr(q, self.cdr(p));
                self.set_cdr(p, sp);
                self.set_sp(p);
            } else {
                self.stack_push(UNDEF);  // out of range
            }
        } else if n < -1 {
            assert!(n > -64);  // FIXME: replace with cycle-limit(s) in Sponsor
            let sp = self.sp();
            let (_q, p) = self.split_nth(sp, -n);
            if self.typeq(PAIR_T, p) {
                self.set_sp(self.cdr(sp));
                self.set_cdr(sp, self.cdr(p));
                self.set_cdr(p, sp);
            } else {
                self.stack_pop();  // out of range
            }
        };
    }
    fn stack_dup(&mut self, n: isize) {
        let mut n = n;
        if n > 0 {
            let mut s = self.sp();
            let sp = self.cons(self.car(s), NIL);
            let mut p = sp;
            s = self.cdr(s);
            n -= 1;
            while n > 0 {
                let q = self.cons(self.car(s), NIL);
                self.set_cdr(p, q);
                p = q;
                s = self.cdr(s);
                n -= 1;
            }
            self.set_cdr(p, self.sp());
            self.set_sp(sp);
        }
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
            self.free(sp);  // free pair holding stack item
            item
        } else {
            println!("stack_pop: underflow!");  // NOTE: this is just a warning, returning UNDEF...
            UNDEF
        }
    }
    fn stack_push(&mut self, val: Any) {
        let sp = self.cons(val, self.sp());
        self.set_sp(sp);
    }

    pub fn cons(&mut self, car: Any, cdr: Any) -> Any {
        let pair = Quad::pair_t(car, cdr);
        self.alloc(&pair)
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

    pub fn ip(&self) -> Any {  // instruction pointer
        let quad = self.ram(self.k_first());
        quad.t()
    }
    pub fn sp(&self) -> Any {  // stack pointer
        let quad = self.ram(self.k_first());
        quad.x()
    }
    pub fn ep(&self) -> Any {  // event pointer
        let quad = self.ram(self.k_first());
        quad.y()
    }
    fn set_ip(&mut self, ptr: Any) {
        let quad = self.ram_mut(self.k_first());
        quad.set_t(ptr)
    }
    fn set_sp(&mut self, ptr: Any) {
        let quad = self.ram_mut(self.k_first());
        quad.set_x(ptr)
    }

    pub fn typeq(&self, typ: Any, val: Any) -> bool {
        if typ == FIXNUM_T {
            val.is_fix()
        } else if typ == ACTOR_T {
            if val.is_cap() {
                let ptr = Any::ram(val.addr());  // WARNING: converting Cap to Ptr!
                self.ram(ptr).t() == ACTOR_T
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
        val.is_ram() && (val.addr() < self.mem_top().addr())
    }
    fn ptr_to_cap(&self, ptr: Any) -> Any {
        assert!(self.ram(ptr).t() == ACTOR_T);
        let cap = Any::cap(ptr.addr());
        cap
    }
    fn cap_to_ptr(&self, cap: Any) -> Any {
        let ptr = Any::ram(cap.addr());
        assert!(self.ram(ptr).t() == ACTOR_T);
        ptr
    }

    pub fn alloc(&mut self, init: &Quad) -> Any {
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
        *self.ram_mut(ptr) = *init;  // copy initial value
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

    pub fn next(&self, ptr: Any) -> Any {
        if ptr.is_ptr() {
            let quad = self.mem(ptr);
            if quad.t() == INSTR_T {
                let op = quad.x();
                if op == VM_IF || op == VM_END {
                    UNDEF
                } else {
                    quad.z()
                }
            } else if quad.t() == PAIR_T {
                quad.y()
            } else {
                quad.z()
            }
        } else {
            UNDEF
        }
    }
}

fn falsey(v: Any) -> bool {
    v == FALSE || v == UNDEF || v == NIL || v == ZERO
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
        match quad.t() {
            LITERAL_T => Some(Typed::Literal),
            TYPE_T => Some(Typed::Type),
            EVENT_T => Some(Typed::Event { target: quad.get_x().cap(), msg: quad.get_y(), next: quad.get_z().ptr() }),
            INSTR_T => Op::from(quad),
            ACTOR_T => Some(Typed::Actor { beh: quad.get_x().ptr(), state: quad.get_y().ptr(), events: match quad.z() {
                UNDEF => None,
                val => Some(val.val().ptr()),
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
            Typed::Empty => Quad::new(UNDEF, UNDEF, UNDEF, UNDEF),
            Typed::Literal => Quad::new(LITERAL_T, UNDEF, UNDEF, UNDEF),
            Typed::Type => Quad::new(TYPE_T, UNDEF, UNDEF, UNDEF),
            Typed::Event { target, msg, next } => Quad::init(EVENT_T.val(), target.val(), msg.val(), next.val()),
            Typed::Cont { ip, sp, ep, next } => Quad::init(ip.val(), sp.val(), ep.val(), next.val()),
            Typed::Instr { op } => op.quad(),
            Typed::Actor { beh, state, events } => Quad::init(ACTOR_T.val(), beh.val(), state.val(), match events {
                None => UNDEF.val(),
                Some(ptr) => ptr.val(),
            }),
            Typed::Symbol { hash, key, val } => Quad::init(SYMBOL_T.val(), hash.val(), key.val(), val.val()),
            Typed::Pair { car, cdr } => Quad::new(PAIR_T, car.any(), cdr.any(), UNDEF),
            //Typed::Fexpr { func } => Quad::new(FEXPR_T.val(), func.val(), UNDEF, UNDEF),
            Typed::Dict { key, value, next } => Quad::init(DICT_T.val(), key.val(), value.val(), next.val()),
            Typed::Free { next } => Quad::new(FREE_T, UNDEF, UNDEF, next.any()),
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
                None => UNDEF.val(),
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
        assert!(quad.t() == INSTR_T);
        match quad.x() {
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
            Op::Typeq { t, k } => Quad::new(INSTR_T, VM_TYPEQ, t.any(), k.any()),
            Op::Dict { op, k } => Quad::new(INSTR_T, VM_DICT, op.any(), k.any()),
            Op::Deque { op, k } => Quad::new(INSTR_T, VM_DEQUE, op.any(), k.any()),
            Op::Pair { n, k } => Quad::new(INSTR_T, VM_PAIR, n.any(), k.any()),
            Op::Part { n, k } => Quad::new(INSTR_T, VM_PART, n.any(), k.any()),
            Op::Nth { n, k } => Quad::new(INSTR_T, VM_NTH, n.any(), k.any()),
            Op::Push { v, k } => Quad::new(INSTR_T, VM_PUSH, v.any(), k.any()),
            Op::Depth { k } => Quad::new(INSTR_T, VM_DEPTH, UNDEF, k.any()),
            Op::Drop { n, k } => Quad::new(INSTR_T, VM_DROP, n.any(), k.any()),
            Op::Pick { n, k } => Quad::new(INSTR_T, VM_PICK, n.any(), k.any()),
            Op::Dup { n, k } => Quad::new(INSTR_T, VM_DUP, n.any(), k.any()),
            Op::Roll { n, k } => Quad::new(INSTR_T, VM_ROLL, n.any(), k.any()),
            Op::Alu { op, k } => Quad::new(INSTR_T, VM_ALU, op.any(), k.any()),
            Op::Eq { v, k } => Quad::new(INSTR_T, VM_EQ, v.any(), k.any()),
            Op::Cmp { op, k } => Quad::new(INSTR_T, VM_CMP, op.any(), k.any()),
            Op::If { t, f } => Quad::new(INSTR_T, VM_IF, t.any(), f.any()),
            Op::Msg { n, k } => Quad::new(INSTR_T, VM_MSG, n.any(), k.any()),
            Op::My { op, k } => Quad::new(INSTR_T, VM_MY, op.any(), k.any()),
            Op::Send { n, k } => Quad::new(INSTR_T, VM_SEND, n.any(), k.any()),
            Op::New { n, k } => Quad::new(INSTR_T, VM_NEW, n.any(), k.any()),
            Op::Beh { n, k } => Quad::new(INSTR_T, VM_BEH, n.any(), k.any()),
            Op::End { op } => Quad::new(INSTR_T, VM_END, op.any(), UNDEF),
            Op::IsEq { v, k } => Quad::new(INSTR_T, VM_IS_EQ, v.any(), k.any()),
            Op::IsNe { v, k } => Quad::new(INSTR_T, VM_IS_NE, v.any(), k.any()),
        }
    }
}
impl fmt::Display for Op {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            //Op::Typeq { t, k } => write!(fmt, "Typeq{{ t:{}, k:{} }}", t, k),
            Op::Typeq { t, k } => {
                match t.any() {
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
        match val.any() {
            DICT_HAS => Some(Dict::Has),
            DICT_GET => Some(Dict::Get),
            DICT_ADD => Some(Dict::Add),
            DICT_SET => Some(Dict::Set),
            DICT_DEL => Some(Dict::Del),
            _ => None,
        }
    }
    pub fn any(self) -> Any {  // NOTE: consumes `self`
        match self {
            Dict::Has => DICT_HAS,
            Dict::Get => DICT_GET,
            Dict::Add => DICT_ADD,
            Dict::Set => DICT_SET,
            Dict::Del => DICT_DEL,
        }
    }
    pub fn val(self) -> Val {  // NOTE: consumes `self`
        self.any().val()
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
        match val.any() {
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
    pub fn any(self) -> Any {  // NOTE: consumes `self`
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
    pub fn val(self) -> Val {  // NOTE: consumes `self`
        self.any().val()
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
        match val.any() {
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
    pub fn any(self) -> Any {  // NOTE: consumes `self`
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
    pub fn val(self) -> Val {  // NOTE: consumes `self`
        self.any().val()
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
        match val.any() {
            CMP_EQ => Some(Cmp::Eq),
            CMP_GE => Some(Cmp::Ge),
            CMP_GT => Some(Cmp::Gt),
            CMP_LT => Some(Cmp::Lt),
            CMP_LE => Some(Cmp::Le),
            CMP_NE => Some(Cmp::Ne),
            _ => None,
        }
    }
    pub fn any(self) -> Any {  // NOTE: consumes `self`
        match self {
            Cmp::Eq => CMP_EQ,
            Cmp::Ge => CMP_GE,
            Cmp::Gt => CMP_GT,
            Cmp::Lt => CMP_LT,
            Cmp::Le => CMP_LE,
            Cmp::Ne => CMP_NE,
        }
    }
    pub fn val(self) -> Val {  // NOTE: consumes `self`
        self.any().val()
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
        match val.any() {
            MY_SELF => Some(My::Addr),
            MY_BEH => Some(My::Beh),
            MY_STATE => Some(My::State),
            _ => None,
        }
    }
    pub fn any(self) -> Any {  // NOTE: consumes `self`
        match self {
            My::Addr => MY_SELF,
            My::Beh => MY_BEH,
            My::State => MY_STATE,
        }
    }
    pub fn val(self) -> Val {  // NOTE: consumes `self`
        self.any().val()
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
        match val.any() {
            END_ABORT => Some(End::Abort),
            END_STOP => Some(End::Stop),
            END_COMMIT => Some(End::Commit),
            END_RELEASE => Some(End::Release),
            _ => None,
        }
    }
    pub fn any(self) -> Any {  // NOTE: consumes `self`
        match self {
            End::Abort => END_ABORT,
            End::Stop => END_STOP,
            End::Commit => END_COMMIT,
            End::Release => END_RELEASE,
        }
    }
    pub fn val(self) -> Val {  // NOTE: consumes `self`
        self.any().val()
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
        match self.any() {
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
            _ => {
                let ofs = self.raw & !MSK_RAW;
                if self.raw == ofs {
                    write!(fmt, "*{}", ofs)
                } else {
                    write!(fmt, "^{}", ofs)
                }
            },
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Cap { raw: Raw }
impl Cap {
    pub fn new(raw: Raw) -> Cap {
        Cap { raw: (raw & !(DIR_RAW | OPQ_RAW)) }
    }
    pub fn from(val: Val) -> Option<Cap> {
        let raw = val.raw();
        if (raw & (DIR_RAW | OPQ_RAW)) == OPQ_RAW {
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

//#[cfg(test)] -- use this if/when the tests are in a sub-module
#[test]
fn base_types_are_32_bits() {
    assert_eq!(4, std::mem::size_of::<Raw>());
    assert_eq!(4, std::mem::size_of::<Num>());
    assert_eq!(4, std::mem::size_of::<Val>());
    assert_eq!(4, std::mem::size_of::<Fix>());
    assert_eq!(4, std::mem::size_of::<Ptr>());
    assert_eq!(4, std::mem::size_of::<Cap>());
    assert_eq!(4, std::mem::size_of::<Any>());
    assert_eq!(16, std::mem::size_of::<Quad>());
    //assert_eq!(16, std::mem::size_of::<Typed>());  // enumeration discriminator adds +4...
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
    assert_eq!(ZERO, core.mem_free());
    assert_eq!(NIL, core.mem_next());
    assert_ne!(NIL, core.e_first());
    assert_eq!(NIL, core.k_first());
    for raw in 0..256 {
        let quad = core.mem(Any::new(raw));
        let typed = quad.typed();
        println!("{:5}: {} = {}", raw, quad, typed);
    }
    //assert!(false);  // force output to be displayed
}

#[test]
fn basic_memory_allocation() {
    let mut core = Core::new();
    let top_before = core.mem_top().addr();
    println!("mem_top: {}", core.mem_top());
    let m1 = core.alloc(&Quad::pair_t(PLUS_1, PLUS_1));
    println!("m1:{} -> {}", m1, core.mem(m1));
    println!("mem_top: {}", core.mem_top());
    let m2 = core.alloc(&Quad::pair_t(PLUS_2, PLUS_2));
    println!("mem_top: {}", core.mem_top());
    let m3 = core.alloc(&Quad::pair_t(PLUS_3, PLUS_3));
    println!("mem_top: {}", core.mem_top());
    println!("mem_free: {}", core.mem_free());
    core.free(m2);
    println!("mem_free: {}", core.mem_free());
    core.free(m3);
    println!("mem_free: {}", core.mem_free());
    let _m4 = core.alloc(&Quad::pair_t(PLUS_4, PLUS_4));
    println!("mem_top: {}", core.mem_top());
    println!("mem_free: {}", core.mem_free());
    let top_after = core.mem_top().addr();
    assert_eq!(3, top_after - top_before);
    //assert_eq!(1, core.mem_free().fix_num().unwrap());
    assert_eq!(PLUS_1, core.mem_free());
    println!("mem_next: {} -> {}", core.mem_next(), core.mem(core.mem_next()));
    //assert!(false);  // force output to be displayed
}

#[test]
fn run_loop_terminates() {
    let mut core = Core::new();
    core.run_loop();
    //assert!(false);  // force output to be displayed
}
