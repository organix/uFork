// @ts-check js
/**
 * @use JSDoc
 * @overview Here is implemented the software fallbacks for both quad memory and its garbage collection.
 * @author Zarutian
 **/

export const uFork_quadmem_and_gc = (asm) => {
  const { def, dat, isDefined } = asm;

  const hwImplOfQuadMemory =           isDefined("instrset_w/qmem");
  const hwImplOfQuadMemoryGC =         isDefined("instrset_w/hwgc");
  const hwImplOfQuadAllotAndFree =     hwImplOfQuadMemoryGC;

  if (!hwImplOfQuadMemory || !hwImplOfQuadMemoryGC) {
    def("uFork_quaddrInRam"); // ( quad_addr -- quad_addr bool )
    dat("DUP", "uFork_isRamQuad?", "EXIT");
  }
  if (!hwImplOfQuadMemory) {
    if (asm.isDefined("instrset_uFork_SM2") && asm.isDefined("platform_fomu")) {
      def("qram_base");
      dat("(CONST)", 0x4000);

      def("qrom_base");
      dat("(CONST)", 0x8000);

      def("qrom"); // ( quad_addr -- addr )
      dat("4*", "qrom_base", "+", "EXIT");

      def("qramt", "qram");
      def("qramx"); dat("qram", "1+", "EXIT");
      def("qramy"); dat("qram", "2+", "EXIT");
      def("qramz"); dat("qram", "3+", "EXIT");

      def("qram");      // ( quad_addr -- addr )
      dat("DUP");       // ( quad_addr quad_addr )
      dat("0x4000_&");  // ( quad_addr quad_addr_maskedUpper )
      dat("SWAP");      // ( quad_addr_maskedUpper quad_addr )
      dat("4*");        // ( quad_addr_maskedUpper quad_addr<<2 )
      dat("OR");        // ( qa )
      dat("qram_base"); // ( qa qram_base )
      dat("+");         // ( addr )
      dat("EXIT");      // ( addr )

      def("qrom"); // ( quad_addr -- addr )
      dat("4*", "qrom_base", "+", "EXIT");

      def("qramt", "qram");
      def("qramx"); dat("qram", "1+", "EXIT");
      def("qramy"); dat("qram", "2+", "EXIT");
      def("qramz"); dat("qram", "3+", "EXIT");
      
      def("qramt@"); // ( qaddr -- item )
      dat("qramt", "@", "EXIT");
      
      def("qramx@"); dat("qramx", "@", "EXIT");
      def("qramy@"); dat("qramy", "@", "EXIT");
      def("qramz@"); dat("qramz", "@", "EXIT");
      def("qramt!"); dat("qramt", "!", "EXIT");
      def("qramx!"); dat("qramx", "!", "EXIT");
      def("qramy!"); dat("qramy", "!", "EXIT");
      def("qramz!"); dat("qramz", "!", "EXIT");
      def("qromt@"); dat("qrom", "@", "EXIT");
      def("qromx@"); dat("qrom", "1+", "@", "EXIT");
      def("qromy@"); dat("qrom", "2+", "@", "EXIT");
      def("qromz@"); dat("qrom", "3+", "@", "EXIT");
    } else {
      if (!(asm.isDefined("spram@")) && !(asm.isDefined("spram!"))) {
        def("meta_quadMemSize_in_cells", asm.deferedOp.multiply("meta_quadMemSize_in_quads", 4));
        def("uFork_quadMem_baseAddr");
        dat("(CONST)", "meta_hereBeyondEnd");
        asm.symbols.redefine("meta_hereBeyondEnd", asm.incr("meta_hereBeyondEnd", "meta_quadMemSize_in_cells"));
      }

      def("uFork_quaddr2addr"); // ( quad_addr -- cell_addr )
      dat("(LIT)", 0xDFFF, "&");
      if (!(asm.isDefined("spram@")) && !(asm.isDefined("spram!"))) {
        dat("4*", "uFork_quadMem_baseAddr", "+", "EXIT");
        
        def("spram@", "@");
        def("spram!", "!");
      } else {
        dat("4*", "EXIT");
      }

      def("qramt"); dat("uFork_quaddr2addr", "EXIT");
      def("qramx"); dat("uFork_quaddr2addr", "1+", "EXIT");
      def("qramy"); dat("uFork_quaddr2addr", "2+", "EXIT");
      def("qramz"); dat("uFork_quaddr2addr", "3+", "EXIT");

      def("qramt@"); dat("qramt", "spram@", "EXIT");
      def("qramx@"); dat("qramx", "spram@", "EXIT");
      def("qramy@"); dat("qramy", "spram@", "EXIT");
      def("qramz@"); dat("qramz", "spram@", "EXIT");

      def("qramt!"); dat("qramt", "spram!", "EXIT");
      def("qramx!"); dat("qramx", "spram!", "EXIT");
      def("qramy!"); dat("qramy", "spram!", "EXIT");
      def("qramz!"); dat("qramz", "spram!", "EXIT");

      if (asm.isDefined("spi_flash@")) {
        throw new Error("not yet implemented!");
      } else {
        def("qromt@", "qramt@");
        def("qromx@", "qramx@");
        def("qromy@", "qramy@");
        def("qromz@", "qramz@");
      }
    } 

    asm.symbols.redefine("qt@"); // ( quad_addr -- t_field )
    dat("uFork_quaddrInRam");
    asm.macro.brz("qromt@");
    asm.macro.jmp("qramt@");
    asm.symbols.redefine("qx@"); // ( quad_addr -- x_field )
    dat("uFork_quaddrInRam");
    asm.macro.brz("qromx@");
    asm.macro.jmp("qramx@");
    asm.symbols.redefine("qy@"); // ( quad_addr -- y_field )
    dat("uFork_quaddrInRam");
    asm.macro.brz("qromy@");
    asm.macro.jmp("qramy@");
    asm.symbols.redefine("qz@"); // ( quad_addr -- z_field )
    dat("uFork_quaddrInRam");
    asm.macro.brz("qromz@");
    asm.macro.jmp("qramz@");

    // attempted writes to ROM are just silently discarded here
    asm.symbols.redefine("qt!"); // ( t_field quad_addr -- )
    dat("uFork_quaddrInRam");
    asm.macro.brz("2DROP");
    asm.macro.jmp("qramt!");
    asm.symbols.redefine("qx!"); // ( x_field quad_addr -- )
    dat("uFork_quaddrInRam");
    asm.macro.brz("2DROP");
    asm.macro.jmp("qramx!");
    asm.symbols.redefine("qy!"); // ( x_field quad_addr -- )
    dat("uFork_quaddrInRam");
    asm.macro.brz("2DROP");
    asm.macro.jmp("qramy!");
    asm.symbols.redefine("qz!"); // ( x_field quad_addr -- )
    dat("uFork_quaddrInRam");
    asm.macro.brz("2DROP");
    asm.macro.jmp("qramz!");
  }
  if (!hwImplOfQuadMemoryGC) {
    if (asm.isDefined("uFork_gc_algo1")) {
      // this only used by uFork_gc_algo1 as uFork_gc_algo2 needs full size cells and not just two bits
      def("gcMem_base");
      if (asm.isDefined("instrset_uFork_SM2.1") &&
          asm.isDefined("platform_fomu")) {
        dat("(CONST)", 0x1000);
      } else {
        throw new Error("todo! reimpl w/o deferedOps");
        dat("(CONST)", "meta_hereBeyondEnd");
        asm.symbols.redefine(
          "meta_hereBeyondEnd",
          asm.incr("meta_hereBeyondEnd", asm.deferedOp.intDivide("meta_quadMemSize_in_cells", 8))
        );
      }

      def("gcMem_common"); // ( quad_ram_addr -- bit_offset addr )
      dat("0x3FFF_&");
      dat("DUP", "7_&", "2*", "2+", "SWAP", "8/", "gcMem_base", "+", "EXIT");

      def("gcMem@");       // ( quad_addr -- gc_mark )
      dat("gcMem_common"); // ( bit_offset addr )
      dat("@");            // ( bit_offset cell )
      dat("SWAP");         // ( cell bit_offset )
      dat("LBR", "3_&");   // ( gc_mark )
      dat("EXIT");

      def("gcMem!");       // ( gc_mark quad_addr -- )
      dat("gcMem_common"); // ( gc_mark bit_offset addr )
      dat("DUP", "@");     // ( gc_mark bit_offset addr cell )
      dat("SWAP", ">R");   // ( gc_mark bit_offset cell ) R:( addr )
      dat("OVER");         // ( gc_mark bit_offset cell bit_offset ) R:( addr )
      dat("3", "INVERT");  // ( gc_mark bit_offset cell bit_offset 0xFFFC ) R:( addr )
      dat("SWAP", "LBR");  // ( gc_mark bit_offset cell mask ) R:( addr )
      dat("&", ">R");      // ( gc_mark bit_offset ) R:( addr masked_cell )
      dat("LBR", "R>");    // ( gc_mark_offsetted masked_cell ) R:( addr )
      dat("OR", "R>");     // ( cell addr )
      dat("!", "EXIT");    // ( )
    }
    if (!(asm.isDefined("gcMem@")) && !(asm.isDefined("gcMem!"))) {
      throw new Error("todo! reimpl w/o deferedOps");
      def("uFork_privateGCmem_baseAddr");
      dat("(CONST)", "meta_hereBeyondEnd");
      asm.symbols.redefine(
        "meta_hereBeyondEnd",
        asm.incr("meta_hereBeyondEnd", "meta_quadMemSize_in_quads"),
      ); // per uFork/docs/gc.md

      def("gcMem_common"); // ( quad_ram_offset -- addr )
      dat("uFork_privateGCmem_baseAddr", "+", "EXIT");

      def("gcMem@"); dat("gcMem_common", "@", "EXIT");
      def("gcMem!"); dat("gcMem_common", "!", "EXIT");
    }
    if (asm.isDefined("uFork_gc_algo2")) {
      // this implements the Rust implementation variant of gc
      def("gcMem@_shadowed", "gcMem@");
      def("gcMem!_shadowed", "gcMem!");

      def("gcMem_common2"); // ( quad_addr -- quad_ram_offset )
      dat("uFork_memoryDescriptor_qaddr", "-", "EXIT");

      def("uFork_gc_white", "uFork_#?");
      def("uFork_gc_black", "uFork_#unit");

      asm.symbols.redefine("gcMem@"); // ( quad_ram_addr -- value )
      dat("uFork_quaddrInRam");
      asm.macro.efSegð("gcMem@_l0", () => {}, () => {
        dat("gcMem_common2", "gcMem@_shadowed", "EXIT");
      });
      dat("DROP", "uFork_gc_black", "EXIT");

      asm.symbols.redefine("gcMem!"); // ( value quad_ram_addr -- )
      dat("uFork_quaddrInRam");
      asm.macro.brz("2DROP");
      dat("gcMem_common2", "gcMem!_shadowed", "EXIT");

      def("uFork_gc_phase");
      dat("(VAR)", 0);
      // 0 - marking setup
      // 1 - marking
      // 2 - sweep setup
      // 3 - sweeping ( and resetting gcMem by its way)
      // 0b0000_0000_0000_01xx  stop-the-world until done
      // 0xF-0xFFFE = counting up to idle
      // 0xFFFF - idle, check quad memory pressure

      def("uFork_gc_sweep_ptr");
      dat("(VAR)", 0);

      def("uFork_gc_first", "uFork_memoryDescriptor_qaddr"); // head of scanning queue addr
      def("uFork_gc_last",  "uFork_eventQueueAndContQueue"); // tail of scanning queue addr

      def("uFork_gc_add2scanque"); // ( quad_ram_addr -- )
      dat("uFork_quaddrInRam");
      asm.macro.brz("(DROP)");
      dat("DUP", "uFork_gc_first", "=");
      asm.macro.brz("(DROP)");
      dat("DUP", "uFork_gc_last",  "=");
      asm.macro.brz("(DROP)");
      dat("DUP");     // ( qra qra )
      dat("uFork_gc_last"); // ( qra qra addr )
      dat("gcMem@");  // ( qra qra last )
      dat("DUP", "uFork_()", "=");
      asm.macro.brz("uFork_gc_add2scanque_l0");
      dat("2DROP");
      asm.macro.jmp("uFork_gc_add2scanque_l1");
      def("uFork_gc_add2scanque_l0");
      dat("gcMem!");
      def("uFork_gc_add2scanque_l1");
      dat("DUP", "uFork_gc_last", "gcMem!");
      dat("DUP", "gcMem@", "uFork_gc_black", "=");
      asm.macro.brnz("(DROP)");
      dat("uFork_()", "SWAP", "gcMem!");
      dat("EXIT");

      def("uFork_gc_nextOfScanque");   // ( -- quad_ram_addr | uFork_() )
      dat("uFork_gc_first", "gcMem@"); // ( qra )
      asm.macro.efSegð("uFork_gc_nextOfScanque_l0",
        () => dat("DUP", "uFork_()", "<>"),
        () => {
          dat("DUP", "gcMem@");      // ( qra next )
          dat("uFork_gc_first", "gcMem!"); // ( qra )
        });
      dat("EXIT");

      def("uFork_gc_mutator_mark"); // ( ?_field quad_addr -- ?_field quad_addr )
      dat("uFork_gc_phase", "@", "DUP", "1=", "SWAP", "2=", "OR", "INVERT", "(BREXIT)");
      dat("2DUP", "uFork_gc_add2scanque", "uFork_gc_add2scanque", "EXIT");

      def("nonGChaz_qt!", "qt!");
      def("nonGChaz_qx!", "qx!");
      def("nonGChaz_qy!", "qy!");
      def("nonGZhaz_qz!", "qz!");

      asm.symbols.redefine("qt!"); // ( t_field quad_addr -- )
      dat("uFork_gc_mutator_mark", "nonGChaz_qt!", "EXIT");

      asm.symbols.redefine("qx!"); // ( x_field quad_addr -- )
      dat("uFork_gc_mutator_mark", "nonGChaz_qx!", "EXIT");

      asm.symbols.redefine("qy!"); // ( y_field quad_addr -- )
      dat("uFork_gc_mutator_mark", "nonGChaz_qy!", "EXIT");

      asm.symbols.redefine("qz!"); // ( z_field quad_addr -- )
      dat("uFork_gc_mutator_mark", "nonGChaz_qz!", "EXIT");

      def("uFork_gc_scan_quad"); // ( quad -- )
      dat("DUP", "qt@", "uFork_gc_add2scanque");
      dat("DUP", "qx@", "uFork_gc_add2scanque");
      dat("DUP", "qy@", "uFork_gc_add2scanque");
      dat(       "qz@", "uFork_gc_add2scanque");
      dat("EXIT");

      def("uFork_gc_mark_setup"); // ( phase -- )
      dat("uFork_gc_first", "uFork_gc_scan_quad");
      dat("uFork_gc_last",  "uFork_gc_scan_quad");
      dat("uFork_gc_last", "2+", "0x0F");
      asm.macro.countDownLoop("uFork_gc_mark_setup_l0", () => {
        dat("DUP", "uFork_gc_add2scanque", "1+");
      });
      dat("DROP");
      dat("uFork_gc_last", "2+", "uFork_gc_first", "gcMem!");
      asm.macro.jmp("uFork_gc_idle_l0");
      
      def("uFork_gc_mark"); // ( phase -- )
      dat("uFork_gc_nextOfScanque", "DUP", "uFork_()");
      asm.macro.brz("uFork_gc_mark_l0");
      dat("DROP");
      asm.macro.jmp("uFork_gc_idle_l0");
      def("uFork_gc_mark_l0"); // ( phase qa )
      dat("uFork_gc_scan_quad"); // ( phase )
      dat("DUP", "4&");
      asm.macro.brnz("uFork_gc_mark"); // stop-the-world condition
      dat("DROP", "EXIT");

      def("uFork_gc_sweep_setup"); // ( phase -- )
      dat("uFork_gc_first", "uFork_gc_sweep_ptr", "!");
      asm.macro.jmp("uFork_gc_idle_l0");

      def("uFork_gc_sweep"); // ( phase -- )
      dat("uFork_gc_sweep_ptr", "@"); // ( phase qa )
      dat("DUP", "uFork_maxTopOfQuadMemory", "=");
      asm.macro.brz("uFork_gc_sweep_l0");
      dat("DROP");
      asm.macro.jmp("uFork_gc_idle_l1");
      def("uFork_gc_sweep_l0");
      dat("DUP", "gcMem@"); // ( phase qa colour )
      dat("uFork_gc_white", "=");
      asm.macro.brz("uFork_gc_sweep_l1");
      dat("uFork_free");
      asm.macro.jmp("uFork_gc_idle_l1");
      def("uFork_gc_sweep_l1"); // ( phase qa )
      dat("DUP", "uFork_gc_white", "SWAP", "gcMem!");
      dat("1+", "uFork_gc_sweep_ptr", "!"); // ( phase )
      dat("DUP", "4&");
      asm.macro.brnz("uFork_gc_sweep"); // stop-the-world condition
      dat("DROP", "EXIT");

      // check quad memory pressure by looking at free count and qmem_top
      def("uFork_gc_check_quad_mem_pressure"); // ( -- bool )
      dat("uFork_memoryDescriptor", "DUP", "qy@", "2*");
      dat("+", "uFork_maxTopOfQuadMemory", ">"); // ( bool1 ) T: more than half on freelist!
      asm.macro.brnz("FALSE");
      dat("uFork_memoryDescriptor", "qt@", "2*", "uFork_maxTopOfQuadMemory", "<");
      // T: more than half of avalable quad ram available
      asm.macro.brnz("FALSE");
      asm.macro.jmp("TRUE");

      def("uFork_gcStopTheWorld"); // ( -- )
      dat("4", "uFork_gc_phase", "!");
      // deliberate fallthrough to uFork_gcOneStep

      def("uFork_gcOneStep"); // ( -- )
      dat("uFork_gc_phase", "@");   // ( phase )
      dat("(JMPTBL)", 8);
      dat("uFork_gc_mark_setup");  // 0
      dat("uFork_gc_mark");        // 1
      dat("uFork_gc_sweep_setup"); // 2
      dat("uFork_gc_sweep");       // 3
      dat("uFork_gc_idle_l1");     // 4
      dat("uFork_gc_mark");        // 5
      dat("uFork_gc_sweep_setup"); // 6
      dat("uFork_gc_sweep");       // 7
      def("uFork_gc_idle");        // ( phase -- )
      dat("DUP", "0xFFFF", "=");
      asm.macro.brz("uFork_gc_idle_l0");
      dat("uFork_gc_check_quad_mem_pressure");
      asm.macro.brz("uFork_gc_idle_l1");
      asm.macro.jmp("uFork_gc_mark_setup");
      def("uFork_gc_idle_l1");     // ( 0 )
      dat("DROP", "0x0F");         // ( 15 )
      def("uFork_gc_idle_l0");     // ( phase )
      dat("DUP", "1+", "uFork_gc_phase", "!");
      dat("4&");
      asm.macro.brnz("uFork_gcOneStep"); // stop-the-world condition
      dat("EXIT");
    } else if (asm.isDefined("uFork_gc_algo1")) {
      // this implements the uFork-c implementation garbage collection algorithm
      // reference https://github.com/organix/ufork-c/blob/main/gc.md
      def("uFork_gc_genx_mark", "0");
      def("uFork_gc_geny_mark", "1");
      def("uFork_gc_scan_mark", "2");
      def("uFork_gc_free_mark", "3");

      def("uFork_gc_currGen");
      dat("(VAR)", 0);

      def("uFork_gc_not_gen"); // ( gen_mark -- gen_mark )
      dat("(JMPTBL)", 2);
      dat("uFork_gc_not_genx");
      dat("uFork_gc_not_geny");
      dat("EXIT");
      def("uFork_gc_not_genx");
      dat("DROP", "(JMP)", "uFork_gc_geny_mark");
      def("uFork_gc_not_geny");
      dat("DROP", "(JMP)", "uFork_gc_genx_mark");

      def("uFork_gc_swapCurrGen");
      dat("uFork_gc_currGen", "@", "uFork_gc_not_gen", "uFork_gc_currGen", "!");
      dat("EXIT");

      def("uFork_gc_ptr");
      dat("(VAR)", 0);

      def("uFork_gc_add2scanque"); // ( quaddr -- )
      dat("uFork_quaddrInRam");
      asm.macro.brz("(DROP)");
      dat("DUP", "gcMem@", "uFork_gc_currGen", "@", "<>");
      asm.macro.brz("(DROP)");
      dat("uFork_gc_scan_mark", "SWAP", "gcMem!");
      dat("EXIT");

      def("uFork_gc_offset2quadRamAddr"); // ( offset -- quaddr )
      dat("uFork_memoryDescriptor_qaddr", "+", "EXIT");

      def("uFork_gc_scan_quad"); // ( offset -- )
      dat("uFork_gc_offset2quadRamAddr"); // ( qram_addr )
      dat("DUP", "qt@", "uFork_gc_add2scanque");
      dat("DUP", "qx@", "uFork_gc_add2scanque");
      dat("DUP", "qy@", "uFork_gc_add2scanque");
      dat(       "qz@", "uFork_gc_add2scanque");
      dat("EXIT");

      def("uFork_gc_mark_setup"); // ( phase -- )
      dat("uFork_gc_swapCurrGen");
      dat("0", "uFork_gc_ptr", "!");
      dat("0xF", ">R");
      def("uFork_gc_mark_setup_l0");
      dat("R@", "uFork_gc_offset2quadRamAddr", "uFork_gc_add2scanque");
      asm.macro.loopMinus("uFork_gc_mark_setup_l0");
      dat("1+");
      asm.macro.jmp("uFork_gc_phase_common");

      def("uFork_gc_incr_ptr"); // ( -- offset )
      dat("uFork_gc_ptr", "@", "DUP", "1+", "uFork_gc_ptr", "!", "EXIT");

      def("uFork_gc_mark"); // ( phase -- )
      dat("uFork_gc_incr_ptr");
      dat("DUP", "(LIT)", "meta_quadMemSize_in_quads", "<=");
      asm.macro.brnz("uFork_gc_mark_l0");
      dat("DROP", "1+");
      asm.macro.jmp("uFork_gc_phase_common");
      def("uFork_gc_mark_l0"); // ( phase offset )
      dat("DUP", "gcMem@", "uFork_gc_scan_mark", "=");
      asm.macro.brz("uFork_gc_mark_l1");
      dat("DUP", "uFork_gc_currGen", "@", "SWAP", "gcMem!");
      dat("uFork_gc_scan_quad"); // ( phase )
      asm.macro.jmp("uFork_gc_mark_l2");
      def("uFork_gc_mark_l1");
      dat("DROP");
      def("uFork_gc_mark_l2");
      dat("DUP", "4&");
      asm.macro.brnz("uFork_gc_mark"); // stop-the-world condition
      dat("DROP", "EXIT");

      def("uFork_gc_sweep_setup"); // ( phase -- )
      dat("0", "uFork_gc_ptr", "!");
      dat("1+");
      asm.macro.jmp("uFork_gc_phase_common");

      def("uFork_gc_sweep"); // ( phase -- )
      dat("uFork_gc_incr_ptr");
      dat("DUP", "(LIT)", "meta_quadMemSize_in_quads", "<=");
      asm.macro.brnz("uFork_gc_sweep_l0");
      dat("DROP", "1+");
      asm.macro.jmp("uFork_gc_phase_common");
      def("uFork_gc_sweep_l0"); // ( phase offset )
      dat("DUP", "gcMem@");     // ( phase offset mark )
      dat("DUP", "uFork_gc_currGen", "@", "="); // ( phase offset mark bool )
      asm.macro.brz("uFork_gc_sweep_l1");
      def("uFork_gc_sweep_l2");
      dat("2DROP");
      asm.macro.jmp("uFork_gc_phase_common");
      def("uFork_gc_sweep_l1");
      dat("DUP", "uFork_gc_currGen", "@", "uFork_gc_not_gen", "=");
      asm.macro.brz("uFork_gc_sweep_l2"); // ( phase offset mark )
      dat("DROP", "DUP", "uFork_gc_offset2quadRamAddr", "uFork_free"); // ( phase offset )
      dat("uFork_gc_free_mark", "SWAP", "gcMem!");
      asm.macro.jmp("uFork_gc_phase_common");

      def("uFork_gc_phase");
      dat("(VAR)", 0x0000);
      
      def("uFork_gcOneStep"); // ( -- )
      dat("uFork_gc_phase", "@");
      dat("(JMPTBL)", 4);
      dat("uFork_gc_mark_setup");  // 0
      dat("uFork_gc_mark");        // 1
      dat("uFork_gc_sweep_setup"); // 2
      dat("uFork_gc_sweep");       // 3
      def("uFork_gc_phase_common");
      dat("3", "&");
      dat("uFork_gc_phase", "!", "EXIT");

    } else {
      throw new Error("garbage collection isnt implemented in hardware and neither of the two gc algorithms have been selected  (uFork_gc_algo1 or uFork_gc_algo2)");
    }
  }
  return asm;
};


