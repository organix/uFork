/*
#![no_std]
use core::panic::PanicInfo;
#[cfg(target_arch = "wasm32")]
use core::arch::wasm32::unreachable;
#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    unreachable()
}
*/

pub mod ufork;
pub mod device;

// FIXME: `use js_sys;` instead?
extern crate js_sys;
extern crate web_sys;

use wasm_bindgen::prelude::*;
use std::fmt;

use crate::ufork::*;

// A macro to provide `println!(..)`-style syntax for `console.log` logging.
macro_rules! log {
    ( $( $t:tt )* ) => {
        web_sys::console::log_1(&format!( $( $t )* ).into());
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern {
    fn alert(s: &str);
}
#[cfg(not(target_arch = "wasm32"))]
pub fn alert(s: &str) {
    println!("alert: {}", s);
}

#[wasm_bindgen]
pub fn greet(name: &str) {
    alert(&format!("Hello, {}!", name));
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(module = "/ufork.js")]
extern {
    fn raw_clock() -> Raw;
}

#[wasm_bindgen]
pub struct Host {
    core: Core,
}

impl fmt::Display for Host {
    fn fmt(&self, fmt: &mut fmt::Formatter) -> fmt::Result {
        //let core = &self.core;
        for raw in 0..512 {
            /*
            let typed = core.typed(Ptr::new(raw));
            write!(fmt, "{:5}: {}\n", raw, typed)?;
            */
            //write!(fmt, "{}\n", self.display(raw))?;
            write!(fmt, "{:5}: {}\n", raw, self.display(raw))?;
        }
        /*
        write!(fmt, "\n")?;
        write!(fmt, "IP:{} -> {}\n", core.ip(), core.typed(core.ip()))?;
        write!(fmt, "SP:{} -> {}\n", core.sp(), core.typed(core.sp()))?;
        write!(fmt, "EP:{} -> {}\n", core.ep(), core.typed(core.ep()))?;
        */
        Ok(())
    }
}

/// Public methods, exported to JavaScript.
#[wasm_bindgen]
impl Host {
    pub fn new() -> Host {
        let core = Core::new();
        Host {
            core,
        }
    }
    pub fn step(&mut self) -> bool {  // single-step instruction execution
        match self.core.execute_instruction() {
            Ok(more) => {
                if !more && !self.core.e_first().is_ram() {  // EQ must also be empty.
                    log!("continuation queue empty!");
                    return false;  // no more instructions...
                }
            },
            Err(error) => {
                log!("execution ERROR! {}", error);
                return false;  // execute instruction failed...
            },
        }
        if let Err(error) = self.core.check_for_interrupt() {
            log!("interrupt ERROR! {}", error);
            return false;  // interrupt handler failed...
        }
        if let Err(error) = self.core.dispatch_event() {
            log!("dispatch ERROR! {}", error);
            return false;  // event dispatch failed...
        }
        true  // step successful
    }

    pub fn fixnum(&self, num: Num) -> Raw { Any::fix(num as isize).raw() }
    pub fn rom_addr(&self, ofs: Raw) -> Raw { Any::rom(ofs as usize).raw() }
    pub fn ram_addr(&self, bank: Raw, ofs: Raw) -> Raw { Any::ram(bank, ofs as usize).raw() }
    pub fn gc_phase(&self) -> Raw { self.core.gc_phase() }
    pub fn gc_run(&mut self) { self.core.gc_stop_the_world() }
    pub fn sponsor_memory(&self) -> Raw {
        let ep = self.core.ep();
        let sponsor = self.core.event_sponsor(ep);
        self.core.sponsor_memory(sponsor).raw()
    }
    pub fn sponsor_events(&self) -> Raw {
        let ep = self.core.ep();
        let sponsor = self.core.event_sponsor(ep);
        self.core.sponsor_events(sponsor).raw()
    }
    pub fn sponsor_instrs(&self) -> Raw {
        let ep = self.core.ep();
        let sponsor = self.core.event_sponsor(ep);
        self.core.sponsor_instrs(sponsor).raw()
    }
    pub fn mem_top(&self) -> Raw { self.core.mem_top().raw() }
    pub fn mem_next(&self) -> Raw { self.core.mem_next().raw() }
    pub fn mem_free(&self) -> Raw { self.core.mem_free().raw() }
    pub fn mem_root(&self) -> Raw { self.core.mem_root().raw() }
    pub fn equeue(&self) -> Raw { self.core.e_first().raw() }
    pub fn kqueue(&self) -> Raw { self.core.k_first().raw() }
    pub fn ip(&self) -> Raw { self.core.ip().raw() }
    pub fn sp(&self) -> Raw { self.core.sp().raw() }
    pub fn ep(&self) -> Raw { self.core.ep().raw() }
    pub fn e_self(&self) -> Raw { self.core.self_ptr().raw() }
    pub fn e_msg(&self) -> Raw {
        let ep = self.core.ep();
        if !ep.is_ram() { return UNDEF.raw() }
        let event = self.core.ram(ep);
        event.y().raw()
    }
    pub fn in_mem(&self, v: Raw) -> bool {  // excludes built-in constants and types
        (v > FREE_T.raw()) && !Any::new(v).is_fix()
    }
    pub fn is_dict(&self, v: Raw) -> bool {
        self.core.typeq(DICT_T, Any::new(v))
    }
    pub fn is_pair(&self, v: Raw) -> bool {
        self.core.typeq(PAIR_T, Any::new(v))
    }
    pub fn car(&self, p: Raw) -> Raw {
        if self.is_pair(p) {
            self.core.car(Any::new(p)).raw()
        } else {
            UNDEF.raw()
        }
    }
    pub fn cdr(&self, p: Raw) -> Raw {
        if self.is_pair(p) {
            self.core.cdr(Any::new(p)).raw()
        } else {
            UNDEF.raw()
        }
    }
    pub fn next(&self, p: Raw) -> Raw {
        self.core.next(Any::new(p)).raw()
    }

    pub fn pprint(&self, raw: Raw) -> String {
        if self.is_pair(raw) {
            let mut s = String::new();
            let mut p = raw;
            let mut sep = "(";
            while self.is_pair(p) {
                s.push_str(sep);
                let ss = self.pprint(self.car(p));
                s.push_str(ss.as_str());
                sep = " ";
                p = self.cdr(p);
            }
            if NIL.raw() != p {
                s.push_str(" . ");
                let ss = self.pprint(p);
                s.push_str(ss.as_str());
            }
            s.push_str(")");
            s
        } else if self.is_dict(raw) {
            let mut s = String::new();
            let mut p = raw;
            let mut sep = "{";
            while self.is_dict(p) {
                let entry = self.core.mem(Any::new(p));
                let key = entry.x();
                let value = entry.y();
                let next = entry.z();
                s.push_str(sep);
                /*
                s.push_str(self.disasm(p).as_str());
                */
                s.push_str(self.print(key.raw()).as_str());
                s.push_str(":");
                s.push_str(self.pprint(value.raw()).as_str());
                sep = ", ";
                p = next.raw();
            }
            s.push_str("}");
            s
        } else {
            self.print(raw)
        }
    }
    pub fn display(&self, raw: Raw) -> String {
        let mut s = String::new();
        let ss = self.print(raw);
        s.push_str(ss.as_str());
        let val = Any::new(raw);
        if val.is_ptr() {
            if raw < self.mem_top() {
                s.push_str(" → ");
            } else {
                s.push_str(" × ");
            }
            let ss = self.disasm(raw);
            s.push_str(ss.as_str());
        }
        s
    }
    pub fn disasm(&self, raw: Raw) -> String {
        let val = Any::new(raw);
        if val.is_ptr() {
            let quad = self.core.mem(val);
            /*
            if let Some(typed) = Typed::from(quad) {
                typed.to_string()
            } else {
                quad.to_string()
            }
            */
            quad.to_string()
        } else {
            self.print(raw)
        }
    }
    pub fn print(&self, raw: Raw) -> String {
        Any::new(raw).to_string()
    }

    pub fn render(&self) -> String {
        self.to_string()
    }
}

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cell {
    Dead = 0,
    Live = 1,
}

impl Cell {
    fn toggle(&mut self) {
        *self = match *self {
            Cell::Dead => Cell::Live,
            Cell::Live => Cell::Dead,
        };
    }
}

type Value = usize;  // univeral value type
//type Value = i32;  // univeral value type

#[wasm_bindgen]
pub struct Universe {
    width: Value,
    height: Value,
    cells: Vec<Cell>,
}

impl fmt::Display for Universe {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        for line in self.cells.as_slice().chunks(self.width) {
            for &cell in line {
                let symbol = if cell == Cell::Dead { '◻' } else { '◼' };
                write!(f, "{}", symbol)?;
            }
            write!(f, "\n")?;
        }

        Ok(())
    }
}

impl Universe {
    fn get_index(&self, row: Value, column: Value) -> Value {
        row * self.width + column
    }

    /// Get the dead and alive values of the entire universe.
    pub fn get_cells(&self) -> &[Cell] {
        &self.cells
    }

    /// Set cells to be alive in a universe
    /// by passing the row and column of each cell as an array.
    pub fn set_cells(&mut self, cells: &[(Value, Value)]) {
        for (row, col) in cells.iter().cloned() {
            let idx = self.get_index(row, col);
            self.cells[idx] = Cell::Live;
        }
    }

    fn live_neighbor_count(&self, row: Value, column: Value) -> u8 {
        let mut count = 0;
        for delta_row in [self.height - 1, 0, 1].iter().cloned() {
            for delta_col in [self.width - 1, 0, 1].iter().cloned() {
                if delta_row == 0 && delta_col == 0 {
                    continue;
                }

                let neighbor_row = (row + delta_row) % self.height;
                let neighbor_col = (column + delta_col) % self.width;
                let idx = self.get_index(neighbor_row, neighbor_col);
                count += self.cells[idx] as u8;
            }
        }
        count
    }
}

/// Public methods, exported to JavaScript.
#[wasm_bindgen]
impl Universe {
    pub fn new(width: Value, height: Value) -> Universe {
        //utils::set_panic_hook();  // log panic messages to browser console

        let cells = (0..width * height).map(|_i| Cell::Dead).collect();

        log!("creating new {}x{} Universe", width, height);
        //log!("Value occupies {} bytes", core::mem::size_of_val(&width));

        Universe {
            width,
            height,
            cells,
        }
    }

    pub fn width(&self) -> Value {
        self.width
    }

    pub fn height(&self) -> Value {
        self.height
    }

    pub fn cells(&self) -> *const Cell {
        self.cells.as_ptr()
    }

    pub fn render(&self) -> String {
        self.to_string()
    }

    pub fn toggle_cell(&mut self, row: Value, column: Value) {
        let idx = self.get_index(row, column);
        self.cells[idx].toggle();
    }

    pub fn clear_grid(&mut self) {
        log!("clear_grid {}x{}", self.width, self.height);
        self.cells = (0..self.width * self.height)
            .map(|_i| Cell::Dead)
            .collect();
    }

    pub fn launch_ship(&mut self) {
        let ship = [(1,2), (2,3), (3,1), (3,2), (3,3)];
        log!("launch_ship {:?}", &ship);
        self.set_cells(&ship);
    }

    pub fn r_pentomino(&mut self) {
        let shape = [(1,2), (1,3), (2,1), (2,2), (3,2)];
        log!("r_pentomino {:?}", &shape);
        self.set_cells(&shape);
    }

    pub fn plant_acorn(&mut self) {
        let shape = [(1,2), (2,4), (3,1), (3,2), (3,5), (3,6), (3,7)];
        log!("plant_acorn {:?}", &shape);
        self.set_cells(&shape);
    }

    pub fn gosper_gun(&mut self) {
        let shape = [(5,1), (5,2), (6,1), (6,2),
            (3,13), (3,14), (4,12), (5,11), (6,11), (7,11), (8,12), (9,13), (9,14),
            (4,16), (5,17), (6,15), (6,17), (6,18), (7,17), (8,16),
            (3,21), (3,22), (4,21), (4,22), (5,21), (5,22),
            (1,25), (2,23), (2,25), (6,23), (6,25), (7,25),
            (3,35), (3,36), (4,35), (4,36)];
        log!("gosper_gun {:?}", &shape);
        self.set_cells(&shape);
    }

    pub fn pattern_fill(&mut self) {
        log!("pattern_fill {}x{}", self.width, self.height);
        self.cells = (0..self.width * self.height)
            .map(|i| {
                if i % 2 == 0 || i % 7 == 0 {
                    Cell::Live
                } else {
                    Cell::Dead
                }
            })
            .collect();
    }

    pub fn random_fill(&mut self) {
        log!("random_fill {}x{}", self.width, self.height);
        self.cells = (0..self.width * self.height)
            .map(|_i| {
                if js_sys::Math::random() < 0.375 {
                    Cell::Live
                } else {
                    Cell::Dead
                }
            })
            .collect();
    }

    pub fn tick(&mut self) {
        let mut next = self.cells.clone();

        for row in 0..self.height {
            for col in 0..self.width {
                let idx = self.get_index(row, col);
                let cell = self.cells[idx];
                let live_neighbors = self.live_neighbor_count(row, col);

                let next_cell = match (cell, live_neighbors) {
                    // Rule 1:  Any live cell with fewer than two live neighbours
                    //          dies, as if caused by underpopulation.
                    (Cell::Live, x) if x < 2 => Cell::Dead,
                    // Rule 2:  Any live cell with two or three live neighbours
                    //          lives on to the next generation.
                    (Cell::Live, 2) | (Cell::Live, 3) => Cell::Live,
                    // Rule 3:  Any live cell with more than three live
                    //          neighbours dies, as if by overpopulation.
                    (Cell::Live, x) if x > 3 => Cell::Dead,
                    // Rule 4:  Any dead cell with exactly three live neighbours
                    //          becomes a live cell, as if by reproduction.
                    (Cell::Dead, 3) => Cell::Live,
                    // All other cells remain in the same state.
                    (otherwise, _) => otherwise,
                };

                next[idx] = next_cell;
            }
        }

        self.cells = next;
    }
}
