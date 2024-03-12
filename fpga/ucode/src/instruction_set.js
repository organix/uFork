// @ts-check js
/**
 * @use JSDoc
 * @overview Here the various instruction sets that ucode can run on defined
 * @author Zarutian
 */

import { makePromise } from "../util/util_funcs.js";
  
export const defineInstructionset = (asm, opts = { instrsetName: "uFork_CSM1" }) => {
  const { def } = asm;
  if (opts.instrsetName.startsWith("FCPU-16")) {
    def("instrset_FCPU-16", 1);
  }
  if (opts.instrsetName.startsWith("uFork_CSM1")) {
    def("instrset_uFork_CSM1", 1);
  }
  if (opts.instrsetName.includes("w/qmem")) {
    def("instrset_w/qmem", 1);
  }
  if (opts.instrsetName.includes("w/hwgc")) {
    def("instrset_w/hwgc", 1);
  }
  if (opts.instrsetName.imcludes("w/debug_io")) {
    def("instrset_w/debug_io", 1);
  }
  if (opts.instrsetName.startsWith("FCPU-16") ||
      opts.instrsetName.startsWith("uFork_CSM1")) {
    def("NOP",    0x0000);
    if (opts.instrsetName.startsWith("FCPU-16")) {
      def("UMPLUS", 0x0001);
      def("UM+", "UMPLUS");
    } else if (opts.instrzetName.startsWith("uFork_CSM1")) {
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
  if (opts.instrsetName.startsWith("FCPU-16 w/qmem") ||
      opts.instrsetName.startsWith("uFork_CSM1 w/qmem")) {
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
  if (opts.instrsetName.startsWith("FCPU-16 w/qmem w/hwgc") ||
      opts.instrsetName.startsWith("uFork_CSM1 w/qmem w/hwgc")) {
    def("QUAD_ALLOCATE", 0x0018);
    def("QUAD_FREE",    0x0019);
    def("QUAD_GCSTEP",  0x001A);
    def("QUAD_ISFULL",  0x001B);

    def("qallot",  "QUAD_ALLOCATE");
    def("qfree",   "QUAD_FREE");
    def("qgcstep", "QUAD_GCSTEP");
    def("qfull?",  "QUAD_ISFULL");
  }
  if ((opts.instrsetName.startsWith("FCPU-16 ") ||
       opts.instrsetName.startsWith("uFork_CSM1 ")) &&
      opts.instrsetName.includes("w/debug_io")) {
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

  // see uFork/fpga/fomu/csm/cpu.md as reference for uFork_SM2
  if (opts.instrsetName.startsWith("uFork_SM2")) {
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
        asm.origin(here);
        asm.datum(asm.deferedOp.or(0x8000, asm.deferedOp.and(val, 0x0FFF)));
      };
      return ["NOP", { resolve }];
      //      ^ placeholder
    });
    def("(BRZ)", (asm) => {
      const here = asm.addr;
      const resolve = ([here_plusone, val]) => {
        asm.origin(here);
        asm.datum(asm.deferedOp.or(0xA000, asm.deferedOp.and(val, 0x0FFF)));
      };
      return ["NOP", { resolve }];
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


    
  return asm;
};
