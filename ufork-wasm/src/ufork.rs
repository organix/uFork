// uFork virtual CPU

use core::fmt;

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
        let start = START.raw();
        let a_boot = capval(start+1);
        let ip_boot = ptrval(start+2);
        let vm_end = fixnum(22);
        let end_stop = fixnum(0);
        quad_mem[START.addr()]      = Quad::new(EVENT_T,    a_boot,     NIL,        NIL  );
        quad_mem[START.addr()+1]    = Quad::new(ACTOR_T,    ip_boot,    NIL,        UNDEF);
        quad_mem[START.addr()+2]    = Quad::new(OPCODE_T,   vm_end,     end_stop,   UNDEF);

        Core {
            quad_mem,
            quad_top: Ptr::new(start+3),
            quad_next: NIL.ptr(),
            gc_free_cnt: 0,
            e_queue: Queue::init(START.ptr(), START.ptr()),
            k_queue: Queue::new(),
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
    fn check_for_interrupt(&mut self) -> bool {
        false
    }
    fn dispatch_event(&mut self) -> bool {
        println!("dispatch_event: head={}", self.e_queue.peek());
        if self.e_queue.empty(self) {
            return false;  // event queue is empty
        }
        let ep = self.e_queue.take(self);
        let event = self.quad(ep);
        println!("dispatch_event: event={} -> {}", ep, event);
        let target = event.x().cap();
        let actor = self.quad_mut(Ptr::new(target.raw()));  // WARNING: converting Cap to Ptr!
        if actor.z() != UNDEF {
            self.e_queue.put(self, ep);
            return false;  // target actor is busy
        }
        actor.set_z(NIL);  // start with empty set of new events
        let ip = actor.x().ptr();
        let sp = actor.y().ptr();
        let cont = self.new_cont(ip, sp, ep);
        println!("dispatch_event: cont={} -> {}", cont, self.quad(cont));
        self.k_queue.put(self, cont);
        true  // event dispatched
    }
    fn execute_instruction(&mut self) -> bool {
        println!("execute_instruction: head={}", self.k_queue.peek());
        if self.k_queue.empty(self) {
            return false;  // continuation queue is empty
        }
        let cont = self.k_queue.take(self);
        println!("execute_instruction: cont={} -> {}", cont, self.quad(cont));
        true  // instruction executed
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

    pub fn new_event(&mut self, target: Cap, message: Val) -> Ptr {
        // FIXME: add sanity-checks...
        self.alloc(EVENT_T, target.val(), message, NIL)
    }
    pub fn new_cont(&mut self, ip: Ptr, sp: Ptr, ep: Ptr) -> Ptr {
        // FIXME: add sanity-checks...
        self.alloc(ip.val(), sp.val(), ep.val(), NIL)
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
impl fmt::Display for Quad {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{{t:{}, x:{}, y:{}, z:{}}}", self.t, self.x, self.y, self.z)
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
impl fmt::Display for Val {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = if (self.raw & DIR_RAW) != 0 {
            self.fix().to_string()
        } else if (self.raw & OPQ_RAW) != 0 {
            self.cap().to_string()
        } else {
            self.ptr().to_string()
        };
        write!(f, "{}", s)
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
impl fmt::Display for Fix {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:+}", self.num)
    }
}

fn fixnum(num: Num) -> Val { Fix::new(num).val() }  // convenience constructor

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
impl fmt::Display for Ptr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "^{}", self.raw)
    }
}

fn ptrval(raw: Raw) -> Val { Ptr::new(raw).val() }  // convenience constructor

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
impl fmt::Display for Cap {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "@{}", self.raw)
    }
}

fn capval(raw: Raw) -> Val { Cap::new(raw).val() }  // convenience constructor

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

#[test]
fn core_initialization() {
    let core = Core::new();
    assert_eq!(0, core.gc_free_cnt);
    assert_eq!(NIL.ptr(), core.quad_next);
    assert!(!core.e_queue.empty(&core));
    assert!(core.k_queue.empty(&core));
    for raw in 0..core.quad_top.raw() {
        println!("{:5}: {}", raw, core.quad(Ptr::new(raw)));
    }
    //assert!(false);  // force output to be displayed
}

#[test]
fn basic_memory_allocation() {
    let mut core = Core::new();
    let top_before = core.quad_top.raw();
    println!("quad_top: {}", core.quad_top);
    let m1 = core.alloc(FEXPR_T, fixnum(1), fixnum(1), fixnum(1));
    println!("m1:{} -> {}", m1, core.quad(m1));
    println!("quad_top: {}", core.quad_top);
    let m2 = core.alloc(FEXPR_T, fixnum(2), fixnum(2), fixnum(2));
    println!("quad_top: {}", core.quad_top);
    let m3 = core.alloc(FEXPR_T, fixnum(3), fixnum(3), fixnum(3));
    println!("quad_top: {}", core.quad_top);
    println!("gc_free_cnt: {}", core.gc_free_cnt);
    core.free(m2);
    println!("gc_free_cnt: {}", core.gc_free_cnt);
    core.free(m3);
    println!("gc_free_cnt: {}", core.gc_free_cnt);
    let _m4 = core.alloc(FEXPR_T, fixnum(4), fixnum(4), fixnum(4));
    println!("quad_top: {}", core.quad_top);
    println!("gc_free_cnt: {}", core.gc_free_cnt);
    let top_after = core.quad_top.raw();
    assert_eq!(3, top_after - top_before);
    assert_eq!(1, core.gc_free_cnt);
    println!("quad_next: {}", core.quad_next);
    println!("quad_next-> {}", core.quad(core.quad_next));
    //assert!(false);  // force output to be displayed
}

#[test]
fn run_loop_terminates() {
    let mut core = Core::new();
    core.run_loop();
}
