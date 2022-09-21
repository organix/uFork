// uFork virtual CPU

const QUAD_MAX: usize = 1<<12;  // 4K quad-cells

pub struct Vcpu {
    quad_mem: [Quad; QUAD_MAX],
    quad_top: Ptr,
    quad_next: Ptr,
}

impl Vcpu {
    pub fn new() -> Vcpu {
        let mut quad_mem =  [
            Quad { t: UNDEF, x: UNDEF, y: UNDEF, z: UNDEF };
            QUAD_MAX
        ];
        quad_mem[UNDEF.raw()]       = Quad::new(LITERAL_T,  UNDEF,      UNDEF,      UNDEF);
        quad_mem[NIL.raw()]         = Quad::new(LITERAL_T,  UNDEF,      UNDEF,      UNDEF);
        quad_mem[FALSE.raw()]       = Quad::new(LITERAL_T,  UNDEF,      UNDEF,      UNDEF);
        quad_mem[TRUE.raw()]        = Quad::new(LITERAL_T,  UNDEF,      UNDEF,      UNDEF);
        quad_mem[UNIT.raw()]        = Quad::new(LITERAL_T,  UNDEF,      UNDEF,      UNDEF);
        quad_mem[TYPE_T.raw()]      = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[EVENT_T.raw()]     = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[OPCODE_T.raw()]    = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[ACTOR_T.raw()]     = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[FIXNUM_T.raw()]    = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[SYMBOL_T.raw()]    = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[PAIR_T.raw()]      = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[FEXPR_T.raw()]     = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[FREE_T.raw()]      = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        Vcpu {
            quad_mem,
            quad_top: START.ptr(),
            quad_next: NIL.ptr(),
        }
    }
    fn addr(&self, ptr: Ptr) -> Option<usize> {
        let raw = ptr.raw();
        if raw < self.quad_top.raw() {
            Some(raw)
        } else {
            None
        }
    }
    fn quad(&self, ptr: Ptr) -> &Quad {
        let addr = self.addr(ptr).unwrap();
        &self.quad_mem[addr]
    }
    fn set_quad(&mut self, ptr: Ptr, quad: &Quad) {
        let addr = self.addr(ptr).unwrap();
        self.quad_mem[addr] = *quad;
    }
    fn typeq(&self, typ: &Val, val: &Val) -> bool {
        if *typ == FIXNUM_T {
            let fix = Fix::from(val);
            return fix.is_some();
        }
        if *typ == ACTOR_T {
            return match Cap::from(val) {
                Some(cap) => {
                    let ptr = Ptr::new(cap.raw());  // WARNING: converting Cap to Ptr!
                    match self.addr(ptr) {
                        Some(addr) => {
                            ACTOR_T == self.quad_mem[addr].t
                        },
                        None => false,
                    }
                },
                None => false,
            }
        }
        match Ptr::from(val) {
            Some(ptr) => {
                match self.addr(ptr) {
                    Some(addr) => {
                        *typ == self.quad_mem[addr].t
                    },
                    None => false,
                }
            },
            None => false,
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
    fn fix(&self) -> Fix {
        Fix::from(self).unwrap()
    }
    fn ptr(&self) -> Ptr {
        Ptr::from(self).unwrap()
    }
    fn cap(&self) -> Cap {
        Cap::from(self).unwrap()
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
const OPQ_RAW: usize    = 0x4000_0000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fix { num: isize }
impl Fix {
    fn new(num: isize) -> Fix {
        Fix { num }
    }
    fn from(val: &Val) -> Option<Fix> {
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
pub struct Ptr { raw: usize }
impl Ptr {
    fn new(raw: usize) -> Ptr {
        Ptr { raw: (raw & !MSK_RAW) }
    }
    fn from(val: &Val) -> Option<Ptr> {
        let raw = val.raw();
        if (raw & MSK_RAW) == 0 {
            Some(Ptr::new(raw))
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
    fn from(val: &Val) -> Option<Cap> {
        let raw = val.raw();
        if (raw & MSK_RAW) == OPQ_RAW {
            Some(Cap::new(raw))
        } else {
            None
        }
    }
    fn val(&self) -> Val {
        Val::new(self.raw | OPQ_RAW)
    }
    fn raw(&self) -> usize {
        self.raw
    }
}
