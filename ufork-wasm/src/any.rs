// Univeral type-tagged scalar value

use crate::*;

// literal values (`Any` type)
pub const MINUS_5: Any      = Any { raw: DIR_RAW | -5i32 as Raw };
pub const MINUS_4: Any      = Any { raw: DIR_RAW | -4i32 as Raw };
pub const MINUS_3: Any      = Any { raw: DIR_RAW | -3i32 as Raw };
pub const MINUS_2: Any      = Any { raw: DIR_RAW | -2i32 as Raw };
pub const MINUS_1: Any      = Any { raw: DIR_RAW | -1i32 as Raw };
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
pub const EMPTY_DQ: Any     = Any { raw: 5 };
pub const LITERAL_T: Any    = Any { raw: 0 };  // == UNDEF
pub const TYPE_T: Any       = Any { raw: 6 };
pub const FIXNUM_T: Any     = Any { raw: 7 };
pub const ACTOR_T: Any      = Any { raw: 8 };
pub const PROXY_T: Any      = Any { raw: 9 };
pub const STUB_T: Any       = Any { raw: 10 };
pub const INSTR_T: Any      = Any { raw: 11 };
pub const PAIR_T: Any       = Any { raw: 12 };
pub const DICT_T: Any       = Any { raw: 13 };
pub const FWD_REF_T: Any    = Any { raw: 14 };
pub const FREE_T: Any       = Any { raw: 15 };  // MUST BE (ROM_BASE_OFS - 1)

// INSTR_T values
pub const VM_TYPEQ: Any     = Any { raw: DIR_RAW | 0 };
pub const VM_QUAD: Any      = Any { raw: DIR_RAW | 1 };
pub const VM_GET: Any       = Any { raw: DIR_RAW | 2 };
pub const VM_DICT: Any      = Any { raw: DIR_RAW | 3 };
pub const VM_PAIR: Any      = Any { raw: DIR_RAW | 4 };
pub const VM_PART: Any      = Any { raw: DIR_RAW | 5 };
pub const VM_NTH: Any       = Any { raw: DIR_RAW | 6 };
pub const VM_PUSH: Any      = Any { raw: DIR_RAW | 7 };
pub const VM_JUMP: Any      = Any { raw: DIR_RAW | 8 };
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
pub const VM_SPONSOR: Any   = Any { raw: DIR_RAW | 23 };
//pub const VM_PUTC: Any      = Any { raw: DIR_RAW | 24 };
//pub const VM_GETC: Any      = Any { raw: DIR_RAW | 25 };
pub const VM_DEBUG: Any     = Any { raw: DIR_RAW | 26 };
pub const VM_DEQUE: Any     = Any { raw: DIR_RAW | 27 };
pub const VM_STATE: Any     = Any { raw: DIR_RAW | 28 };
pub const VM_SIGNAL: Any    = Any { raw: DIR_RAW | 29 };
pub const VM_IS_EQ: Any     = Any { raw: DIR_RAW | 30 };
pub const VM_IS_NE: Any     = Any { raw: DIR_RAW | 31 };

// VM_GET quad field operations
pub const GET_T: Any        = Any { raw: DIR_RAW | 0 };
pub const GET_X: Any        = Any { raw: DIR_RAW | 1 };
pub const GET_Y: Any        = Any { raw: DIR_RAW | 2 };
pub const GET_Z: Any        = Any { raw: DIR_RAW | 3 };

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
pub const END_ABORT: Any    = Any { raw: DIR_RAW | -1i32 as Raw };
pub const END_STOP: Any     = Any { raw: DIR_RAW | 0 };
pub const END_COMMIT: Any   = Any { raw: DIR_RAW | 1 };
pub const END_RELEASE: Any  = Any { raw: DIR_RAW | 2 };

// VM_SPONSOR sponsorship management
pub const SPONSOR_NEW: Any = Any { raw: DIR_RAW | 0 };
pub const SPONSOR_MEMORY: Any = Any { raw: DIR_RAW | 1 };
pub const SPONSOR_EVENTS: Any = Any { raw: DIR_RAW | 2 };
pub const SPONSOR_CYCLES: Any = Any { raw: DIR_RAW | 3 };
pub const SPONSOR_RECLAIM: Any = Any { raw: DIR_RAW | 4 };
pub const SPONSOR_START: Any = Any { raw: DIR_RAW | 5 };
pub const SPONSOR_STOP: Any = Any { raw: DIR_RAW | 6 };

// type-tagged value
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Any {
    //raw: Raw,
    pub raw: Raw, // FIXME: THIS FIELD SHOULD BE PRIVATE!
}

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
        (self.raw & (DIR_RAW | OPQ_RAW)) == OPQ_RAW
    }
    pub fn is_ptr(&self) -> bool {
        (self.raw & (DIR_RAW | OPQ_RAW)) == 0
    }
    pub fn is_rom(&self) -> bool {
        (self.raw & MSK_RAW) == 0
    }
    pub fn is_ram(&self) -> bool {
        (self.raw & MSK_RAW) == MUT_RAW
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
