// Univeral type-tagged scalar value

use crate::*;

// literal values (`Any` type)
pub const MINUS_4: Any      = Any::fix(-4);
pub const MINUS_3: Any      = Any::fix(-3);
pub const MINUS_2: Any      = Any::fix(-2);
pub const MINUS_1: Any      = Any::fix(-1); //Any { raw: DIR_RAW | -1i32 as Raw };
pub const ZERO: Any         = Any::fix(0); //Any { raw: DIR_RAW | 0 };
pub const PLUS_1: Any       = Any::fix(1);
pub const PLUS_2: Any       = Any::fix(2);
pub const PLUS_3: Any       = Any::fix(3);
pub const PLUS_4: Any       = Any::fix(4);
pub const PLUS_5: Any       = Any::fix(5);
pub const PLUS_6: Any       = Any::fix(6);
pub const PLUS_7: Any       = Any::fix(7);

pub const UNDEF: Any        = Any::rom(0x0);
pub const NIL: Any          = Any::rom(0x1);
pub const FALSE: Any        = Any::rom(0x2);
pub const TRUE: Any         = Any::rom(0x3);
pub const ROM_04: Any       = Any::rom(0x4);  // RESERVED
pub const EMPTY_DQ: Any     = Any::rom(0x5);

pub const LITERAL_T: Any    = UNDEF;
pub const TYPE_T: Any       = Any::rom(0x6);
pub const FIXNUM_T: Any     = Any::rom(0x7);
pub const ACTOR_T: Any      = Any::rom(0x8);
pub const PROXY_T: Any      = Any::rom(0x9);
pub const STUB_T: Any       = Any::rom(0xA);
pub const INSTR_T: Any      = Any::rom(0xB);
pub const PAIR_T: Any       = Any::rom(0xC);
pub const DICT_T: Any       = Any::rom(0xD);
pub const FWD_REF_T: Any    = Any::rom(0xE);
pub const FREE_T: Any       = Any::rom(0xF);  // MUST BE (ROM_BASE_OFS - 1)

pub const ROM_BASE_OFS: usize = 0x10;  // ROM offsets below this value are reserved

// INSTR_T values
pub const VM_DEBUG: Any     = Any::fix(0x00);  // +0
pub const VM_JUMP: Any      = Any::fix(0x01);  // +1
pub const VM_PUSH: Any      = Any::fix(0x02);  // +2
pub const VM_IF: Any        = Any::fix(0x03);  // +3
pub const VM_04: Any        = Any::fix(0x04);  // RESERVED
pub const VM_TYPEQ: Any     = Any::fix(0x05);  // +5
pub const VM_EQ: Any        = Any::fix(0x06);  // +6
pub const VM_ASSERT: Any    = Any::fix(0x07);  // +7

pub const VM_SPONSOR: Any   = Any::fix(0x08);  // +8
pub const VM_ACTOR: Any     = Any::fix(0x09);  // +9
pub const VM_DICT: Any      = Any::fix(0x0A);  // +10
pub const VM_DEQUE: Any     = Any::fix(0x0B);  // +11
pub const VM_0C: Any        = Any::fix(0x0C);  // RESERVED
pub const VM_ALU: Any       = Any::fix(0x0D);  // +13
pub const VM_CMP: Any       = Any::fix(0x0E);  // +14
pub const VM_END: Any       = Any::fix(0x0F);  // +15

pub const VM_QUAD: Any      = Any::fix(0x10);  // +16
pub const VM_PAIR: Any      = Any::fix(0x11);  // +17
pub const VM_PART: Any      = Any::fix(0x12);  // +18
pub const VM_NTH: Any       = Any::fix(0x13);  // +19
pub const VM_PICK: Any      = Any::fix(0x14);  // +20
pub const VM_ROLL: Any      = Any::fix(0x15);  // +21
pub const VM_DUP: Any       = Any::fix(0x16);  // +22
pub const VM_DROP: Any      = Any::fix(0x17);  // +23

pub const VM_MSG: Any       = Any::fix(0x18);  // +24
pub const VM_STATE: Any     = Any::fix(0x19);  // +25
pub const VM_1A: Any        = Any::fix(0x1A);  // RESERVED
pub const VM_1B: Any        = Any::fix(0x1B);  // RESERVED
pub const VM_1C: Any        = Any::fix(0x1C);  // RESERVED
pub const VM_1D: Any        = Any::fix(0x1D);  // RESERVED
pub const VM_1E: Any        = Any::fix(0x1E);  // RESERVED
pub const VM_1F: Any        = Any::fix(0x1F);  // RESERVED

// VM_DICT dictionary operations
pub const DICT_HAS: Any     = ZERO;
pub const DICT_GET: Any     = PLUS_1;
pub const DICT_ADD: Any     = PLUS_2;
pub const DICT_SET: Any     = PLUS_3;
pub const DICT_DEL: Any     = PLUS_4;

