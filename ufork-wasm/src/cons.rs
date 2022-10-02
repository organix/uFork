// cons-cell memory manager

const NIL: usize = 0;

const MEM_MAX: usize = 1<<10;  // 1K cons-cells

pub struct Cons {
    mem: [Typed; MEM_MAX],
    mem_top: usize,
    mem_free: usize,
}

impl Cons {
    pub fn new() -> Cons {
        let mut mem = [
            Typed::Empty;
            MEM_MAX
        ];
        mem[0] = Typed::Nil;

        Cons {
            mem,
            mem_top: 1,
            mem_free: NIL,
        }
    }

    pub fn new_deque(&mut self) -> usize {
        let deque = Typed::Deque { first: NIL, last: NIL };
        self.alloc(&deque)
    }
    /*
    pub fn deque_put(&mut self, deque: usize, item: usize) {
        let typed = self.typed_mut(deque);
        match typed {
            Typed::Deque{ first, last } => {
                let pair = self.cons(item, *last);
                if *first == NIL {
                    *first = pair;
                }
                *last = pair;
            },
            _ => panic!("Deque expected at {}, found {:?}", deque, typed),
        }
    }
    */
    pub fn deque_put(&mut self, deque: usize, item: usize) {
        let typed = *self.typed(deque);
        match typed {
            Typed::Deque{ first, last } => {
                let pair = self.cons(item, NIL);  // allocate item-holder
                match *self.typed(last) {
                    Typed::Pair { car, .. } => {
                        *self.typed_mut(last) = Typed::Pair { car: car, cdr: pair };
                        *self.typed_mut(deque) = Typed::Deque { first: first, last: pair };
                    },
                    _ => {
                        *self.typed_mut(deque) = Typed::Deque { first: pair, last: pair };
                    },
                }
            },
            _ => panic!("Deque expected at {}, found {:?}", deque, typed),
        }
    }
    /*
    pub fn deque_take(&mut self, deque: usize) -> usize {
        let typed = self.typed_mut(deque);
        match typed {
            Typed::Deque{ first, last } => {
                let addr = *first;
                let pair = self.typed(addr);
                let item = match pair {
                    Typed::Pair { car, cdr } => {
                        *first = *cdr;
                        self.free(addr);  // free item-holder
                        *car
                    },
                    _ => NIL,
                };
                if *first == NIL {
                    *last = NIL;
                }
                item
            },
            _ => panic!("Deque expected at {}, found {:?}", deque, typed),
        }
    }
    */
    pub fn deque_take(&mut self, deque: usize) -> usize {
        let typed = *self.typed(deque);
        match typed {
            Typed::Deque{ first, last } => {
                let pair = *self.typed(first);
                let item = match pair {
                    Typed::Pair { car, cdr } => {
                        let last_ = if cdr == NIL { NIL } else { last };
                        *self.typed_mut(deque) = Typed::Deque { first: cdr, last: last_ };
                        self.free(first);  // free item-holder
                        car
                    },
                    _ => {
                        NIL
                    },
                };
                item
            },
            _ => panic!("Deque expected at {}, found {:?}", deque, typed),
        }
    }

    pub fn cons(&mut self, car: usize, cdr: usize) -> usize {
        let pair = Typed::Pair{ car: car, cdr: cdr };
        self.alloc(&pair)
    }
    pub fn car(&self, addr: usize) -> usize {
        let typed = self.typed(addr);
        match typed {
            Typed::Pair{ car: val, .. } => *val,
            _ => NIL,
        }
    }
    pub fn cdr(&self, addr: usize) -> usize {
        let typed = self.typed(addr);
        match typed {
            Typed::Pair{ cdr: val, .. } => *val,
            _ => NIL,
        }
    }

    pub fn fixnum(&mut self, num: isize) -> usize {
        let fix = Typed::Fixnum { num: num };
        self.alloc(&fix)
    }

    pub fn alloc(&mut self, init: &Typed) -> usize {
        let mut addr = self.mem_free();
        let typed = self.typed(addr);
        match typed {
            Typed::Free { next } => {
                // use quad from free-list
                self.mem_free = *next;
            },
            _ => {
                // expand top-of-memory
                addr = self.mem_top();
                if addr < MEM_MAX {
                    self.mem_top = addr + 1;
                } else {
                    panic!("out of memory!");
                }
            },
        }
        *self.typed_mut(addr) = *init;
        addr
    }
    /*
    pub fn free(&mut self, addr: usize) {
        let typed = self.typed_mut(addr);
        match typed {
            Typed::Free { .. } => {
                panic!("double-free {}", addr);
            },
            _ => {
                let next = self.mem_free();
                let init = Typed::Free { next: next };
                *typed = init;
                self.mem_free = addr;
            }
        }
    }
    */
    pub fn free(&mut self, addr: usize) {
        assert!(self.in_heap(addr));
        if let Typed::Free { .. } = self.typed(addr) {
            panic!("double-free {}", addr);
        }
        let next = self.mem_free();
        let init = Typed::Free{ next: next };
        *self.typed_mut(addr) = init;
        self.mem_free = addr;
    }

