// uFork virtual CPU

//std use core::fmt;

use alloc::boxed::Box;

use crate::device::*;

//std //pub type Error = &'static str;
//std pub type Error = String;

pub type Error = u32;

pub type Raw = u32;  // univeral value type
pub type Num = i32;  // fixnum integer type

// type-tag bits
const MSK_RAW: Raw          = 0xF000_0000;  // mask for type-tag bits
const DIR_RAW: Raw          = 0x8000_0000;  // 1=direct (fixnum), 0=indirect (pointer)
const OPQ_RAW: Raw          = 0x4000_0000;  // 1=opaque (capability), 0=transparent (navigable)
const MUT_RAW: Raw          = 0x2000_0000;  // 1=read-write (mutable), 0=read-only (immutable)
const BNK_RAW: Raw          = 0x1000_0000;  // 1=bank_1, 0=bank_0 (half-space GC phase)

const BNK_0: Raw            = 0;
const BNK_1: Raw            = BNK_RAW;

const BNK_INI: Raw          = BNK_0;
//const BNK_INI: Raw          = BNK_1;

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
    pub fn ram(bank: Raw, ofs: usize) -> Any {
        let raw = (ofs as Raw) & !MSK_RAW;
        Any::new(MUT_RAW | bank | raw)
    }
    pub fn raw(&self) -> Raw {
        self.raw
    }
    pub fn addr(&self) -> usize {
        if self.is_fix() {
            //std panic!("fixnum has no addr");
            panic!();
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
    pub fn bank(&self) -> Option<Raw> {
        if (self.raw & (DIR_RAW | MUT_RAW)) == MUT_RAW {  // include CAPs
            Some(self.raw & BNK_RAW)
        } else {
            None
        }
    }
    pub fn get_fix(&self) -> Result<isize, Error> {
        match self.fix_num() {
            Some(num) => Ok(num),
            //std None => Err(format!("Fixnum required! {}", self)),
            None => Err(1),
        }
    }
    pub fn fix_num(&self) -> Option<isize> {
        if self.is_fix() {
            let num = ((self.raw << 1) as Num) >> 1;
            Some(num as isize)
        } else {
            None
        }
    }
}

//std impl fmt::Display for Any {
//std     fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
//std         if self.is_fix() {
//std             write!(fmt, "{:+}", self.fix_num().unwrap())
//std         } else if self.is_cap() {
//std             write!(fmt, "@{}", self.addr())
//std         } else if self.raw() < START.raw() {
//std             match *self {
//std                 UNDEF => write!(fmt, "#?"),
//std                 NIL => write!(fmt, "()"),
//std                 FALSE => write!(fmt, "#f"),
//std                 TRUE => write!(fmt, "#t"),
//std                 UNIT => write!(fmt, "#unit"),
//std                 TYPE_T => write!(fmt, "TYPE_T"),
//std                 //EVENT_T => write!(fmt, "EVENT_T"),
//std                 GC_FWD_T => write!(fmt, "GC_FWD_T"),
//std                 INSTR_T => write!(fmt, "INSTR_T"),
//std                 ACTOR_T => write!(fmt, "ACTOR_T"),
//std                 FIXNUM_T => write!(fmt, "FIXNUM_T"),
//std                 SYMBOL_T => write!(fmt, "SYMBOL_T"),
//std                 PAIR_T => write!(fmt, "PAIR_T"),
//std                 //FEXPR_T => write!(fmt, "FEXPR_T"),
//std                 DICT_T => write!(fmt, "DICT_T"),
//std                 PROXY_T => write!(fmt, "PROXY_T"),
//std                 STUB_T => write!(fmt, "STUB_T"),
//std                 FREE_T => write!(fmt, "FREE_T"),
//std                 _ => write!(fmt, "#{}", self.raw()),  // FIXME: should not occur
//std             }
//std         } else if self.is_rom() {
//std             write!(fmt, "*{}", self.addr())
//std         } else if self.is_ram() {
//std             write!(fmt, "^{}", self.addr())
//std         } else {
//std             panic!("unreachable")
//std         }
//std     }
//std }

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
pub const END_ABORT: Any    = Any { raw: DIR_RAW | 0 };
pub const END_STOP: Any     = Any { raw: DIR_RAW | 1 };
pub const END_COMMIT: Any   = Any { raw: DIR_RAW | 2 };
pub const END_RELEASE: Any  = Any { raw: DIR_RAW | 3 };

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
    pub fn event_t(sponsor: Any, target: Any, msg: Any, next: Any) -> Quad {
        assert!(sponsor.is_ram());
        assert!(target.is_cap());
        assert!(next.is_ptr());
        Self::new(sponsor, target, msg, next)
    }
    pub fn cont_t(ip: Any, sp: Any, ep: Any, next: Any) -> Quad {
        assert!(ip.is_ptr());
        assert!(sp.is_ptr());
        assert!(ep.is_ram());
        assert!(next.is_ptr());
        Self::new(ip, sp, ep, next)
    }
    pub fn instr_t(vm: Any, v: Any, k: Any) -> Quad {
        assert!(vm.is_fix());
        assert!(k.is_ptr());
        Self::new(INSTR_T, vm, v, k)
    }
    pub fn actor_t(beh: Any, state: Any, events: Any) -> Quad {
        //assert!(beh.is_ptr()); --- moved test to new_actor() so we can create devices
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
    pub fn sponsor_t(memory: Any, events: Any, instrs: Any) -> Quad {
        assert!(memory.is_fix());
        assert!(events.is_fix());
        assert!(instrs.is_fix());
        Self::new(memory, events, instrs, UNDEF)
    }
    pub fn gc_fwd_t(to: Any) -> Quad {
        Self::new(GC_FWD_T, UNDEF, UNDEF, to)
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

    // construct detached Event
    pub fn new_event(sponsor: Any, target: Any, msg: Any) -> Quad {
        Self::event_t(sponsor, target, msg, NIL)
    }

    // construct detached Continuation
    pub fn new_cont(ip: Any, sp: Any, ep: Any) -> Quad {
        Self::cont_t(ip, sp, ep, NIL)
    }

    // construct idle Actor
    pub fn new_actor(beh: Any, state: Any) -> Quad {
        assert!(beh.is_ptr());
        Self::actor_t(beh, state, UNDEF)
    }
}

//std impl fmt::Display for Quad {
//std     fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
//std         let mut t = self.t().to_string();
//std         if self.t() == UNDEF {
//std             t = String::from("LITERAL_T");
//std         }
//std         let mut x = self.x().to_string();
//std         let mut y = self.y().to_string();
//std         if self.t() == INSTR_T {
//std             match self.x() {
//std                 VM_TYPEQ => x = String::from("TYPEQ"),
//std                 VM_CELL => x = String::from("CELL"),
//std                 VM_GET => x = String::from("GET"),
//std                 //VM_SET => x = String::from("SET"),
//std                 VM_DICT => {
//std                     x = String::from("DICT");
//std                     match self.y() {
//std                         DICT_HAS => y = String::from("HAS"),
//std                         DICT_GET => y = String::from("GET"),
//std                         DICT_ADD => y = String::from("ADD"),
//std                         DICT_SET => y = String::from("SET"),
//std                         DICT_DEL => y = String::from("DEL"),
//std                         _ => {},
//std                     }
//std                 },
//std                 VM_PAIR => x = String::from("PAIR"),
//std                 VM_PART => x = String::from("PART"),
//std                 VM_NTH => x = String::from("NTH"),
//std                 VM_PUSH => x = String::from("PUSH"),
//std                 VM_DEPTH => x = String::from("DEPTH"),
//std                 VM_DROP => x = String::from("DROP"),
//std                 VM_PICK => x = String::from("PICK"),
//std                 VM_DUP => x = String::from("DUP"),
//std                 VM_ROLL => x = String::from("ROLL"),
//std                 VM_ALU => {
//std                     x = String::from("ALU");
//std                     match self.y() {
//std                         ALU_NOT => y = String::from("NOT"),
//std                         ALU_AND => y = String::from("AND"),
//std                         ALU_OR => y = String::from("OR"),
//std                         ALU_XOR => y = String::from("XOR"),
//std                         ALU_ADD => y = String::from("ADD"),
//std                         ALU_SUB => y = String::from("SUB"),
//std                         ALU_MUL => y = String::from("MUL"),
//std                         _ => {},
//std                     }
//std                 },
//std                 VM_EQ => x = String::from("EQ"),
//std                 VM_CMP => {
//std                     x = String::from("CMP");
//std                     match self.y() {
//std                         CMP_EQ => y = String::from("EQ"),
//std                         CMP_GE => y = String::from("GE"),
//std                         CMP_GT => y = String::from("GT"),
//std                         CMP_LT => y = String::from("LT"),
//std                         CMP_LE => y = String::from("LE"),
//std                         CMP_NE => y = String::from("NE"),
//std                         _ => {},
//std                     }
//std                 },
//std                 VM_IF => x = String::from("IF"),
//std                 VM_MSG => x = String::from("MSG"),
//std                 VM_MY => {
//std                     x = String::from("MY");
//std                     match self.y() {
//std                         MY_SELF => y = String::from("SELF"),
//std                         MY_BEH => y = String::from("BEH"),
//std                         MY_STATE => y = String::from("STATE"),
//std                         _ => {},
//std                     }
//std                 },
//std                 VM_SEND => x = String::from("SEND"),
//std                 VM_NEW => x = String::from("NEW"),
//std                 VM_BEH => x = String::from("BEH"),
//std                 VM_END => {
//std                     x = String::from("END");
//std                     match self.y() {
//std                         END_ABORT => y = String::from("ABORT"),
//std                         END_STOP => y = String::from("STOP"),
//std                         END_COMMIT => y = String::from("COMMIT"),
//std                         END_RELEASE => y = String::from("RELEASE"),
//std                         _ => {},
//std                     }
//std                 },
//std                 VM_DEQUE => {
//std                     x = String::from("DEQUE");
//std                     match self.y() {
//std                         DEQUE_NEW => y = String::from("NEW"),
//std                         DEQUE_EMPTY => y = String::from("EMPTY"),
//std                         DEQUE_PUSH => y = String::from("PUSH"),
//std                         DEQUE_POP => y = String::from("POP"),
//std                         DEQUE_PUT => y = String::from("PUT"),
//std                         DEQUE_PULL => y = String::from("PULL"),
//std                         DEQUE_LEN => y = String::from("LEN"),
//std                         _ => {},
//std                     }
//std                 },
//std                 VM_IS_EQ => x = String::from("IS_EQ"),
//std                 VM_IS_NE => x = String::from("IS_NE"),
//std                 _ => {},
//std             }
//std         };
//std         let z = self.z().to_string();
//std         write!(fmt, "{{t:{}, x:{}, y:{}, z:{}}}", t, x, y, z)
//std     }
//std }

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
//pub const EVENT_T: Any      = Any { raw: 6 };
pub const GC_FWD_T: Any     = Any { raw: 6 };
pub const INSTR_T: Any      = Any { raw: 7 };
pub const ACTOR_T: Any      = Any { raw: 8 };
pub const FIXNUM_T: Any     = Any { raw: 9 };
pub const SYMBOL_T: Any     = Any { raw: 10 };
pub const PAIR_T: Any       = Any { raw: 11 };
//pub const FEXPR_T: Any      = Any { raw: 12 };
pub const DICT_T: Any       = Any { raw: 12 };
pub const PROXY_T: Any      = Any { raw: 13 };
pub const STUB_T: Any       = Any { raw: 14 };
pub const FREE_T: Any       = Any { raw: 15 };

pub const START: Any        = Any { raw: 16 };
pub const EMPTY_DQ: Any     = Any { raw: 31 };

pub const MEMORY: Any       = Any { raw: MUT_RAW | BNK_INI | 0 };
pub const DDEQUE: Any       = Any { raw: MUT_RAW | BNK_INI | 1 };
pub const NULL_DEV: Any     = Any { raw: OPQ_RAW | MUT_RAW | BNK_INI | 2 };
pub const CLOCK_DEV: Any    = Any { raw: OPQ_RAW | MUT_RAW | BNK_INI | 3 };
pub const IO_DEV: Any       = Any { raw: OPQ_RAW | MUT_RAW | BNK_INI | 4 };
pub const SPONSOR: Any      = Any { raw: MUT_RAW | BNK_INI | 5 };

// core memory limit
const QUAD_ROM_MAX: usize = 1<<10;  // 1K quad-cells of ROM
const QUAD_RAM_MAX: usize = 1<<8;   // 256 quad-cells of RAM
const DEVICE_MAX:   usize = 3;      // number of Core devices

pub struct Core {
    quad_rom:   [Quad; QUAD_ROM_MAX],
    quad_ram0:  [Quad; QUAD_RAM_MAX],
    quad_ram1:  [Quad; QUAD_RAM_MAX],
    device:     [Option<Box<dyn Device>>; DEVICE_MAX],
}

impl Core {
    pub fn new() -> Core {
        let mut quad_rom = [
            Quad::empty_t();
            QUAD_ROM_MAX
        ];

        quad_rom[UNDEF.addr()]      = Quad::literal_t();
        quad_rom[NIL.addr()]        = Quad::literal_t();
        quad_rom[FALSE.addr()]      = Quad::literal_t();
        quad_rom[TRUE.addr()]       = Quad::literal_t();
        quad_rom[UNIT.addr()]       = Quad::literal_t();

        quad_rom[TYPE_T.addr()]     = Quad::type_t();
        //quad_rom[EVENT_T.addr()]    = Quad::type_t();
        quad_rom[GC_FWD_T.addr()]   = Quad::type_t();
        quad_rom[INSTR_T.addr()]    = Quad::type_t();
        quad_rom[ACTOR_T.addr()]    = Quad::type_t();
        quad_rom[FIXNUM_T.addr()]   = Quad::type_t();
        quad_rom[SYMBOL_T.addr()]   = Quad::type_t();
        quad_rom[PAIR_T.addr()]     = Quad::type_t();
        //quad_rom[FEXPR_T.addr()]    = Quad::type_t();
        quad_rom[DICT_T.addr()]     = Quad::type_t();
        quad_rom[PROXY_T.addr()]    = Quad::type_t();
        quad_rom[STUB_T.addr()]     = Quad::type_t();
        quad_rom[FREE_T.addr()]     = Quad::type_t();

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
//pub const EMPTY_DQ: Any     = Any { raw: 31 };  // defined globally...
        quad_rom[EMPTY_DQ.addr()]   = Quad::pair_t(NIL, NIL);
pub const STOP: Any         = Any { raw: 32 };
        quad_rom[STOP.addr()]       = Quad::vm_end_stop();
pub const ABORT: Any        = Any { raw: 33 };
        quad_rom[ABORT.addr()+0]    = Quad::vm_push(UNDEF, Any::rom(ABORT.addr()+1));  // #?
        quad_rom[ABORT.addr()+1]    = Quad::vm_end_abort();

pub const MEMO_ADDR: usize = 35;
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

pub const F_FIB_ADDR: usize = BUSY_ADDR+30;
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
        //quad_rom[F_FIB_ADDR+12]     = Quad::vm_my_self(Any::rom(F_FIB_ADDR+14));  // n k n-1 k fib
        quad_rom[F_FIB_ADDR+12]     = Quad::vm_push(F_FIB_BEH, Any::rom(F_FIB_ADDR+13));  // n k n-1 k fib-beh
        quad_rom[F_FIB_ADDR+13]     = Quad::vm_new(ZERO, Any::rom(F_FIB_ADDR+14));  // n k n-1 k fib
        quad_rom[F_FIB_ADDR+14]     = Quad::vm_send(PLUS_2, Any::rom(F_FIB_ADDR+15));  // n k

        quad_rom[F_FIB_ADDR+15]     = Quad::vm_roll(PLUS_2, Any::rom(F_FIB_ADDR+16));  // k n
        quad_rom[F_FIB_ADDR+16]     = Quad::vm_push(PLUS_2, Any::rom(F_FIB_ADDR+17));  // k n 2
        quad_rom[F_FIB_ADDR+17]     = Quad::vm_alu_sub(Any::rom(F_FIB_ADDR+18));  // k n-2
        quad_rom[F_FIB_ADDR+18]     = Quad::vm_roll(PLUS_2, Any::rom(F_FIB_ADDR+19));  // n-2 k
        //quad_rom[F_FIB_ADDR+19]     = Quad::vm_my_self(Any::rom(F_FIB_ADDR+21));  // n-2 k fib
        quad_rom[F_FIB_ADDR+19]     = Quad::vm_push(F_FIB_BEH, Any::rom(F_FIB_ADDR+20));  // n-2 k fib-beh
        quad_rom[F_FIB_ADDR+20]     = Quad::vm_new(ZERO, Any::rom(F_FIB_ADDR+21));  // n-2 k fib
        quad_rom[F_FIB_ADDR+21]     = Quad::vm_send(PLUS_2, COMMIT);  // --

pub const F_FIB_K: Any = Any { raw: (F_FIB_ADDR+22) as Raw };
        // stack: cust
        quad_rom[F_FIB_ADDR+22]     = Quad::vm_msg(ZERO, Any::rom(F_FIB_ADDR+23));  // cust m
        quad_rom[F_FIB_ADDR+23]     = Quad::vm_push(F_FIB_K2, Any::rom(F_FIB_ADDR+24));  // cust m fib-k2
        quad_rom[F_FIB_ADDR+24]     = Quad::vm_beh(PLUS_2, COMMIT);  // fib-k2[cust m]

pub const F_FIB_K2: Any = Any { raw: (F_FIB_ADDR+25) as Raw };
        // stack: cust m
        quad_rom[F_FIB_ADDR+25]     = Quad::vm_msg(ZERO, Any::rom(F_FIB_ADDR+26));  // cust m n
        quad_rom[F_FIB_ADDR+26]     = Quad::vm_alu_add(Any::rom(F_FIB_ADDR+27));  // cust m+n
        quad_rom[F_FIB_ADDR+27]     = Quad::vm_roll(PLUS_2, SEND_0);  // m+n cust

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
                              (vm-my-self  ; n k n-1 k fib
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

pub const IS_EQ_ADDR: usize = F_FIB_ADDR+28;
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

        /* testcase: fib(6) => 8 */
pub const TEST_ADDR: usize = IS_EQ_ADDR+4;
pub const _TEST_BEH: Any    = Any { raw: TEST_ADDR as Raw };
        quad_rom[TEST_ADDR+0]       = Quad::vm_drop(PLUS_3, Any::rom(TEST_ADDR+1));  // --
        quad_rom[TEST_ADDR+1]       = Quad::vm_push(PLUS_6, Any::rom(TEST_ADDR+2));  // 6
        quad_rom[TEST_ADDR+2]       = Quad::vm_push(EQ_8_BEH, Any::rom(TEST_ADDR+3));  // 6 eq-8-beh
        quad_rom[TEST_ADDR+3]       = Quad::vm_new(ZERO, Any::rom(TEST_ADDR+4));  // 6 eq-8
        //quad_rom[TEST_ADDR+4]       = Quad::vm_push(F_FIB, Any::rom(TEST_ADDR+6));  // 6 eq-8 f-fib
        quad_rom[TEST_ADDR+4]       = Quad::vm_push(F_FIB_BEH, Any::rom(TEST_ADDR+5));  // 6 eq-8 fib-beh
        quad_rom[TEST_ADDR+5]       = Quad::vm_new(ZERO, Any::rom(TEST_ADDR+6));  // 6 eq-8 fib
        quad_rom[TEST_ADDR+6]       = Quad::vm_send(PLUS_2, COMMIT);  // --
pub const EQ_8_BEH: Any = Any { raw: (TEST_ADDR+7) as Raw };
        quad_rom[TEST_ADDR+7]       = Quad::vm_msg(ZERO, Any::rom(TEST_ADDR+8));  // msg
        quad_rom[TEST_ADDR+8]       = Quad::vm_is_eq(PLUS_8, COMMIT);  // assert_eq(8, msg)
        //quad_rom[TEST_ADDR+8]       = Quad::vm_is_eq(PLUS_8, STOP);  // assert_eq(8, msg)

        /* VM_DICT test suite */
pub const T_DICT_ADDR: usize = TEST_ADDR+9;
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

        /* device test suite */
pub const T_DEV_ADDR: usize = T_DEQUE_ADDR+65;
pub const _T_DEV_BEH: Any  = Any { raw: T_DEV_ADDR as Raw };
        quad_rom[T_DEV_ADDR+0]      = Quad::vm_push(PLUS_1, Any::rom(T_DEV_ADDR+1));  // 1
        quad_rom[T_DEV_ADDR+1]      = Quad::vm_push(NULL_DEV, Any::rom(T_DEV_ADDR+2));  // 1 null_device
        quad_rom[T_DEV_ADDR+2]      = Quad::vm_send(ZERO, Any::rom(T_DEV_ADDR+3));  // --
        quad_rom[T_DEV_ADDR+3]      = Quad::vm_push(PLUS_2, Any::rom(T_DEV_ADDR+4));  // 2
        quad_rom[T_DEV_ADDR+4]      = Quad::vm_push(NULL_DEV, Any::rom(T_DEV_ADDR+5));  // 2 null_device
        quad_rom[T_DEV_ADDR+5]      = Quad::vm_send(ZERO, Any::rom(T_DEV_ADDR+6));  // --
        quad_rom[T_DEV_ADDR+6]      = Quad::vm_push(PLUS_3, Any::rom(T_DEV_ADDR+7));  // 3
        quad_rom[T_DEV_ADDR+7]      = Quad::vm_push(NULL_DEV, Any::rom(T_DEV_ADDR+8));  // 3 null_device
        quad_rom[T_DEV_ADDR+8]      = Quad::vm_send(ZERO, Any::rom(T_DEV_ADDR+9));  // --
        quad_rom[T_DEV_ADDR+9]      = Quad::vm_push(MINUS_1, Any::rom(T_DEV_ADDR+10));  // -1
        quad_rom[T_DEV_ADDR+10]     = Quad::vm_push(CLOCK_DEV, Any::rom(T_DEV_ADDR+11));  // -1 clock_device
        quad_rom[T_DEV_ADDR+11]     = Quad::vm_send(ZERO, Any::rom(T_DEV_ADDR+12));  // --
        quad_rom[T_DEV_ADDR+12]     = Quad::vm_push(PLUS_5, Any::rom(T_DEV_ADDR+13));  // 5
        quad_rom[T_DEV_ADDR+13]     = Quad::vm_push(_COUNT_BEH, Any::rom(T_DEV_ADDR+14));  // 5 count-beh
        quad_rom[T_DEV_ADDR+14]     = Quad::vm_new(ZERO, Any::rom(T_DEV_ADDR+15));  // 5 a-count
        quad_rom[T_DEV_ADDR+15]     = Quad::vm_send(ZERO, COMMIT);  // --

pub const COUNT_ADDR: usize = T_DEV_ADDR+16;
pub const _COUNT_BEH: Any  = Any { raw: COUNT_ADDR as Raw };
        quad_rom[COUNT_ADDR+0]      = Quad::vm_msg(ZERO, Any::rom(COUNT_ADDR+1));  // n
        quad_rom[COUNT_ADDR+1]      = Quad::vm_dup(PLUS_1, Any::rom(COUNT_ADDR+2));  // n n
        quad_rom[COUNT_ADDR+2]      = Quad::vm_eq(ZERO, Any::rom(COUNT_ADDR+3));  // n n==0
        quad_rom[COUNT_ADDR+3]      = Quad::vm_if(ABORT, Any::rom(COUNT_ADDR+4));  // n

        quad_rom[COUNT_ADDR+4]      = Quad::vm_push(PLUS_1, Any::rom(COUNT_ADDR+5));  // n 1
        quad_rom[COUNT_ADDR+5]      = Quad::vm_alu_sub(Any::rom(COUNT_ADDR+6));  // n-1
        quad_rom[COUNT_ADDR+6]      = Quad::vm_my_self(Any::rom(COUNT_ADDR+7));  // n-1 self
        quad_rom[COUNT_ADDR+7]      = Quad::vm_send(ZERO, COMMIT);  // --

pub const _ROM_TOP_ADDR: usize = COUNT_ADDR+8;

        let mut quad_ram = [
            Quad::empty_t();
            QUAD_RAM_MAX
        ];
        quad_ram[MEMORY.addr()]     = Quad::memory_t(Any::ram(BNK_INI, _RAM_TOP_ADDR), NIL, ZERO, DDEQUE);
        quad_ram[DDEQUE.addr()]     = Quad::ddeque_t(NIL, NIL, K_BOOT, K_BOOT);
        quad_ram[NULL_DEV.addr()]   = Quad::actor_t(ZERO, NIL, UNDEF);  // null device #0
        quad_ram[CLOCK_DEV.addr()]  = Quad::actor_t(PLUS_1, NIL, UNDEF);  // clock device #1
        quad_ram[IO_DEV.addr()]     = Quad::actor_t(PLUS_2, NIL, UNDEF);  // i/o device #2
        quad_ram[SPONSOR.addr()]    = Quad::sponsor_t(Any::fix(512), Any::fix(64), Any::fix(512));  // root configuration sponsor
pub const BOOT_ADDR: usize = 6;
pub const A_BOOT: Any       = Any { raw: OPQ_RAW | MUT_RAW | BNK_INI | (BOOT_ADDR+0) as Raw };
        quad_ram[BOOT_ADDR+0]       = Quad::new_actor(SINK_BEH, NIL);
pub const _BOOT_BEH: Any     = Any { raw: MUT_RAW | BNK_INI | (BOOT_ADDR+1) as Raw };
        quad_ram[BOOT_ADDR+1]       = Quad::vm_push(UNIT, Any::ram(BNK_INI, BOOT_ADDR+2));  // #unit
        quad_ram[BOOT_ADDR+2]       = Quad::vm_my_self(Any::ram(BNK_INI, BOOT_ADDR+3));  // #unit SELF
        quad_ram[BOOT_ADDR+3]       = Quad::vm_push(RESEND, Any::ram(BNK_INI, BOOT_ADDR+4));  // #unit SELF resend
        //quad_ram[BOOT_ADDR+3]       = Quad::vm_push(_T_DEQUE_BEH, Any::ram(BNK_INI, BOOT_ADDR+4));  // #unit SELF test-deque-beh
        //quad_ram[BOOT_ADDR+3]       = Quad::vm_push(_T_DICT_BEH, Any::ram(BNK_INI, BOOT_ADDR+4));  // #unit SELF test-dict-beh
        quad_ram[BOOT_ADDR+4]       = Quad::vm_new(ZERO, Any::ram(BNK_INI, BOOT_ADDR+5));  // #unit SELF actor
        quad_ram[BOOT_ADDR+5]       = Quad::vm_send(PLUS_2, COMMIT);  // --
pub const _BOOT_SP: Any     = Any { raw: MUT_RAW | BNK_INI | (BOOT_ADDR+6) as Raw };
        quad_ram[BOOT_ADDR+6]       = Quad::pair_t(PLUS_1, Any::ram(BNK_INI, BOOT_ADDR+7));
        quad_ram[BOOT_ADDR+7]       = Quad::pair_t(PLUS_2, Any::ram(BNK_INI, BOOT_ADDR+8));
        quad_ram[BOOT_ADDR+8]       = Quad::pair_t(PLUS_3, NIL);
pub const E_BOOT: Any       = Any { raw: MUT_RAW | BNK_INI | (BOOT_ADDR+9) as Raw };
        quad_ram[BOOT_ADDR+9]       = Quad::new_event(SPONSOR, A_BOOT, NIL);
pub const K_BOOT: Any       = Any { raw: MUT_RAW | BNK_INI | (BOOT_ADDR+10) as Raw };
        //quad_ram[BOOT_ADDR+10]      = Quad::new_cont(SINK_BEH, NIL, E_BOOT);
        //quad_ram[BOOT_ADDR+10]      = Quad::new_cont(STOP, _BOOT_SP, E_BOOT);
        //quad_ram[BOOT_ADDR+10]      = Quad::new_cont(_BOOT_BEH, _BOOT_SP, E_BOOT);
        //quad_ram[BOOT_ADDR+10]      = Quad::new_cont(_TEST_BEH, NIL, E_BOOT);
        quad_ram[BOOT_ADDR+10]      = Quad::new_cont(_T_DEV_BEH, NIL, E_BOOT);

pub const _RAM_TOP_ADDR: usize = BOOT_ADDR + 11;

        Core {
            quad_rom,
            quad_ram0: if BNK_INI == BNK_0 { quad_ram } else { [ Quad::empty_t(); QUAD_RAM_MAX ] },
            quad_ram1: if BNK_INI == BNK_1 { quad_ram } else { [ Quad::empty_t(); QUAD_RAM_MAX ] },
            device: [
                Some(Box::new(NullDevice::new())),
                Some(Box::new(NullDevice::new())),
                Some(Box::new(NullDevice::new())),
            ],
        }
    }

    pub fn run_loop(&mut self) -> bool {
        loop {
            //std let sponsor = self.event_sponsor(self.ep());
            //std println!("run_loop: sponsor={} -> {}", sponsor, self.mem(sponsor));
            match self.execute_instruction() {
                Ok(more) => {
                    if !more {
                        return true;  // no more instructions to execute...
                    }
                },
                //std Err(error) => {
                Err(_) => {
                    //std println!("run_loop: execute ERROR! {}", error);
                    return false;  // limit reached, or error condition signalled...
                },
            }
            //std if let Err(error) = self.check_for_interrupt() {
            if let Err(_) = self.check_for_interrupt() {
                //std println!("run_loop: interrupt ERROR! {}", error);
                return false;  // interrupt handler failed...
            }
            //std if let Err(error) = self.dispatch_event() {
            if let Err(_) = self.dispatch_event() {
                //std println!("run_loop: dispatch ERROR! {}", error);
                return false;  // event dispatch failed...
            }
            // FIXME: if dispatch_event() returns Ok(true), ignore empty k-queue...
        }
    }
    pub fn check_for_interrupt(&mut self) -> Result<bool, Error> {
        //self.gc_stop_the_world();  // FIXME!! REMOVE FORCED GC...
        Ok(false)
        //Err(String::from("Boom!"))
        //Err(format!("result={}", false))
    }
    pub fn dispatch_event(&mut self) -> Result<bool, Error> {
        let ep = self.e_first();
        let event = self.mem(ep);
        //std println!("dispatch_event: event={} -> {}", ep, event);
        if !ep.is_ram() {
            //std println!("dispatch_event: event queue empty");
            return Ok(false);  // event queue empty
        }
        let target = event.x();
        let sponsor = self.event_sponsor(ep);
        //std println!("dispatch_event: sponsor={} -> {}", sponsor, self.mem(sponsor));
        let limit = self.sponsor_events(sponsor).fix_num().unwrap_or(0);
        //std println!("dispatch_event: limit={}", limit);
        if limit <= 0 {
            //std return Err(String::from("event limit reached"));
            return Err(1);
        }
        let a_ptr = self.cap_to_ptr(target);
        let a_quad = *self.mem(a_ptr);
        //std println!("dispatch_event: target={} -> {}", a_ptr, a_quad);
        let beh = a_quad.x();
        let state = a_quad.y();
        let events = a_quad.z();
        if let Some(index) = beh.fix_num() {
            // message-event to device
            let id = index as usize;
            if id >= DEVICE_MAX {
                //std return Err(format!("device id {} must be less than {}", id, DEVICE_MAX));
                return Err(1);
            }
            let ep_ = self.event_dequeue().unwrap();
            assert_eq!(ep, ep_);
            let mut dev_mut = self.device[id].take().unwrap();
            let result = dev_mut.handle_event(self, ep);
            self.device[id] = Some(dev_mut);
            result  // should normally be Ok(true)
        } else if events == UNDEF {
            // begin actor-event transaction
            let rollback = self.reserve(&a_quad)?;  // snapshot actor state
            let kp = self.new_cont(beh, state, ep)?;  // create continuation
            //std println!("dispatch_event: cont={} -> {}", kp, self.mem(kp));
            self.ram_mut(a_ptr).set_z(NIL);
            self.cont_enqueue(kp);
            let ep_ = self.event_dequeue().unwrap();
            assert_eq!(ep, ep_);
            self.ram_mut(ep).set_z(rollback);  // store rollback in event
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
    pub fn execute_instruction(&mut self) -> Result<bool, Error> {
        let kp = self.kp();
        //std let cont = self.mem(kp);
        //std println!("execute_instruction: kp={} -> {}", kp, cont);
        if !kp.is_ram() {
            //std println!("execute_instruction: continuation queue empty");
            return Ok(false);  // continuation queue is empty
        }
        let ep = self.ep();
        //std println!("execute_instruction: ep={} -> {}", ep, self.mem(ep));
        let sponsor = self.event_sponsor(ep);
        //std println!("execute_instruction: sponsor={} -> {}", sponsor, self.mem(sponsor));
        let limit = self.sponsor_instrs(sponsor).fix_num().unwrap_or(0);
        //std println!("execute_instruction: limit={}", limit);
        if limit <= 0 {
            //std return Err(String::from("instruction limit reached"));
            return Err(1);
        }
        let ip = self.ip();
        let ip_ = self.perform_op(ip)?;
        self.set_ip(ip_);
        self.set_sponsor_instrs(sponsor, Any::fix(limit - 1));
        let kp_ = self.cont_dequeue().unwrap();
        assert_eq!(kp, kp_);
        if self.typeq(INSTR_T, ip_) {
            // re-queue updated continuation
            //std println!("execute_instruction: kp'={} -> {}", kp_, self.ram(kp_));
            self.cont_enqueue(kp_);
        } else {
            // free dead continuation and associated event
            self.free(ep);
            self.free(kp);
            self.gc_stop_the_world();  // FIXME!! REMOVE FORCED GC...
        }
        Ok(true)  // instruction executed
    }
    fn perform_op(&mut self, ip: Any) -> Result<Any, Error> {
        let instr = self.mem(ip);
        //std println!("perform_op: ip={} ${:08x} -> {}", ip, ip.raw(), instr);
        assert!(instr.t() == INSTR_T);
        let opr = instr.x();  // operation code
        let imm = instr.y();  // immediate argument
        let kip = instr.z();  // next instruction
        let ip_ = match opr {
            VM_TYPEQ => {
                //std println!("vm_typeq: typ={}", imm);
                let val = self.stack_pop();
                //std println!("vm_typeq: val={}", val);
                let r = if self.typeq(imm, val) { TRUE } else { FALSE };
                self.stack_push(r)?;
                kip
            },
            VM_DICT => {
                //std println!("vm_dict: op={}", imm);
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
                        //std return Err(format!("Unknown dict op {}!", imm));
                        return Err(1);
                    }
                };
                kip
            },
            VM_DEQUE => {
                //std println!("vm_deque: op={}", imm);
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
                        //std return Err(format!("Unknown deque op {}!", imm));
                        return Err(1);
                    }
                };
                kip
            },
            VM_PAIR => {
                //std println!("vm_pair: cnt={}", imm);
                let n = imm.get_fix()?;
                self.stack_pairs(n)?;
                kip
            },
            VM_PART => {
                //std println!("vm_part: cnt={}", imm);
                let n = imm.get_fix()?;
                self.stack_parts(n)?;
                kip
            },
            VM_NTH => {
                //std println!("vm_nth: idx={}", imm);
                let lst = self.stack_pop();
                //std println!("vm_nth: lst={}", lst);
                let n = imm.get_fix()?;
                let r = self.extract_nth(lst, n);
                //std println!("vm_nth: r={}", r);
                self.stack_push(r)?;
                kip
            },
            VM_PUSH => {
                //std println!("vm_push: val={} ${:08x}", imm, imm.raw());
                let val = self.follow_fwd(imm);  // FIXME: may be redundant with low-level memory redirection
                self.stack_push(val)?;
                kip
            },
            VM_DEPTH => {
                let lst = self.sp();
                //std println!("vm_depth: lst={}", lst);
                let n = self.list_len(lst);
                let n = Any::fix(n);
                //std println!("vm_depth: n={}", n);
                self.stack_push(n)?;
                kip
            },
            VM_DROP => {
                //std println!("vm_drop: n={}", imm);
                let mut n = imm.get_fix()?;
                assert!(n < 64);  // FIXME: replace with cycle-limit(s) in Sponsor
                while n > 0 {
                    self.stack_pop();
                    n -= 1;
                };
                kip
            },
            VM_PICK => {
                //std println!("vm_pick: idx={}", imm);
                let n = imm.get_fix()?;
                let r = if n > 0 {
                    let lst = self.sp();
                    self.extract_nth(lst, n)
                } else {
                    UNDEF
                };
                //std println!("vm_pick: r={}", r);
                self.stack_push(r)?;
                kip
            },
            VM_DUP => {
                //std println!("vm_dup: n={}", imm);
                let n = imm.get_fix()?;
                self.stack_dup(n)?;
                kip
            },
            VM_ROLL => {
                //std println!("vm_roll: idx={}", imm);
                let n = imm.get_fix()?;
                self.stack_roll(n)?;
                kip
            },
            VM_ALU => {
                //std println!("vm_alu: op={}", imm);
                let r = if imm == ALU_NOT {
                    let v = self.stack_pop();
                    //std println!("vm_alu: v={}", v);
                    match v.fix_num() {
                        Some(n) => Any::fix(!n),
                        _ => UNDEF,
                    }
                } else {
                    let vv = self.stack_pop();
                    //std println!("vm_alu: vv={}", vv);
                    let v = self.stack_pop();
                    //std println!("vm_alu: v={}", v);
                        match (v.fix_num(), vv.fix_num()) {
                        (Some(n), Some(nn)) => {
                            match imm {
                                ALU_AND => Any::fix(n & nn),
                                ALU_OR => Any::fix(n | nn),
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
                //std println!("vm_alu: r={}", r);
                self.stack_push(r)?;
                kip
            },
            VM_EQ => {
                //std println!("vm_eq: v={} ${:08x}", imm, imm.raw());
                let vv = self.stack_pop();
                //std println!("vm_eq: vv={} ${:08x}", vv, vv.raw());
                let r = if imm == vv { TRUE } else { FALSE };
                //std println!("vm_eq: r={}", r);
                self.stack_push(r)?;
                kip
            },
            VM_CMP => {
                //std println!("vm_cmp: op={}", imm);
                let vv = self.stack_pop();
                //std println!("vm_cmp: vv={} ${:08x}", vv, vv.raw());
                let v = self.stack_pop();
                //std println!("vm_cmp: v={} ${:08x}", v, v.raw());
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
                //std println!("vm_cmp: r={}", r);
                self.stack_push(r)?;
                kip
            },
            VM_IF => {
                let b = self.stack_pop();
                //std println!("vm_if: b={}", b);
                //std println!("vm_if: t={}", imm);
                //std println!("vm_if: f={}", kip);
                if falsey(b) { kip } else { imm }
            },
            VM_MSG => {
                //std println!("vm_msg: idx={}", imm);
                let n = imm.get_fix()?;
                let ep = self.ep();
                let event = self.mem(ep);
                let msg = event.y();
                let r = self.extract_nth(msg, n);
                //std println!("vm_msg: r={}", r);
                self.stack_push(r)?;
                kip
            },
            VM_MY => {
                //std println!("vm_my: op={}", imm);
                let me = self.self_ptr();
                //std println!("vm_my: me={} ${:08x} -> {}", me, me.raw(), self.ram(me));
                match imm {
                    MY_SELF => {
                        let ep = self.ep();
                        let target = self.ram(ep).x();
                        //std println!("vm_my: self={} ${:08x}", target, target.raw());
                        self.stack_push(target)?;
                    },
                    MY_BEH => {
                        let beh = self.ram(me).x();
                        //std println!("vm_my: beh={}", beh);
                        self.stack_push(beh)?;
                    },
                    MY_STATE => {
                        let state = self.ram(me).y();
                        //std println!("vm_my: state={}", state);
                        self.push_list(state)?;
                    },
                    _ => {
                        //std return Err(format!("Unknown my op {}!", imm));
                        return Err(1);
                    }
                }
                kip
            }
            VM_SEND => {
                //std println!("vm_send: cnt={}", imm);
                let num = imm.get_fix()?;
                let target = self.stack_pop();
                //std println!("vm_send: target={} ${:08x}", target, target.raw());
                assert!(self.typeq(ACTOR_T, target));
                let msg = if num > 0 {
                    self.pop_counted(num)
                } else {
                    self.stack_pop()
                };
                //std println!("vm_send: msg={}", msg);
                let ep = self.new_event(target, msg)?;
                let me = self.self_ptr();
                //std println!("vm_send: me={} -> {}", me, self.ram(me));
                let next = self.ram(me).z();
                if next.is_ram() {
                    self.ram_mut(ep).set_z(next);
                    //std println!("vm_send: ep={} -> {}", ep, self.mem(ep));
                }
                self.ram_mut(me).set_z(ep);
                //std println!("vm_send: me'={} -> {}", me, self.mem(me));
                kip
            },
            VM_NEW => {
                //std println!("vm_new: cnt={}", imm);
                let num = imm.get_fix()?;
                let ip = self.stack_pop();
                //std println!("vm_new: ip={}", ip);
                assert!(self.typeq(INSTR_T, ip));
                let sp = self.pop_counted(num);
                //std println!("vm_new: sp={}", sp);
                let a = self.new_actor(ip, sp)?;
                //std println!("vm_new: actor={} ${:08x}", a, a.raw());
                self.stack_push(a)?;
                kip
            },
            VM_BEH => {
                //std println!("vm_beh: cnt={}", imm);
                let num = imm.get_fix()?;
                let ip = self.stack_pop();
                //std println!("vm_beh: ip={}", ip);
                assert!(self.typeq(INSTR_T, ip));
                let sp = self.pop_counted(num);
                //std println!("vm_beh: sp={}", sp);
                let me = self.self_ptr();
                let actor = self.ram_mut(me);
                //std println!("vm_beh: me={} -> {}", me, actor);
                actor.set_x(ip);  // replace behavior function
                actor.set_y(sp);  // replace state data
                //std println!("vm_beh: me'={} -> {}", me, self.ram(me));
                kip
            },
            VM_END => {
                //std println!("vm_end: op={}", imm);
                let me = self.self_ptr();
                //std println!("vm_end: me={} -> {}", me, self.ram(me));
                let rv = match imm {
                    END_ABORT => {
                        let _r = self.stack_pop();  // reason for abort
                        //std println!("vm_end: reason={}", _r);
                        // FIXME: where should `reason` be recorded/reported?
                        self.actor_abort(me);
                        UNIT
                    },
                    END_STOP => {
                        //std println!("vm_end: MEMORY={}", self.ram(MEMORY));
                        //UNDEF
                        //std return Err(String::from("End::Stop terminated continuation"));
                        return Err(1);
                    },
                    END_COMMIT => {
                        self.actor_commit(me);
                        TRUE
                    },
                    END_RELEASE => {
                        self.ram_mut(me).set_y(NIL);  // no retained stack
                        self.actor_commit(me);
                        self.free(me);  // free actor
                        FALSE
                    },
                    _ => {
                        //std return Err(format!("Unknown end op {}!", imm));
                        return Err(1);
                    }
                };
                //std println!("vm_end: rv={}", rv);
                rv
            },
            VM_IS_EQ => {
                //std println!("vm_is_eq: expect={}", imm);
                let vv = self.stack_pop();
                //std println!("vm_is_eq: actual={}", vv);
                assert_eq!(imm, vv);
                kip
            },
            VM_IS_NE => {
                //std println!("vm_is_ne: expect={}", imm);
                let vv = self.stack_pop();
                //std println!("vm_is_ne: actual={}", vv);
                assert_ne!(imm, vv);
                kip
            },
            _ => {
                //std return Err(format!("Illegal instruction {}!", opr));
                return Err(1);
            }
        };
        //std println!("perform_op: ip'={} -> {}", ip_, self.mem(ip_));
        Ok(ip_)
    }

    fn event_enqueue(&mut self, ep: Any) {
        // add event to the back of the queue
        self.ram_mut(ep).set_z(NIL);
        if !self.e_first().is_ram() {
            self.set_e_first(ep);
        } else if self.e_last().is_ram() {
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
    fn event_inject(&mut self, ep: Any) {
        // add event to the front of the queue (e.g.: for interrupts)
        let first = self.e_first();
        self.ram_mut(ep).set_z(first);
        if !first.is_ram() {
            self.set_e_last(ep);
        }
        self.set_e_first(ep);
    }

    fn cont_enqueue(&mut self, kp: Any) {
        // add continuation to the back of the queue
        self.ram_mut(kp).set_z(NIL);
        if !self.k_first().is_ram() {
            self.set_k_first(kp);
        } else if self.k_last().is_ram() {
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
        let rollback = self.mem(self.ep()).z();
        if rollback.is_ram() {
            self.free(rollback);  // release rollback snapshot
        }
        let state = self.ram(me).y();
        self.stack_clear(state);
        // move sent-message events to event queue
        let mut ep = self.ram(me).z();
        while ep.is_ram() {
            let event = self.ram(ep);
            //std println!("actor_commit: ep={} -> {}", ep, event);
            let next = event.z();
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
        let mut ep = self.ram(me).z();
        while ep.is_ram() {
            let event = self.ram(ep);
            //std println!("actor_abort: ep={} -> {}", ep, event);
            let next = event.z();
            self.free(ep);
            ep = next;
        }
        // roll back actor transaction
        ep = self.ep();
        let rollback = self.mem(ep).z();
        if rollback.is_ram() {
            let quad = *self.mem(rollback);
            *self.ram_mut(me) = quad;  // restore actor from rollback
            self.free(rollback);  // release rollback snapshot
        }
    }
    pub fn actor_revert(&mut self) -> bool {
        // revert actor/event to pre-dispatch state
        if let Some(kp) = self.cont_dequeue() {
            let ep = self.mem(kp).y();
            let target = self.mem(ep).x();
            let me = self.cap_to_ptr(target);
            self.actor_abort(me);
            self.event_inject(ep);
            true
        } else {
            false
        }
    }
    pub fn self_ptr(&self) -> Any {
        let ep = self.ep();
        if !ep.is_ram() { return UNDEF }
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

    pub fn e_first(&self) -> Any { self.ram(self.ddeque()).t() }
    fn set_e_first(&mut self, ptr: Any) { self.ram_mut(self.ddeque()).set_t(ptr); }
    fn e_last(&self) -> Any { self.ram(self.ddeque()).x() }
    fn set_e_last(&mut self, ptr: Any) { self.ram_mut(self.ddeque()).set_x(ptr); }
    pub fn k_first(&self) -> Any { self.ram(self.ddeque()).y() }
    fn set_k_first(&mut self, ptr: Any) { self.ram_mut(self.ddeque()).set_y(ptr); }
    fn k_last(&self) -> Any { self.ram(self.ddeque()).z() }
    fn set_k_last(&mut self, ptr: Any) { self.ram_mut(self.ddeque()).set_z(ptr); }
    pub fn ddeque(&self) -> Any { self.ptr_to_mem(DDEQUE) }

    pub fn mem_top(&self) -> Any { self.ram(self.memory()).t() }
    fn set_mem_top(&mut self, ptr: Any) { self.ram_mut(self.memory()).set_t(ptr); }
    pub fn mem_next(&self) -> Any { self.ram(self.memory()).x() }
    fn set_mem_next(&mut self, ptr: Any) { self.ram_mut(self.memory()).set_x(ptr); }
    pub fn mem_free(&self) -> Any { self.ram(self.memory()).y() }
    fn set_mem_free(&mut self, fix: Any) { self.ram_mut(self.memory()).set_y(fix); }
    pub fn mem_root(&self) -> Any { self.ram(self.memory()).z() }
    fn set_mem_root(&mut self, ptr: Any) { self.ram_mut(self.memory()).set_z(ptr); }
    pub fn memory(&self) -> Any { self.ptr_to_mem(MEMORY) }

    pub fn new_event(&mut self, target: Any, msg: Any) -> Result<Any, Error> {
        assert!(self.typeq(ACTOR_T, target));
        let sponsor = self.event_sponsor(self.ep());
        let event = Quad::new_event(sponsor, target, msg);
        self.alloc(&event)
    }
    pub fn new_cont(&mut self, ip: Any, sp: Any, ep: Any) -> Result<Any, Error> {
        let cont = Quad::new_cont(ip, sp, ep);
        self.reserve(&cont)  // no Sponsor needed
    }
    pub fn new_actor(&mut self, beh: Any, state: Any) -> Result<Any, Error> {
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
            let (q, p) = self.split_nth(sp, n);
            if self.typeq(PAIR_T, p) {
                self.set_cdr(q, self.cdr(p));
                self.set_cdr(p, sp);
                self.set_sp(p);
            } else {
                self.stack_push(UNDEF)?;  // out of range
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
            //std println!("stack_pop: underflow!");  // NOTE: this is just a warning, returning UNDEF...
            UNDEF
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
                self.mem(ptr).t() == ACTOR_T
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
    fn follow_fwd(&self, val: Any) -> Any {
        let raw = val.raw();
        if (raw & (DIR_RAW | MUT_RAW)) == MUT_RAW {  // any RAM reference
            let ptr = Any::new(raw & !OPQ_RAW);  // WARNING: may convert Cap to Ptr!
            let quad = self.ram(ptr);
            if quad.t() == GC_FWD_T {
                let fwd = quad.z();
                //std println!("follow_fwd: {} ${:08x} --> {} ${:08x}", val, val.raw(), fwd, fwd.raw());
                return fwd;
            }
        }
        val
    }
    fn ptr_to_mem(&self, ptr: Any) -> Any {  // convert ptr/cap to current gc_phase
        let bank = ptr.bank();
        if bank.is_none() {
            ptr
        } else {
            let raw = ptr.raw() & !BNK_RAW;
            Any::new(self.gc_phase() | raw)
        }
    }
    fn ptr_to_cap(&self, ptr: Any) -> Any {
        assert!(self.mem(ptr).t() == ACTOR_T);
        let raw = ptr.raw() | OPQ_RAW;
        let cap = Any::new(raw);
        cap
    }
    fn cap_to_ptr(&self, cap: Any) -> Any {
        let raw = cap.raw() & !OPQ_RAW;
        let ptr = Any::new(raw);
        assert!(self.mem(ptr).t() == ACTOR_T);
        ptr
    }

    pub fn alloc(&mut self, init: &Quad) -> Result<Any, Error> {
        let ep = self.ep();
        let sponsor = self.event_sponsor(ep);
        //std println!("alloc: sponsor={} -> {}", sponsor, self.mem(sponsor));
        let limit = self.sponsor_memory(sponsor).fix_num().unwrap_or(0);
        //std println!("alloc: limit={}", limit);
        if limit <= 0 {
            //panic!("memory limit reached");
            //std return Err(String::from("memory limit reached"));
            return Err(1);
        }
        let ptr = self.reserve(init)?;
        self.set_sponsor_memory(sponsor, Any::fix(limit - 1));
        Ok(ptr)
    }
    fn reserve(&mut self, init: &Quad) -> Result<Any, Error> {
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
            if top >= QUAD_RAM_MAX {
                //panic!("out of memory!");
                //std return Err(String::from("out of memory!"));
                return Err(1);
            }
            self.set_mem_top(Any::ram(self.gc_phase(), top + 1));
            next
        };
        *self.ram_mut(ptr) = *init;  // copy initial value
        Ok(ptr)
    }
    pub fn free(&mut self, ptr: Any) {
        assert!(self.in_heap(ptr));
        if self.typeq(FREE_T, ptr) {
            //std panic!("double-free {}", ptr);
            panic!();
        }
        *self.ram_mut(ptr) = Quad::free_t(self.mem_next());  // clear cell to "free"
        self.set_mem_next(ptr);  // link into free-list
        let n = self.mem_free().fix_num().unwrap();
        self.set_mem_free(Any::fix(n + 1));  // increment cells available
    }

    pub fn gc_stop_the_world(&mut self) {
        /*
        1. Swap generations (`GC_GENX` <--> `GC_GENY`)
        2. Mark each cell in the root-set with `GC_SCAN`
            1. If a new cell is added to the root-set, mark it with `GC_SCAN`
        3. Mark each newly-allocated cell with `GC_SCAN`
        4. While there are cells marked `GC_SCAN`:
            1. Scan a cell, for each field of the cell:
                1. If it points to the heap, and is marked with the _previous_ generation, mark it `GC_SCAN`
            2. Mark the cell with the _current_ generation
        5. For each cell marked with the _previous_ generation,
            1. Mark the cell `GC_FREE` and add it to the free-cell chain
        */
        let ddeque = self.ddeque();
        let root = self.mem_root();
        let bank = if self.gc_phase() == BNK_0 { BNK_1 } else { BNK_0 };  // determine new phase
        //std println!("gc_stop_the_world: phase ${:08x} -> ${:08x}", self.gc_phase(), bank);
        self.set_mem_top(UNDEF);  // toggle GC phase
        self.gc_store(Any::ram(bank, MEMORY.addr()),
            Quad::memory_t(Any::ram(bank, ddeque.addr()), NIL, ZERO, root));
        let mut scan = ddeque;
        while scan.addr() <= SPONSOR.addr() {  // mark reserved RAM
            let raw = scan.raw();
            if self.gc_load(scan).t() == ACTOR_T {
                scan = Any::new(raw | OPQ_RAW);  // inferred capability
            }
            self.gc_mark(scan);
            scan = Any::new(raw + 1);
        }
        let root = self.gc_mark(root);
        self.set_mem_root(root);
        scan = self.ddeque();
        while scan != self.mem_top() {  // scan marked quads
            self.gc_scan(scan);
            scan = Any::new(scan.raw() + 1);
        }
        //std println!("gc_stop_the_world: mem_top={}", scan);
    }
    fn gc_mark(&mut self, val: Any) -> Any {
        if let Some(bank) = val.bank() {
            if bank != self.gc_phase() {
                let quad = self.gc_load(val);
                if quad.t() == GC_FWD_T {  // follow "broken heart"
                    return quad.z();
                }
                // copy quad to new-space
                let mut dup = self.reserve(&quad).unwrap();  // FIXME: handle Error result...
                if val.is_cap() {
                    dup = self.ptr_to_cap(dup);  // restore CAP marker
                };
                ////std println!("gc_mark: {} ${:08x} --> {} ${:08x}", val, val.raw(), dup, dup.raw());
                self.gc_store(val, Quad::gc_fwd_t(dup));  // leave "broken heart" behind
                return dup;
            }
        }
        val
    }
    fn gc_scan(&mut self, ptr: Any) {
        assert_eq!(Some(self.gc_phase()), ptr.bank());
        let quad = self.gc_load(ptr);
        let t = self.gc_mark(quad.t());
        let x = self.gc_mark(quad.x());
        let y = self.gc_mark(quad.y());
        let z = self.gc_mark(quad.z());
        let quad = Quad::new(t, x, y, z);
        self.gc_store(ptr, quad);
    }
    fn gc_load(&self, ptr: Any) -> Quad {  // load quad directly
        match ptr.bank() {
            Some(bank) => {
                let addr = ptr.addr();
                if bank == BNK_0 {
                    self.quad_ram0[addr]
                } else {
                    self.quad_ram1[addr]
                }
            },
            //std None => panic!("invalid gc_load=${:08x}", ptr.raw()),
            None => panic!(),
        }
    }
    fn gc_store(&mut self, ptr: Any, quad: Quad) {  // store quad directly
        match ptr.bank() {
            Some(bank) => {
                let addr = ptr.addr();
                if bank == BNK_0 {
                    self.quad_ram0[addr] = quad;
                } else {
                    self.quad_ram1[addr] = quad;
                }
            },
            //std None => panic!("invalid gc_store=${:08x}", ptr.raw()),
            None => panic!(),
        }
    }
    pub fn gc_phase(&self) -> Raw {
        if self.gc_load(Any::ram(BNK_0, MEMORY.addr())).t() == UNDEF {
            BNK_1
        } else {
            BNK_0
        }
    }

    pub fn mem(&self, ptr: Any) -> &Quad {
        if !ptr.is_ptr() {
            //std panic!("invalid ptr=${:08x}", ptr.raw());
            panic!();
        }
        if ptr.is_ram() {
            self.ram(ptr)
        } else {
            self.rom(ptr)
        }
    }
    pub fn rom(&self, ptr: Any) -> &Quad {
        if !ptr.is_rom() {
            //std panic!("invalid ROM ptr=${:08x}", ptr.raw());
            panic!();
        }
        let addr = ptr.addr();
        &self.quad_rom[addr]
    }
    pub fn ram(&self, ptr: Any) -> &Quad {
        if ptr.is_cap() {
            //std panic!("opaque ptr=${:08x}", ptr.raw());
            panic!();
        }
        if let Some(bank) = ptr.bank() {
            let addr = ptr.addr();
            if bank == BNK_0 {
                &self.quad_ram0[addr]
            } else {
                &self.quad_ram1[addr]
            }
        } else {
            //std panic!("invalid RAM ptr=${:08x}", ptr.raw());
            panic!();
        }
    }
    pub fn ram_mut(&mut self, ptr: Any) -> &mut Quad {
        if ptr.is_cap() {
            //std panic!("opaque ptr=${:08x}", ptr.raw());
            panic!();
        }
        if let Some(bank) = ptr.bank() {
            let addr = ptr.addr();
            if bank == BNK_0 {
                &mut self.quad_ram0[addr]
            } else {
                &mut self.quad_ram1[addr]
            }
        } else {
            //std panic!("invalid RAM ptr=${:08x}", ptr.raw());
            panic!();
        }
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

//#[cfg(test)] -- use this if/when the tests are in a sub-module
#[test]
fn base_types_are_32_bits() {
    assert_eq!(4, std::mem::size_of::<Raw>());
    assert_eq!(4, std::mem::size_of::<Num>());
    assert_eq!(4, std::mem::size_of::<Any>());
    assert_eq!(16, std::mem::size_of::<Quad>());
}

#[test]
fn fix_zero_value_roundtrips() {
    let n = Any::fix(0);
    let r = n.raw();
    let v = Any::new(r);
    assert!(v.is_fix());
    let o = v.fix_num();
    assert!(o.is_some());
    let i = o.unwrap();
    let m = Any::fix(i);
    assert_eq!(n, m);
    assert_eq!(0, m.fix_num().unwrap());
}

#[test]
fn fix_positive_value_roundtrips() {
    let n = Any::fix(42);
    let r = n.raw();
    let v = Any::new(r);
    assert!(v.is_fix());
    let o = v.fix_num();
    assert!(o.is_some());
    let i = o.unwrap();
    let m = Any::fix(i);
    assert_eq!(n, m);
    assert_eq!(42, m.fix_num().unwrap());
}

#[test]
fn fix_negative_value_roundtrips() {
    let n = Any::fix(-42);
    let r = n.raw();
    let v = Any::new(r);
    assert!(v.is_fix());
    let o = v.fix_num();
    assert!(o.is_some());
    let i = o.unwrap();
    let m = Any::fix(i);
    assert_eq!(n, m);
    assert_eq!(-42, m.fix_num().unwrap());
}

#[test]
#[should_panic]
fn fix_cast_to_addr() {
    let n = Any::fix(0);
    let _p = n.addr();  // should panic!
}

#[test]
fn ptr_is_distinct_from_cap() {
    let p = Any::ram(BNK_0, 42);
    let c = Any::cap(42);
    assert_ne!(p.raw(), c.raw());
    assert_eq!(p.addr(), c.addr());
}

#[test]
fn core_initialization() {
    let core = Core::new();
    //assert_eq!(0, core.mem_free().fix_num().unwrap());
    assert_eq!(ZERO, core.mem_free());
    assert_eq!(NIL, core.mem_next());
    assert_eq!(NIL, core.e_first());
    assert_ne!(NIL, core.k_first());
    assert_eq!(core.kp(), core.k_first());
    //std println!("RAM");
    for ofs in 0..32 {
        let ptr = Any::ram(core.gc_phase(), ofs);
        let quad = core.ram(ptr);
        //std println!("{:5}: {} -> {}", ofs, ptr, quad);
    }
    //std println!("ROM");
    for ofs in 0..32 {
        let ptr = Any::rom(ofs);
        let quad = core.rom(ptr);
        //std println!("{:5}: {} -> {}", ofs, ptr, quad);
    }
    //assert!(false);  // force output to be displayed
}

#[test]
fn basic_memory_allocation() {
    let mut core = Core::new();
    let top_before = core.mem_top().addr();
    //std println!("mem_top: {}", core.mem_top());
    let m1 = core.alloc(&Quad::pair_t(PLUS_1, PLUS_1)).unwrap();
    //std println!("m1:{} -> {}", m1, core.mem(m1));
    //std println!("mem_top: {}", core.mem_top());
    let m2 = core.alloc(&Quad::pair_t(PLUS_2, PLUS_2)).unwrap();
    //std println!("mem_top: {}", core.mem_top());
    let m3 = core.alloc(&Quad::pair_t(PLUS_3, PLUS_3)).unwrap();
    //std println!("mem_top: {}", core.mem_top());
    //std println!("mem_free: {}", core.mem_free());
    core.free(m2);
    //std println!("mem_free: {}", core.mem_free());
    core.free(m3);
    //std println!("mem_free: {}", core.mem_free());
    let _m4 = core.alloc(&Quad::pair_t(PLUS_4, PLUS_4)).unwrap();
    //std println!("mem_top: {}", core.mem_top());
    //std println!("mem_free: {}", core.mem_free());
    let top_after = core.mem_top().addr();
    assert_eq!(3, top_after - top_before);
    //assert_eq!(1, core.mem_free().fix_num().unwrap());
    assert_eq!(PLUS_1, core.mem_free());
    //std println!("mem_next: {} -> {}", core.mem_next(), core.mem(core.mem_next()));
    //assert!(false);  // force output to be displayed
}

#[test]
fn run_loop_terminates() {
    let mut core = Core::new();
    let _ep = core.ep();
    //core.set_sponsor_events(_ep, Any::fix(0));  // FIXME: forcing "out-of-events" error...
    let ok = core.run_loop();
    assert!(ok);
    //assert!(false);  // force output to be displayed
}

#[test]
fn gc_before_and_after_run() {
    let mut core = Core::new();
    assert_eq!(BNK_0, core.gc_phase());
    core.gc_stop_the_world();
    assert_eq!(BNK_1, core.gc_phase());
    core.run_loop();
    let bank = core.gc_phase();
    core.gc_stop_the_world();
    assert_ne!(bank, core.gc_phase());
    //assert!(false);  // force output to be displayed
}