// VM_DEQUE deque operations
pub const DEQUE_NEW: Any    = ZERO;
pub const DEQUE_EMPTY: Any  = PLUS_1;
pub const DEQUE_PUSH: Any   = PLUS_2;
pub const DEQUE_POP: Any    = PLUS_3;
pub const DEQUE_PUT: Any    = PLUS_4;
pub const DEQUE_PULL: Any   = PLUS_5;
pub const DEQUE_LEN: Any    = PLUS_6;

// VM_ALU arithmetic/logical operations
pub const ALU_NOT: Any      = ZERO;
pub const ALU_AND: Any      = PLUS_1;
pub const ALU_OR: Any       = PLUS_2;
pub const ALU_XOR: Any      = PLUS_3;
pub const ALU_ADD: Any      = PLUS_4;
pub const ALU_SUB: Any      = PLUS_5;
pub const ALU_MUL: Any      = PLUS_6;
pub const ALU_DIV: Any      = PLUS_7;  // RESERVED
pub const ALU_LSL: Any      = Any::fix(8);
pub const ALU_LSR: Any      = Any::fix(9);
pub const ALU_ASR: Any      = Any::fix(10);
pub const ALU_ROL: Any      = Any::fix(11);
pub const ALU_ROR: Any      = Any::fix(12);

// VM_CMP comparison operations
pub const CMP_EQ: Any       = ZERO;
pub const CMP_GE: Any       = PLUS_1;
pub const CMP_GT: Any       = PLUS_2;
pub const CMP_LT: Any       = PLUS_3;
pub const CMP_LE: Any       = PLUS_4;
pub const CMP_NE: Any       = PLUS_5;

// VM_ACTOR actor operations
pub const ACTOR_SEND: Any   = ZERO;
pub const ACTOR_POST: Any   = PLUS_1;
pub const ACTOR_CREATE: Any = PLUS_2;
pub const ACTOR_BECOME: Any = PLUS_3;
pub const ACTOR_SELF: Any   = PLUS_4;

// VM_END thread actions
pub const END_ABORT: Any    = MINUS_1;
pub const END_STOP: Any     = ZERO;
pub const END_COMMIT: Any   = PLUS_1;

// VM_SPONSOR sponsorship management
pub const SPONSOR_NEW: Any      = ZERO;
pub const SPONSOR_MEMORY: Any   = PLUS_1;
pub const SPONSOR_EVENTS: Any   = PLUS_2;
pub const SPONSOR_CYCLES: Any   = PLUS_3;
pub const SPONSOR_RECLAIM: Any  = PLUS_4;
pub const SPONSOR_START: Any    = PLUS_5;
pub const SPONSOR_STOP: Any     = PLUS_6;

// type-tagged value
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Any {
    //raw: Raw,
    pub raw: Raw, // FIXME: THIS FIELD SHOULD BE PRIVATE!
}

impl Any {
    pub const fn new(raw: Raw) -> Self {
        Any { raw }
    }
    pub const fn fix(num: isize) -> Self {
        let raw = num as Raw;
        Any::new(DIR_RAW | raw)
    }
    pub const fn cap(ofs: usize) -> Self {
        let raw = (ofs as Raw) & !MSK_RAW;
        Any::new(OPQ_RAW | MUT_RAW | raw)
    }
    pub const fn rom(ofs: usize) -> Self {
        let raw = (ofs as Raw) & !MSK_RAW;
        Any::new(raw)
    }
    pub const fn ram(ofs: usize) -> Self {
        let raw = (ofs as Raw) & !MSK_RAW;
        Any::new(MUT_RAW | raw)
    }

    pub fn raw(&self) -> Raw {
        self.raw
    }
    // FIXME: we are limiting all offsets to 28 bits
    pub fn ofs(&self) -> usize {
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
        (self.raw & (DIR_RAW | MUT_RAW | OPQ_RAW)) == (MUT_RAW | OPQ_RAW)
    }
    pub fn is_ptr(&self) -> bool {
        self.is_rom() || self.is_ram()  // excludes ocaps
    }
    pub fn is_rom(&self) -> bool {
        (self.raw & (DIR_RAW | MUT_RAW)) == 0
    }
    pub fn is_ram(&self) -> bool {
        (self.raw & (DIR_RAW | MUT_RAW | OPQ_RAW)) == MUT_RAW
    }
    pub fn get_fix(&self) -> Result<isize, Error> {
        match self.fix_num() {
            Some(num) => Ok(num),
            None => Err(E_NOT_FIX),  // fixnum required
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_fix_value_roundtrips() {
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
    fn positive_fix_value_roundtrips() {
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
    fn negative_fix_value_roundtrips() {
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
    fn cast_fix_to_ofs() {
        let n = Any::fix(0);
        let _p = n.ofs();  // should panic!
    }

    #[test]
    fn ptr_is_distinct_from_cap() {
        let p = Any::ram(42);
        let c = Any::cap(42);
        assert_ne!(p.raw(), c.raw());
        assert_eq!(p.ofs(), c.ofs());
    }

}
