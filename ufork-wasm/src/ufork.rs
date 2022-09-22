// uFork virtual CPU

use crate::queue::Queue;

type Raw = u32;  // univeral value type
type Num = i32;  // fixnum integer type

const QUAD_MAX: usize = 1<<12;  // 4K quad-cells

pub struct Core {
    quad_mem: [Quad; QUAD_MAX],
    quad_top: Ptr,
    quad_next: Ptr,
    gc_free_cnt: usize,
    e_queue: Queue,
    k_queue: Queue,
}

impl Core {
    pub fn new() -> Core {
        let mut quad_mem = [
            Quad::new(UNDEF, UNDEF, UNDEF, UNDEF);
            QUAD_MAX
        ];
        quad_mem[UNDEF.addr()]      = Quad::new(LITERAL_T,  UNDEF,      UNDEF,      UNDEF);
        quad_mem[NIL.addr()]        = Quad::new(LITERAL_T,  UNDEF,      UNDEF,      UNDEF);
        quad_mem[FALSE.addr()]      = Quad::new(LITERAL_T,  UNDEF,      UNDEF,      UNDEF);
        quad_mem[TRUE.addr()]       = Quad::new(LITERAL_T,  UNDEF,      UNDEF,      UNDEF);
        quad_mem[UNIT.addr()]       = Quad::new(LITERAL_T,  UNDEF,      UNDEF,      UNDEF);
        quad_mem[TYPE_T.addr()]     = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[EVENT_T.addr()]    = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[OPCODE_T.addr()]   = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[ACTOR_T.addr()]    = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[FIXNUM_T.addr()]   = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[SYMBOL_T.addr()]   = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[PAIR_T.addr()]     = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[FEXPR_T.addr()]    = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        quad_mem[FREE_T.addr()]     = Quad::new(TYPE_T,     UNDEF,      UNDEF,      UNDEF);
        Core {
            quad_mem,
            quad_top: START.ptr(),
            quad_next: NIL.ptr(),
            gc_free_cnt: 0,
            e_queue: Queue::init(START.ptr(), START.ptr()),
            k_queue: Queue::new(),
        }
    }
    pub fn in_heap(&self, val: Val) -> bool {
        let raw = val.raw();
        (raw < self.quad_top.raw()) && (raw >= START.raw())
    }
    pub fn addr(&self, ptr: Ptr) -> Option<usize> {
        let addr = ptr.addr();
        if addr < self.quad_top.addr() {
            Some(addr)
        } else {
            None
        }
    }
    pub fn quad(&self, ptr: Ptr) -> &Quad {
        let addr = self.addr(ptr).unwrap();
        &self.quad_mem[addr]
    }
    pub fn quad_mut(&mut self, ptr: Ptr) -> &mut Quad {
        assert!(self.in_heap(ptr.val()));
        let addr = self.addr(ptr).unwrap();
        &mut self.quad_mem[addr]
    }
    pub fn typeq(&self, typ: Val, val: Val) -> bool {
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
    pub fn alloc(&mut self, t: Val, x: Val, y: Val, z: Val) -> Ptr {
        let mut ptr = self.quad_next;
        if self.typeq(FREE_T, ptr.val()) {
            assert!(self.gc_free_cnt > 0);
            self.gc_free_cnt -= 1;
            self.quad_next = self.quad(ptr).z().ptr();
        } else if self.quad_top.addr() < QUAD_MAX {
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
    pub fn free(&mut self, ptr: Ptr) {
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
        self.gc_free_cnt += 1;
    }
    pub fn cons(&mut self, car: Val, cdr: Val) -> Ptr {
        self.alloc(PAIR_T, car, cdr, UNDEF)
    }
    pub fn car(&self, cons: Ptr) -> Val {
        let quad = self.quad(cons);
        if quad.t() == PAIR_T { quad.x() } else { UNDEF }
    }
    pub fn cdr(&self, cons: Ptr) -> Val {
        let quad = self.quad(cons);
        if quad.t() == PAIR_T { quad.y() } else { UNDEF }
    }
    pub fn set_car(&mut self, cons: Ptr, car: Val) {
        let quad = self.quad_mut(cons);
        assert!(quad.t() == PAIR_T);
        quad.set_x(car);
    }
    pub fn set_cdr(&mut self, cons: Ptr, cdr: Val) {
        let quad = self.quad_mut(cons);
        assert!(quad.t() == PAIR_T);
        quad.set_y(cdr);
    }
    pub fn new_event(&mut self, target: Cap, message: Val) -> Ptr {
        self.alloc(EVENT_T, target.val(), message, NIL)
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

pub const UNDEF: Val    = Val { raw: 0 }; //Val::new(0); -- const generic issue...
pub const NIL: Val      = Val { raw: 1 };
pub const FALSE: Val    = Val { raw: 2 };
pub const TRUE: Val     = Val { raw: 3 };
pub const UNIT: Val     = Val { raw: 4 };

pub const LITERAL_T: Val= Val { raw: 0 }; //Val::new(0);
pub const TYPE_T: Val   = Val { raw: 5 };
pub const EVENT_T: Val  = Val { raw: 6 };
pub const OPCODE_T: Val = Val { raw: 7 };
pub const ACTOR_T: Val  = Val { raw: 8 };
pub const FIXNUM_T: Val = Val { raw: 9 };
pub const SYMBOL_T: Val = Val { raw: 10 };
pub const PAIR_T: Val   = Val { raw: 11 };
pub const FEXPR_T: Val  = Val { raw: 12 };
pub const FREE_T: Val   = Val { raw: 13 };

pub const START: Val    = Val { raw: 14 };

const MSK_RAW: Raw      = 0xC000_0000;
const DIR_RAW: Raw      = 0x8000_0000;
const OPQ_RAW: Raw      = 0x4000_0000;

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
    pub fn val(self) -> Val {  // NOTE: consumes `self`
        Val::new(self.num as Raw | DIR_RAW)
    }
    pub fn num(&self) -> Num {
        self.num
    }
}

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