    pub fn mem_top(&self) -> usize {
        self.mem_top
    }
    fn mem_free(&self) -> usize {
        self.mem_free
    }
    pub fn in_heap(&self, addr: usize) -> bool {
        (addr < self.mem_top()) && (addr > 0)
    }

    pub fn typed(&self, addr: usize) -> &Typed {
        &self.mem[addr]
    }
    pub fn typed_mut(&mut self, addr: usize) -> &mut Typed {
        assert!(self.in_heap(addr));
        &mut self.mem[addr]
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Typed {
    Empty,
    Nil,
    Pair { car: usize, cdr: usize },
    Fixnum { num: isize },
    Deque { first: usize, last: usize },
    Free { next: usize },
}

/*
 * Unit test suite
 */

 //#[cfg(test)] -- use this if/when the tests are in a sub-module
#[test]
fn enum_variant_discriminator_occupies_zero_memory() {
    println!("size_of::<Typed> = {}", std::mem::size_of::<Typed>());
    assert_eq!(2 * std::mem::size_of::<usize>(), std::mem::size_of::<Typed>());
}

#[test]
fn basic_memory_allocation() {
    let mut core = Cons::new();
    println!("mem_free: {} -> {:?}", core.mem_free(), core.typed(core.mem_free()));
    println!("mem_top: {}", core.mem_top());
    let top_before = core.mem_top();
    let m1 = core.fixnum(-42);
    println!("m1:{} -> {:?}", m1, core.typed(m1));
    println!("mem_top: {}", core.mem_top());
    let m2 = core.cons(NIL, NIL);
    println!("m2:{} -> {:?}", m2, core.typed(m2));
    println!("mem_top: {}", core.mem_top());
    let m3 = core.cons(NIL, NIL);
    println!("mem_top: {}", core.mem_top());
    println!("mem_free: {} -> {:?}", core.mem_free(), core.typed(core.mem_free()));
    core.free(m2);
    println!("mem_free: {} -> {:?}", core.mem_free(), core.typed(core.mem_free()));
    core.free(m3);
    println!("mem_free: {} -> {:?}", core.mem_free(), core.typed(core.mem_free()));
    let _m4 = core.cons(m1, m1);
    println!("mem_top: {}", core.mem_top());
    println!("mem_free: {} -> {:?}", core.mem_free(), core.typed(core.mem_free()));
    let top_after = core.mem_top();
    assert_eq!(3, top_after - top_before);
    assert!(false);  // force output to be displayed
}

#[test]
fn basic_deque_operations() {
    let mut core = Cons::new();
    let deque = core.new_deque();
    println!("deque:{} -> {:?}", deque, core.typed(deque));
    assert_eq!(NIL, core.deque_take(deque));
    println!("deque:{} -> {:?}", deque, core.typed(deque));
    let v1 = core.fixnum(1);
    println!("v1:{} -> {:?}", v1, core.typed(v1));
    core.deque_put(deque, v1);
    println!("deque:{} -> {:?}", deque, core.typed(deque));
    let v2 = core.fixnum(2);
    println!("v2:{} -> {:?}", v2, core.typed(v2));
    core.deque_put(deque, v2);
    println!("deque:{} -> {:?}", deque, core.typed(deque));
    let n1 = core.deque_take(deque);
    println!("n1:{} -> {:?}", n1, core.typed(n1));
    println!("deque:{} -> {:?}", deque, core.typed(deque));
    assert_eq!(v1, n1);
    let v3 = core.fixnum(3);
    println!("v3:{} -> {:?}", v3, core.typed(v3));
    core.deque_put(deque, v3);
    println!("deque:{} -> {:?}", deque, core.typed(deque));
    let n2 = core.deque_take(deque);
    println!("n2:{} -> {:?}", n2, core.typed(n2));
    println!("deque:{} -> {:?}", deque, core.typed(deque));
    assert_eq!(v2, n2);
    let n3 = core.deque_take(deque);
    println!("n3:{} -> {:?}", n3, core.typed(n3));
    println!("deque:{} -> {:?}", deque, core.typed(deque));
    assert_eq!(v3, n3);
    assert_eq!(NIL, core.deque_take(deque));
    println!("deque:{} -> {:?}", deque, core.typed(deque));
    //assert!(false);  // force output to be displayed
}
