// uFork virtual CPU

const QUAD_MAX: usize = 1<<12;  // 4K quad-cells

pub struct Vcpu {
    quad_mem: [Quad; QUAD_MAX],
    quad_top: Ptr,
    quad_next: Ptr,
}

impl Vcpu {
    pub fn new() -> Vcpu {
        let mut quad_mem = [
            Quad::new(UNDEF, UNDEF, UNDEF, UNDEF);
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
    fn in_heap(&self, val: Val) -> bool {
        let raw = val.raw();
        (raw < self.quad_top.raw()) && (raw >= START.raw())
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
    fn quad_mut(&mut self, ptr: Ptr) -> &mut Quad {
        let addr = self.addr(ptr).unwrap();
        &mut self.quad_mem[addr]
    }
    fn typeq(&self, typ: Val, val: Val) -> bool {
        if typ == FIXNUM_T {
            let fix = Fix::from(val);
            return fix.is_some();
        }
        if typ == ACTOR_T {
            return match Cap::from(val) {
                Some(cap) => {
                    let ptr = Ptr::new(cap.raw());  // WARNING: converting Cap to Ptr!
                    match self.addr(ptr) {
                        Some(addr) => {
                            ACTOR_T == self.quad_mem[addr].t()
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
                        typ == self.quad_mem[addr].t()
                    },
                    None => false,
                }
            },
            None => false,
        }
    }
    fn alloc(&mut self, t: Val, x: Val, y: Val, z: Val) -> Ptr {
        let mut ptr = self.quad_next;
        if self.typeq(FREE_T, ptr.val()) {
            self.quad_next = self.quad(ptr).z().ptr();
        } else if self.quad_top.raw() < QUAD_MAX {
            ptr = self.quad_top;
            self.quad_top = Ptr::new(ptr.raw() + 1);
        } else {
            panic!("quad-memory exhausted!");
        }
        let quad = self.quad_mut(ptr);
        quad.set_t(t);
        quad.set_x(x);
        quad.set_y(y);
        quad.set_z(z);
        ptr
    }
    fn free(&mut self, ptr: Ptr) {
        let val = ptr.val();
        assert!(self.in_heap(val));
        assert!(!self.typeq(FREE_T, val));
        let next = self.quad_next;
        let quad = self.quad_mut(ptr);
        quad.set_t(FREE_T);
        quad.set_x(UNDEF);
        quad.set_y(UNDEF);
        quad.set_z(next.val());
        self.quad_next = ptr;
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
// quad-cell (minimum addressable unit)
pub struct Quad { t: Val, x: Val, y: Val, z: Val }
impl Quad {
    fn new(t: Val, x: Val, y: Val, z: Val) -> Quad {
        Quad { t, x, y, z }
    }
    fn t(&self) -> Val { self.t }
    fn x(&self) -> Val { self.x }
    fn y(&self) -> Val { self.y }
    fn z(&self) -> Val { self.z }
    fn set_t(&mut self, v: Val) { self.t = v; }
    fn set_x(&mut self, v: Val) { self.x = v; }
    fn set_y(&mut self, v: Val) { self.y = v; }
    fn set_z(&mut self, v: Val) { self.z = v; }
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
    fn fix(self) -> Fix {  // NOTE: consumes `self`
        Fix::from(self).unwrap()
    }
    fn ptr(self) -> Ptr {  // NOTE: consumes `self`
        Ptr::from(self).unwrap()
    }
    fn cap(self) -> Cap {  // NOTE: consumes `self`
        Cap::from(self).unwrap()
    }
}

const UNDEF: Val        = Val { raw: 0 }; //Val::new(0); -- const generic issue...
const NIL: Val          = Val { raw: 1 };
const FALSE: Val        = Val { raw: 2 };
const TRUE: Val         = Val { raw: 3 };
const UNIT: Val         = Val { raw: 4 };

const LITERAL_T: Val    = Val { raw: 0 }; //Val::new(0);
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
    fn from(val: Val) -> Option<Fix> {
        let raw = val.raw();
        if (raw & DIR_RAW) != 0 {
            let num = ((raw << 1) as isize) >> 1;
            Some(Fix::new(num))
        } else {
            None
        }
    }
    fn val(self) -> Val {  // NOTE: consumes `self`
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
    fn from(val: Val) -> Option<Ptr> {
        let raw = val.raw();
        if (raw & MSK_RAW) == 0 {
            Some(Ptr::new(raw))
        } else {
            None
        }
    }
    fn val(self) -> Val {  // NOTE: consumes `self`
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
        if (raw & MSK_RAW) == OPQ_RAW {
            Some(Cap::new(raw))
        } else {
            None
        }
    }
    fn val(self) -> Val {  // NOTE: consumes `self`
        Val::new(self.raw | OPQ_RAW)
    }
    fn raw(&self) -> usize {
        self.raw
    }
}
