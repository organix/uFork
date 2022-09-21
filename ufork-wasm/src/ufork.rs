// uFork virtual CPU

const QUAD_MAX: usize = 1<<12;

pub struct Vcpu {
    quad_mem: [Quad; QUAD_MAX],
    quad_top: Val,
    quad_next: Val,
}

impl Vcpu {
    pub fn new() -> Vcpu {
        Vcpu {
            quad_mem: [
                Quad::new(UNDEF, UNDEF, UNDEF, UNDEF);
                QUAD_MAX
            ],
            quad_top: START,
            quad_next: NIL,
        }
    }
    fn addr(&self, raw: usize) -> Option<usize> {
        if raw < self.quad_top.raw() {
            Some(raw)
        } else {
            None
        }
    }
    fn quad(&self, ptr: Ref) -> &Quad {
        &self.quad_mem[self.addr(ptr.raw()).unwrap()]
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
// quad-cell (minimum addressable unit)
pub struct Quad { t: Val, x: Val, y: Val, z: Val }
impl Quad {
    fn new(t: Val, x: Val, y: Val, z: Val) -> Quad {
        Quad { t, x, y, z }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Val { raw: usize }
impl Val {
    fn new(raw: usize) -> Val {
        Val { raw }
    }
    fn raw(&self) -> usize {
        self.raw
    }
}

const UNDEF: Val        = Val { raw: 0 };
const NIL: Val          = Val { raw: 1 };
const FALSE: Val        = Val { raw: 2 };
const TRUE: Val         = Val { raw: 3 };
const UNIT: Val         = Val { raw: 4 };

const LITERAL_T: Val    = Val { raw: 0 };
const TYPE_T: Val       = Val { raw: 5 };
const EVENT_T: Val      = Val { raw: 6 };
const OPCODE_T: Val     = Val { raw: 7 };
const ACTOR_T: Val      = Val { raw: 8 };
const FIXNUM_T: Val     = Val { raw: 9 };
const SYMBOL_T: Val     = Val { raw: 10 };
const PAIR_T: Val       = Val { raw: 11 };
const FEXPR_T: Val      = Val { raw: 12 };
const FREE_T: Val       = Val { raw: 13 };

const START: Val        = Val { raw: 14 };

const MSK_RAW: usize    = 0xC000_0000;
const DIR_RAW: usize    = 0x8000_0000;
const CAP_RAW: usize    = 0x4000_0000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fix { num: isize }
impl Fix {
    fn new(num: isize) -> Fix {
        Fix { num }
    }
    fn from(val: Val) -> Option<Fix> {
        let raw = val.raw();
        if (raw & DIR_RAW) != 0 {
            let num = ((raw << 1) as isize) >> 1;
            Some(Fix::new(num))
        } else {
            None
        }
    }
    fn val(&self) -> Val {
        Val::new(self.num as usize | DIR_RAW)
    }
    fn num(&self) -> isize {
        self.num
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Ref { raw: usize }
impl Ref {
    fn new(raw: usize) -> Ref {
        Ref { raw: (raw & !MSK_RAW) }
    }
    fn from(val: Val) -> Option<Ref> {
        let raw = val.raw();
        if (raw & MSK_RAW) == 0 {
            Some(Ref::new(raw))
        } else {
            None
        }
    }
    fn val(&self) -> Val {
        Val::new(self.raw)
    }
    fn raw(&self) -> usize {
        self.raw
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Cap { raw: usize }
impl Cap {
    fn new(raw: usize) -> Cap {
        Cap { raw: (raw & !MSK_RAW) }
    }
    fn from(val: Val) -> Option<Cap> {
        let raw = val.raw();
        if (raw & MSK_RAW) == CAP_RAW {
            Some(Cap::new(raw))
        } else {
            None
        }
    }
    fn val(&self) -> Val {
        Val::new(self.raw | CAP_RAW)
    }
    fn raw(&self) -> usize {
        self.raw
    }
}
