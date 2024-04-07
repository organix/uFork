// @ts-check js
/**
 * @use JSDoc
 * @overview Here the various instruction sets that ucode can run on defined
 * @author Zarutian
 */

import { makePromise } from "../util/util_funcs.js";
  
export const defineInstructionset = (asm, opts = { instrsetName: "uFork_SM2.1" }) => {
  const { def, isDefined } = asm;
  if (opts.instrsetName.startsWith("FCPU-16")) {
    def("instrset_FCPU-16", 1);
  }
  if (opts.instrsetName.startsWith("uFork_CSM1")) {
    def("instrset_uFork_CSM1", 1);
  }
  if (opts.instrsetName.startsWith("uFork_SM2 ")) {
    def("instrset_uFork_SM2", 1);
  }
  if (opts.instrsetName.startsWith("uFork_SM2.1")) {
    def("instrset_uFork_SM2.1", 1);
  }
  if (opts.instrsetName.includes("w/qmem")) {
    def("instrset_w/qmem", 1);
  }
  if (opts.instrsetName.includes("w/hwgc")) {
    def("instrset_w/hwgc", 1);
  }
  if (opts.instrsetName.includes("w/debug_io")) {
    def("instrset_w/debug_io", 1);
  }
  if (isDefined("instrset_FCPU-16") ||
      isDefined("instrset_uFork_CSM1")) {
    def("NOP",    0x0000);
    if (isDefined("instrset_FCPU-16")) {
      def("UMPLUS", 0x0001);
      def("UM+", "UMPLUS");
    } else if (isDefined("instrset_uFork_CSM1")) {
      def("PLUS",   0x0001);
      def("+",   "PLUS");
    }
    def("AND",    0x0002);
    def("XOR",    0x0003);
    def("1LBR",   0x0004);
    def("INCR",   0x0005);
    def("FETCH",  0x0006);
    def("STORE",  0x0007);
    def("DUP",    0x0008);
    def("DROP",   0x0009);
    def("SWAP",   0x000A);
    def("SKZ",    0x000B);
    def("TO_R",   0x000C);
    def("R_FROM", 0x000D);
    def("EXT",    0x000E);
    def("EXIT",   0x000F);

    def("&",   "AND");
    def("⊕",   "XOR");
    def("1+",  "INCR");
    def("@",   "FETCH");
    def("!",   "STORE");
    def(">R",  "TO_R");
    def("R>",  "R_FROM");
  }
  if (isDefined("instrset_w/qmem") && 
      (isDefined("instrset_FCPU-16") || isDefined("instrset_uFork_CSM1"))
  ) {
    def("QUAD_T_FETCH", 0x0010);
    def("QUAD_X_FETCH", 0x0011);
    def("QUAD_Y_FETCH", 0x0012);
    def("QUAD_Z_FETCH", 0x0013);
    def("QUAD_T_STORE", 0x0014);
    def("QUAD_X_STORE", 0x0015);
    def("QUAD_Y_STORE", 0x0016);
    def("QUAD_Z_STORE", 0x0017);

    def("qt@", "QUAD_T_FETCH");
    def("qx@", "QUAD_X_FETCH");
    def("qy@", "QUAD_Y_FETCH");
    def("qz@", "QUAD_Z_FETCH");
    def("qt!", "QUAD_T_STORE");
    def("qx!", "QUAD_X_STORE");
    def("qy!", "QUAD_Y_STORE");
    def("qz!", "QUAD_Z_STORE");
  }
  if (isDefined("instrset_w/qmem") && isDefined("instrset_w/hwgc") &&
      (isDefined("instrset_FCPU-16") || isDefined("instrset_uFork_CSM1"))
  ) {
    def("QUAD_ALLOCATE", 0x0018);
    def("QUAD_FREE",    0x0019);
    def("QUAD_GCSTEP",  0x001A);
    def("QUAD_ISFULL",  0x001B);

    def("qallot",  "QUAD_ALLOCATE");
    def("qfree",   "QUAD_FREE");
    def("qgcstep", "QUAD_GCSTEP");
    def("qfull?",  "QUAD_ISFULL");
  }
  if (isDefined("instrset_w/debug_io") &&
      (isDefined("instrset_FCPU-16") || isDefined("instrset_uFork_CSM1"))
  ) {
    def("DEBUG_LED",    0x003B); // led! ( colour -- )
    def("DEBUG_RX?",    0x003C); // rx? ( -- ready )
    def("DEBUG_RX@",    0x003D); // rx@ ( -- char )
    def("DEBUG_TX?",    0x003E); // tx? ( -- ready )
    def("DEBUG_TX!",    0x003F); // tx! ( char -- )
  }
    
  /* tbd: unlikely to be implemented at all
  fomu spefic
  def("GPIO@",        0x0038); // gpio@ ( -- pins )
  def("GPIO!",        0x0039); // gpio! ( pins -- )
  def("GPIO_config",  0x003A); // gpio_config ( pins_config -- )

  pins:
   [0xF]: gpio pad 4
   [0xE]: gpio pad 3
   [0xD]: gpio pad 2
   [0xC]: gpio pad 1
   [0x7]: usb D-
   [0x6]: usb D+
   [0x5]: usb pull up
   [0x4]: flash busy 
   [0x3]: spi chip select flash
   [0x2]: spi mclk
   [0x1]: spi mosi
   [0x0]: spi miso
  */

  if (opts.instrsetName.startsWith("excamera_J1")) {
    def("instrset_excamera_J1", 1);
    def("(LIT)", (asm) => {
      const here = asm.addr;
      const resolve = ([here_plusone, val]) => {
        Promise.resolve(val).then((real_val) => {
          const tmp = asm.addr;
          asm.undatum(here); // erease placeholder
          asm.origin(here);
          if ((real_val & 0x8000) == 0x8000) {
            asm.datum(0x8000 | (real_val ^ 0xFFFF));
            asm.datum("INVERT");
          } else {
            asm.datum(0x8000 | real_val);
            asm.datum("NOP");
          }
        });
      };
      asm.datum("NOP"); // placeholder put in
      const gildra = asm.addr;
      asm.datum({ resolve });
      asm.origin(gildra);
      return undefined;
    });
    def("(JMP)", (asm) => {
      const here = asm.addr;
      const resolve = ([here_plustwo, val]) => {
        asm.undatum(here); // erease placeholder
        asm.origin(here);
        asm.datum(asm.deferedOp.or(0x0000, asm.deferedOp.and(0x1FFF, val)));
      };
      asm.datum("NOP"); // placeholder set in
      const gildra = asm.addr;
      asm.datum({ resolve });
      asm.origin(gildra);
      return undefined;
    });
    def("(BRZ)", (asm) => {
      const here = asm.addr;
      const resolve = ([here_plustwo, val]) => {
        asm.undatum(here); // erease placeholder
        asm.origin(here);
        asm.datum(asm.deferedOp.or(0x2000, asm.deferedOp.and(0x1FFF, val)));
      };
      asm.datum("NOP");
      const gildra = asm.addr;
      asm.datum({ resolve });
      asm.origin(gildra);
      return undefined;
    });
    def("NOP",    0x6000);
    def("PLUS",   0x6203);
    def("AND",    0x6303);
    def("OR",     0x6403);
    def("XOR",    0x6503);
    def("INVERT", 0x6603);
    def("EQUAL",  0x6703);
    def("LESSTHAN", 0x6803);
    def("RSHIFT", 0x6903);
    def("DECR",   0x6A00);
    def("LSHIFT", 0x6D03);
    def("DEPTH",  0x6E81);
    def("unsigned_LESSTHAN", 0x6F03);
    def("DUP",    0x6081);
    def("OVER",   0x6181);
    def("SWAP",   0x6180);
    def("NIP",    0x6003);
    def("DROP",   0x6103);
    def("TO_R",   0x6147);
    def("R_FROM", 0x6B4D);
    def("R_AT",   0x6B41);
    def("FETCH",  0x6C00);
    def("STORE",  0x6123);
    def("EXIT",   0x700C);

    def("&",   "AND");
    def("⊕",   "XOR");
    def("@",   "FETCH");
    def("!",   "STORE");
    def(">R",  "TO_R");
    def("R>",  "R_FROM");
    def("R@",  "R_AT");
    def("1-",  "DECR");
    def("<",   "LESSTHAN");
    def("=",   "EQUAL");
    return {
      ...asm,
      def: (sym, val = undefined) => {
        if (val == undefined) {
          const here = asm.addr;
          val = asm.deferedOp.or(0x4000, asm.deferedOp.and(here, 0x1FFF));
        }
        asm.def(sym, val);
      },
    }
  }

  // see uFork/fpga/fomu/csm/cpu.md as reference for uFork_SM2
  if (isDefined("instrset_uFork_SM2")) {
    def("NOP",     0x0000);
    def("PLUS",    0x0B41);
    def("AND",     0x0B44);
    def("XOR",     0x0B45);
    def("1LBR",    0x0307);
    def("INCR",    0x0311);
    def("FETCH",   0x030E);
    def("STORE",   0x094F);
    def("DUP",     0x0200);
    def("DROP",    0x0100);
    def("SWAP",    0x0400);
    // SKZ not implemented in hardware
    def("TO_R",    0x2100);
    def("R_FROM",  0x1280);
    def("R_AT",    0x0280);
    def("EXIT",    0x5000);
    def("MINUS",   0x0B42);
    def("OR",      0x0B46);
    def("DECR",    0x0312);
    def("INVERT",  0x0375);
    def("NEGATE",  0x03C2);
    def("OVER",    0x0500);
    def("ROT",     0x0700);
    def("2DROP",   0x0900);
    def("(FALSE)", 0x02C0);
    def("(TRUE)",  0x02F5);
    def("2*",      0x0301);

    def("+",   "PLUS");
    def("&",   "AND");
    def("⊕",   "XOR");
    def("1+",  "INCR");
    def("@",   "FETCH");
    def("!",   "STORE");
    def(">R",  "TO_R");
    def("R>",  "R_FROM");
    def("R@",  "R_AT");
    def("-",   "MINUS");
    def("1-",  "DECR");

    def("SKZ", (asm) => {
      const here = asm.addr;
      const here_plustwo = asm.deferedOp.plus(here, 2);
      return asm.deferedOp.or(0xA000, asm.deferedOp.and(here_plustwo, 0x0FFF));
    });
    def("(JMP)", (asm) => {
      const here = asm.addr;
      const resolve = ([here_plusone, val]) => {
        asm.undatum(here);
        asm.origin(here);
        asm.datum(asm.deferedOp.or(0x8000, asm.deferedOp.and(val, 0x0FFF)));
      };
      asm.datum("NOP"); // placeholder put in
      const gildra = asm.addr;
      asm.datum({ resolve });
      asm.origin(gildra);
      return undefined;
    });
    def("(BRZ)", (asm) => {
      const here = asm.addr;
      const resolve = ([here_plusone, val]) => {
        asm.undatum(here); // erease placeholder
        asm.origin(here);
        asm.datum(asm.deferedOp.or(0xA000, asm.deferedOp.and(val, 0x0FFF)));
      };
      asm.datum("NOP"); // placeholder put in
      const gildra = asm.addr;
      asm.datum({ resolve });
      asm.origin(gildra);
      return undefined;
    });
    
    return {
      ...asm,
      def: (sym, val = undefined) => {
        if (val == undefined) {
          const here = asm.addr;
          val = asm.deferedOp.or(0xC000, asm.deferedOp.and(here, 0x0FFF));
        }
        asm.def(sym, val);
      },
    }
  }

  if (isDefined("instrset_uFork_SM2.1")) {
    if (!isDefined("instrset_w/qmem")) {
      def("instrset_w/qmem", 1);
    }
    
    def("NOP",     0x0000);
    def("(LIT)",   0x021F);
    def("(CONST)", 0x521F);
    def("EXIT",    0x5000);
    const defineEvaluateInstruction = (sym, val) => {
      // console.log(`furðuvilluaflúsun1: ${sym} = ${val}`);
      def(sym.concat("_"), val);
      def(sym, (asm) => {
        const myval = val;
        const here = asm.addr;
        const resolve = ([here_plusone, val]) => {
          asm.deferedOp.equal(val, "EXIT").then((bool) => {
            if (bool) {
              asm.undatum(here); // erase the previous value 
              asm.origin(here);
              asm.datum(asm.deferedOp.or(myval, "EXIT"));
            } else {
              asm.undatum(here_plusone);
              asm.origin(here_plusone);
              asm.datum(val);
            }
          });
        };
        asm.undatum(asm.addr); // aflúsunaraðstoð
        asm.datum(myval);
        const gildra = asm.addr;
        asm.datum({ resolve });
        asm.origin(gildra);
        return undefined;
      });
      // console.log(`furðuvilluaflúsun2: ${sym} = ${asm.symbols.lookup(sym)}`);
    };
    const defEvalInstr = def; // defineEvaluateInstruction;
    
    defEvalInstr("PLUS",    0x0741);
    defEvalInstr("AND",     0x0744);
    defEvalInstr("XOR",     0x0745);
    defEvalInstr("1LBR",    0x0307);
    defEvalInstr("INCR",    0x0311);
    defEvalInstr("FETCH",   0x030F);
    defEvalInstr("STORE",   0x098F);
    defEvalInstr("DUP",     0x0200);
    defEvalInstr("DROP",    0x0100);
    defEvalInstr("SWAP",    0x0400);
    // SKZ not implemented in hardware
    def("TO_R",    0x2100);
    def("R_FROM",  0x1280);
    def("R_AT",    0x0280);
    defEvalInstr("MINUS",   0x0742);
    defEvalInstr("OR",      0x0746);
    defEvalInstr("DECR",    0x0312);
    defEvalInstr("INVERT",  0x0375);
    defEvalInstr("NEGATE",  0x03C2);
    defEvalInstr("OVER",    0x0240);
    defEvalInstr("ROT",     0x0500);
    defEvalInstr("-ROT",    0x0600);
    defEvalInstr("(FALSE)", 0x02C0);
    defEvalInstr("(TRUE)",  0x02F6);
    defEvalInstr("1",       0x02D6); // LSB
    defEvalInstr("0x8000",  0x02E6); // MSB
    defEvalInstr("2*",      0x0301);

    defEvalInstr("QUAD_T_FETCH", 0x034F);
    defEvalInstr("QUAD_X_FETCH", 0x035F);
    defEvalInstr("QUAD_Y_FETCH", 0x036F);
    defEvalInstr("QUAD_Z_FETCH", 0x037F);
    defEvalInstr("QUAD_T_STORE", 0x09CF);
    defEvalInstr("QUAD_X_STORE", 0x09DF);
    defEvalInstr("QUAD_Y_STORE", 0x09EF);
    defEvalInstr("QUAD_Z_STORE", 0x09FF);

    defEvalInstr("io@",          0x003F);
    defEvalInstr("io!",          0x09BF);
    /*
      IO devices: 0x0 - UART
                  0x00  TX?
                  0x01  TX!
                  0x02  RX?
                  0x03  RX@
                  0x1 - SPI or Lattice ICE40UP5K sysBus (latter is implemented)
                  0x10  sysBus address
                  0x11  sysBus data
                  0x2 - gc hw allot, free, oneStep
                  0x20  allot - returns the next free quad address when read
                  0x21  free  - frees the quad whose address is written here
                  0x22  write 0x0000 to one step of gc
                        write 0x0001 to do full gc, will read 0x0001 until done then 0x0000
                  0x3 - DSP
                  0x30  A input
                  0x31  B input
                  0x32  C input
                  0x33  D input
                  0x34  O output [31:16]
                  0x35  O output [15:0]
                  0x36  dsp control
    */

    def("qt@", "QUAD_T_FETCH");
    def("qx@", "QUAD_X_FETCH");
    def("qy@", "QUAD_Y_FETCH");
    def("qz@", "QUAD_Z_FETCH");
    def("qt!", "QUAD_T_STORE");
    def("qx!", "QUAD_X_STORE");
    def("qy!", "QUAD_Y_STORE");
    def("qz!", "QUAD_Z_STORE");

    def("+",   "PLUS");
    def("&",   "AND");
    def("⊕",   "XOR");
    def("1+",  "INCR");
    def("@",   "FETCH");
    def("!",   "STORE");
    def(">R",  "TO_R");
    def("R>",  "R_FROM");
    def("R@",  "R_AT");
    def("-",   "MINUS");
    def("1-",  "DECR");

    def("SKZ", (asm) => {
      const here = asm.addr;
      const here_plustwo = asm.deferedOp.plus(here, 2);
      // return asm.deferedOp.or(0xA000, asm.deferedOp.and(here_plustwo, 0x0FFF));
      datum(0xA000 | ((here + 2) & 0x0FFF));
    });
    /*
    def("(JMP)", (asm) => {
      const here = asm.addr;
      const resolve = ([here_plusone, val]) => {
        asm.undatum(here); // erease placeholder
        asm.origin(here);
        // asm.datum(asm.deferedOp.or(0x8000, asm.deferedOp.and(val, 0x0FFF)));
        asm.datum(0x8000 | (val & 0x0FFF));
      };
      asm.datum("NOP"); // placeholder put in
      const gildra = asm.addr;
      asm.datum({ resolve });
      asm.origin(gildra);
      return undefined;
    });
    def("(BRZ)", (asm) => {
      const here = asm.addr;
      const resolve = ([here_plusone, val]) => {
        asm.undatum(here); // erease placeholder
        asm.origin(here);
        // asm.datum(asm.deferedOp.or(0xA000, asm.deferedOp.and(val, 0x0FFF)));
        asm.datum(0xA000 | (val & 0x0FFF));
      };
      asm.datum("NOP"); // placeholder put in
      const gildra = asm.addr;
      asm.datum({ resolve });
      asm.origin(gildra);
      return undefined;
    });
    */
    
    return {
      ...asm,
      def: (sym, val = undefined) => {
        if (val == undefined) {
          const here = asm.addr;
          asm.def(sym.concat("_"), here);
          /*
          val = asm.deferedOp.or(0xC000, asm.deferedOp.and(here, 0x0FFF));
          val.then((resolved_val) => {
            asm.symbols.redefine(sym, resolved_val);
          });
          */
          val = (0xC000 | (here & 0x0FFF));
        }
        asm.def(sym, val);
      },
    }
  }
  
  return asm;
};

