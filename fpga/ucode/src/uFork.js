// @ts-check js
/**
 * @use JSDoc
 * @overview Implements the uFork instructionset in microcode
 * @author Zarutian
 */
// using uFork/docs/vm.md as reference
//   as that is a bit incomplete use uFork/vm/rs/src/any.rs as suppliment
// also using uFork/docs/sponsor.md as reference

export const uFork = (asm) => {
  const { def, dat, isDefined } = asm;

  const eventQueueAndContQueue_qaddr = isDefined("uFork_eventQueueAndKontQueue_qaddr") ?
                                       asm.symbols.lookup("uFork_eventQueueAndKontQueue_qaddr") :
                                       0x4001;
  const memoryDescriptor_qaddr =       isDefined("uFork_memoryDescriptor_qaddr") ?
                                       asm.symbols.lookup("uFork_memoryDescriptor_qaddr") :
                                       0x4000;
  const maxTopOfQuadMemory =           0x5000;
  const quadMemSize_in_quads = maxTopOfQuadMemory - memoryDescriptor_qaddr;
  const uForkSubroutines =             isDefined("uFork_subroutines_support");

  let hereBeyondEnd = asm.incr("uFork_last_ucode_address", 0x0000);
  if (!hwImplOfQuadMemory) {
    if (asm.isDefined("instrset_uFork_SM2") && asm.isDefined("platform_fomu")) {
      def("qram_base");
      dat("(CONST)", 0x4000);

      def("qrom_base");
      dat("(CONST)", 0x8000);

      def("qram"); // ( quad_addr -- addr )
      dat("DUP", "0x6000_&", "SWAP", "4*", "OR", "qram_base", "+", "EXIT");

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
        const quadMemSize_in_cells = quadMemSize_in_quads * 4;
        def("uFork_quadMem_baseAddr");
        dat("(CONST)", hereBeyondEnd);
        hereBeyondEnd = asm.incr(hereBeyondEnd, quadMemSize_in_cells);
      }

      def("uFork_quaddr2addr"); // ( quad_addr -- cell_addr )
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
      } else {
        def("qromt@", "qramt@");
        def("qromx@", "qramx@");
        def("qromy@", "qramy@");
        def("qromz@", "qramz@");
      }
    } 

    asm.symbols.redefine("qt@"); // ( quad_addr -- t_field )
    dat("uFork_quaddrInRam", "(BRZ)", "qromt@", "(JMP)", "qramt@");
    asm.symbols.redefine("qx@"); // ( quad_addr -- x_field )
    dat("uFork_quaddrInRam", "(BRZ)", "qromx@", "(JMP)", "qramx@");
    asm.symbols.redefine("qy@"); // ( quad_addr -- y_field )
    dat("uFork_quaddrInRam", "(BRZ)", "qromy@", "(JMP)", "qramy@");
    asm.symbols.redefine("qz@"); // ( quad_addr -- z_field )
    dat("uFork_quaddrInRam", "(BRZ)", "qromz@", "(JMP)", "qramz@");

    // attempted writes to ROM are just silently discarded here
    asm.symbols.redefine("qt!"); // ( t_field quad_addr -- )
    dat("uFork_quaddrInRam", "(BRZ)", "2DROP", "(JMP)", "qramt!");
    asm.symbols.redefine("qx!"); // ( x_field quad_addr -- )
    dat("uFork_quaddrInRam", "(BRZ)", "2DROP", "(JMP)", "qramx!");
    asm.symbols.redefine("qy!"); // ( x_field quad_addr -- )
    dat("uFork_quaddrInRam", "(BRZ)", "2DROP", "(JMP)", "qramy!");
    asm.symbols.redefine("qz!"); // ( x_field quad_addr -- )
    dat("uFork_quaddrInRam", "(BRZ)", "2DROP", "(JMP)", "qramz!");
  }
  if (!hwImplOfQuadMemoryGC) {
    if (asm.isDefined("instrset_uFork_SM2") && asm.isDefined("platform_fomu")) {
      def("gcMem_base");
      dat("(CONST)", 0x1000);
      
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
      def("uFork_privateGCmem_baseAddr");
      dat("(CONST)", hereBeyondEnd);
      hereBeyondEnd = asm.incr(hereBeyondEnd, quadMemSize_in_quads); // per uFork/docs/gc.md

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
      dat("uFork_quaddrInRam", "(BRZ)", "gcMem@_l0");
      dat("gcMem_common2", "gcMem@_shadowed", "EXIT");
      def("gcMem@_l0");
      dat("DROP", "uFork_gc_black", "EXIT");

      asm.symbols.redefine("gcMem!"); // ( value quad_ram_addr -- )
      dat("uFork_quaddrInRam", "(BRZ)", "2DROP");
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
      def("uForkygc_last",  "uFork_eventQueueAndContQueue"); // tail of scanning queue addr

      def("uFork_gc_add2scanque"); // ( quad_ram_addr -- )
      dat("uFork_quaddrInRam", "(BRZ)", "(DROP)");
      dat("DUP", "uFork_gc_first", "=", "(BRZ)", "(DROP)");
      dat("DUP", "uFork_gc_last",  "=", "(BRZ)", "(DROP)");
      dat("DUP");     // ( qra qra )
      dat("uFork_gc_last"); // ( qra qra addr )
      dat("gcMem@");  // ( qra qra last )
      dat("DUP", "uFork_()", "=", "(BRZ)", "uFork_gc_add2scanque_l0");
      dat("2DROP", "(JMP)", "uFork_gc_add2scanque_l1");
      def("uFork_gc_add2scanque_l0");
      dat("gcMem!");
      def("uFork_gc_add2scanque_l1");
      dat("DUP", "uFork_gc_last", "gcMem!");
      dat("DUP", "gcMem@", "uFork_gc_black", "=", "(BRNZ)", "(DROP)");
      dat("uFork_()", "SWAP", "gcMem!");
      dat("EXIT");

      def("uFork_gc_nextOfScanque");   // ( -- quad_ram_addr | uFork_() )
      dat("uFork_gc_first", "gcMem@"); // ( qra )
      dat("DUP", "uFork_()", "=", "(BRNZ)", "uFork_gc_nextOfScanque_l0");
      dat("DUP", "gcMem@");      // ( qra next )
      dat("uFork_gc_first", "gcMem!"); // ( qra )
      def("uFork_gc_nextOfScanque_l0");
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
      dat("uFork_gc_last", "2+", "0x0F", "1-", ">R");
      def("uFork_gc_mark_setup_l0"); // ( qa )
      dat("DUP", "uFork_gc_add2scanque", "1+");
      dat("(NEXT)", "uFork_gc_mark_setup_l0");
      dat("DROP");
      dat("uFork_gc_last", "2+", "uFork_gc_first", "gcMem!");
      dat("(JMP)", "uFork_gc_idle_l0");

      def("uFork_gc_mark"); // ( phase -- )
      dat("uFork_gc_nextOfScanque", "DUP", "uFork_()", "(BRZ)", "uFork_gc_mark_l0");
      dat("DROP", "(JMP)", "uFork_gc_idle_l0");
      def("uFork_gc_mark_l0"); // ( phase qa )
      dat("uFork_gc_scan_quad"); // ( phase )
      dat("DUP", "4&", "(BRNZ)", "uFork_gc_mark"); // stop-the-world condition
      dat("DROP", "EXIT");

      def("uFork_gc_sweep_setup"); // ( phase -- )
      dat("uFork_gc_first", "uFork_gc_sweep_ptr", "!");
      dat("(JMP)", "uFork_gc_idle_l0");

      def("uFork_gc_sweep"); // ( phase -- )
      dat("uFork_gc_sweep_ptr", "@"); // ( phase qa )
      dat("DUP", "uFork_maxTopOfQuadMemory", "=", "(BRZ)", "uFork_gc_sweep_l0");
      dat("DROP", "(JMP)", "uFork_gc_idle_l1");
      def("uFork_gc_sweep_l0");
      dat("DUP", "gcMem@"); // ( phase qa colour )
      dat("uFork_gc_white", "=", "(BRZ)", "uFork_gc_sweep_l1");
      dat("uFork_free", "(JMP)", "uFork_gc_sweep_l2");
      def("uFork_gc_sweep_l1"); // ( phase qa )
      dat("DUP", "uFork_gc_white", "SWAP", "gcMem!");
      dat("1+", "uFork_gc_sweep_ptr", "!"); // ( phase )
      dat("DUP", "4&", "(BRNZ)", "uFork_gc_sweep"); // stop-the-world condition
      dat("DROP", "EXIT");

      // check quad memory pressure by looking at free count and qmem_top
      def("uFork_gc_check_quad_mem_pressure"); // ( -- bool )
      dat("uFork_memoryDescriptor", "DUP", "qy@", "2*");
      dat("+", "uFork_maxTopOfQuadMemory", ">"); // ( bool1 ) T: more than half on freelist!
      dat("(BRNZ)", "FALSE");
      dat("uFork_memoryDescriptor", "qt@", "2*", "uFork_maxTopOfQuadMemory", "<");
      // T: more than half of avalable quad ram available
      dat("(BRNZ)", "FALSE");
      dat("(JMP)", "TRUE");

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
      dat("DUP", "0xFFFF", "=", "(BRZ)", "uFork_gc_idle_l0");
      dat("uFork_gc_check_quad_mem_pressure", "(BRZ)", "uFork_gc_idle_l1");
      dat("(JMP)", "uFork_gc_mark_setup");
      def("uFork_gc_idle_l1");     // ( 0 )
      dat("DROP", "0x0F");         // ( 15 )
      def("uFork_gc_idle_l0");     // ( phase )
      dat("DUP", "1+", "uFork_gc_phase", "!");
      dat("4&", "(BRNZ)", "uFork_gcOneStep"); // stop-the-world condition
      dat("EXIT");
    } else if (asm.isDefined("uFork_gc_algo1")) {
      // this implements the uFork-c implementation garbage collection algorithm
    } else {
      throw new Error("garbage collection isnt implemented in hardware and neither of the two gc algorithms have been selected  (uFork_gc_algo1 or uFork_gc_algo2)");
    }
  }
  
  def("uFork_doOneRunLoopTurn"); // ( -- )
  dat("uFork_checkPendingInterrupts"); // ( -- )
  dat("uFork_dispatchOneEvent"); // ( -- )
  dat("uFork_doOneInstrOfContinuation"); // ( -- )
  dat("uFork_gcOneStep"); // ( -- )
  dat("EXIT");

  def("uFork_checkPendingInterrupts");
  // nothing here yet
  dat("EXIT");

  def("uFork_memoryDescriptor");
  dat("(CONST)", memoryDescriptor_qaddr);

  def("uFork_eventQueueAndContQueue");
  dat("(CONST)", eventQueueAndContQueue_qaddr);

  def("uFork_#?", "ZERO"); // aka UNDEF

  def("uFork_()");
  def("uFork_nil");
  dat("(CONST)", 0x0001);

  def("uFork_#f");
  dat("(CONST)", 0x0002);

  def("uFork_#t");
  dat("(CONST)", 0x0003);

  def("uFork_#unit");
  dat("(CONST)", 0x0004);

  def("uFork_EMPTY_DQ");
  dat("(CONST)", 0x0005);

  def("uFork_#type_t");
  dat("(CONST)", 0x0006);

  def("uFork_#fixnum_t");
  dat("(CONST)", 0x0007);

  def("uFork_#actor_t");
  dat("(CONST)", 0x0008);

  def("uFork_PROXY_T");
  dat("(CONST)", 0x0009);

  def("uFork_STUB_T");
  dat("(CONST)", 0x000A);

  def("uFork_#instr_t");
  dat("(CONST)", 0x000B);

  def("uFork_#pair_t");
  dat("(CONST)", 0x000C);

  def("uFork_#dict_t");
  dat("(CONST)", 0x000D);

  def("uFork_FWD_REF_T");
  dat("(CONST)", 0x000E);

  def("uFork_FREE_T");
  dat("(CONST)", 0x000F);

  // source uFork/vm/rs/src/lib.rs
  def("uFork_E_OK", "ZERO"); // not an error
  def("uFork_E_FAIL", "-1"); // general failure

  def("uFork_E_BOUNDS");  // out of bounds
  dat("(CONST)", 0xFFFE); // -2

  def("uFork_E_NO_MEM");  // no memory available
  dat("(CONST)", 0xFFFD); // -3
  
  def("uFork_E_NOT_FIX"); // fixnum required
  dat("(CONST)", 0xFFFC); // -4
  
  def("uFork_E_NOT_CAP"); // capability required
  dat("(CONST)", 0xFFFB); // -5
  
  def("uFork_E_NOT_PTR"); // memory pointer required
  dat("(CONST)", 0xFFFA); // -6
  
  def("uFork_E_NOT_ROM"); // ROM pointer required
  dat("(CONST)", 0xFFF9); // -7
  
  def("uFork_E_NOT_RAM"); // RAM pointer required
  dat("(CONST)", 0xFFF8); // -8
  
  def("uFork_E_NOT_EXE"); // instruction required
  dat("(CONST)", 0xFFF7); // -9
  
  def("uFork_E_NO_TYPE"); // type required
  dat("(CONST)", 0xFFF6); // -10
  
  def("uFork_E_MEM_LIM"); // Sponsor memory limit reached
  dat("(CONST)", 0xFFF5); // -11
  
  def("uFork_E_CPU_LIM"); // Sponsor instruction limit reached
  dat("(CONST)", 0xFFF4); // -12
  
  def("uFork_E_MSG_LIM"); // Sponsor event limit reached
  dat("(CONST)", 0xFFF3); // -13
  
  def("uFork_E_ASSERT");  // assertion failed
  dat("(CONST)", 0xFFF2); // -14
  
  def("uFork_E_STOP");    // actor stopped
  dat("(CONST)", 0xFFF1); // -15

  def("uFork_sp@"); // ( kont -- uFork_stack_qaddr )
  if (uForkSubroutines) {
    dat("qx@");
  }
  dat("qx@", "EXIT");

  def("uFork_sp!"); // ( uFork_stack kont -- )
  if (uForkSubroutines) {
    dat("qx@");
  }
  dat("qx!", "EXIT");

  if (uForkSubroutines) {
    def("uFork_rp@"); // ( kont -- uFork_rstack )
    dat("qx@", "qy@", "EXIT");

    def("uFork_rp!"); // ( uFork_rstack kont -- )
    dat("qx@", "qy!", "EXIT");

    def("uFork_rpop");      // ( kont -- item )
    dat("DUP");             // ( kont kont )
    dat("uFork_rp@");       // ( kont rstack )
    dat("uFork_carAndCdr"); // ( kont item next_rstack )
    dat("SWAP");            // ( kont next_rstack item )
    dat(">R");              // ( kont next_rstack ) R:( item )
    dat("SWAP");            // ( next_rstack kont )
    dat("uFork_rp!");       // ( ) R:( item )
    dat("R>");              // ( item ) R:( )
    dat("EXIT");            //

    def("uFork_rpush");     // ( item kont -- )
    dat("DUP", ">R");       // ( item kont ) R:( kont )
    dat("uFork_rp@");       // ( item rstack ) R:( kont )
    dat("uFork_cons");      // ( rstack_new ) R:( kont )
    dat("R>");              // ( rstack_new kont ) R:( )
    dat("uFork_rp!");       // ( )
    dat("EXIT");
  }

  def("uFork_isFixnum?"); // ( specimen -- bool )
  dat("0x8000", "&", "(JMP)", "CLEAN_BOOL");

  def("uFork_isMutable?"); // ( specimen -- bool )
  dat("0x4000", "&", "(JMP)", "CLEAN_BOOL");

  def("uFork_isImmutable?"); // ( specimen -- bool )
  dat("uFork_isMutable?", "INVERT", "EXIT");

  def("uFork_isQuad?"); // ( specimen -- bool )
  dat("uFork_isFixnum?", "INVERT", "EXIT");

  def("uFork_isRamQuad?"); // ( specimen -- bool )
  dat("DUP", "uFork_isQuad?", "SWAP", "uFork_isMutable?", "&", "EXIT");

  def("uFork_fixnum2int"); // ( fixnum -- int )
  dat("0x7FFF_&", "DUP", "1<<", "0x8000", "&", "OR"); // sign extend
  dat("EXIT");

  def("uFork_int2fixnum"); // ( int -- fixnum )
  dat("DUP", "0x8000", "&", "1>>", "OR"); // move the sign bit
  dat("0x8000_OR", "EXIT"); // tag it as fixnum and return

  def("uFork_incr"); // ( fixnum -- fixnum )
  dat("uFork_fixnum2int", "1+", "uFork_int2fixnum", "EXIT");

  def("uFork_decr"); // ( fixnum -- fixnum )
  dat("uFork_fixnum2int", "1-", "uFork_int2fixnum", "EXIT");

  if (hwImplOfQuadMemoryGC) {
    // todo: tbd: exit to monitor with a message or?
  } else {
    def("uFork_outOfQuadMemory"); // ( item -- )
    dat("DROP");
    dat("uFork_gcStopTheWorld"):
    // deliberate fallthrough to uFork_allot for a secound quad allot attempt but now after gc was done.
  }

  def("uFork_allot"); // ( -- qaddr )
  if (hwImplOfQuadAllotAndFree) {
    dat("qallot", "qfull?", "(BRNZ)", "uFork_outOfQuadMemory", "EXIT");
  } else {
    // first check if any quads are on the free list
    dat("uFork_memoryDescriptor", "qx@"); // ( qa )
    dat("DUP", "uFork_()", "=");          // ( qa notNil? )
    dat("(BRZ)", "uFork_allot_l0");       // ( qa )
    // no quads on the free list, increment top addr and use that
    dat("uFork_memoryDescriptor", "qt@");
    dat("DUP", "uFork_maxTopOfQuadMemory", "<", "(BRZ)", "uFork_outOfQuadMemory");
    dat("1+", "DUP");
    dat("uFork_memoryDescriptor", "qt!");
    dat("(JMP)", "uFork_allot_l1");
    def("uFork_allot_l0"); // ( qa ) got a quad off the free list
    dat("DUP", "qy@", "uFork_memoryDescriptor", "qx!"); // update the free list
    dat("uFork_memoryDescriptor", "qy@", "uFork_decr", "uFork_memoryDescriptor", "qy!");
    def("uFork_allot_l1"); // ( qa ) clean the quad
    dat("uFork_#?__OVER", "qt!");
    dat("uFork_#?__OVER", "qx!");
    dat("uFork_#?__OVER", "qy!");
    dat("uFork_#?__OVER", "qz!");
    dat("EXIT");

    def("uFork_#?__OVER");
    dat("uFork_#?", "OVER", "EXIT");

    def("uFork_maxTopOfQuadMemory");
    dat("(CONST)", maxTopOfQuadMemory);
  }
  
  def("uFork_free"); // ( qaddr -- )
  dat("DUP", "uFork_isFixnum?", "(BRNZ)", "(DROP)");
  dat("DUP", "uFork_isImmutable?", "(BRNZ)", "(DROP)");
  if (hwImplOfQuadAllotAndFree) {
    dat("qfree", "EXIT");
  } else {
    dat("uFork_FREE_T", "OVER", "qt!");
    dat("uFork_#?__OVER", "qx!");
    dat("uFork_#?__OVER", "qy!");
    // then slapp the quad onto the free list
    dat("uFork_memoryDescriptor", "qx@", "OVER", "qy!");
    dat("uFork_memoryDescriptor", "qx!");
    dat("uFork_memoryDescriptor", "qy@", "uFork_incr");
    dat("uFork_memoryDescriptor", "qy!");
    dat("EXIT");
  }

  def("uFork_enqueueEvents"); // ( headOfNewEvents -- )
  dat("DUP");                 // ( events events )
  dat("uFork_eventQueueAndContQueue", "qx@"); // ( events events e_tail )
  dat("qz!");  // link the events segment in ( events )
  def("uFork_enqueueEvents_l0"); // find the tail of the added events ( events )
  dat("DUP", "qz@", "DUP", "uFork_()", "=", "(BRNZ)", "uFork_enqueueEvents_l1");
  dat("NIP", "(JMP)", "uFork_enqueueEvents_l0");
  def("uFork_enqueueEvents_l1"); // ( tailOfEvents uFork_() )
  dat("DROP", "uFork_eventQueueAndContQueue", "qx!"); // ( )
  dat("EXIT");
  

  def("uFork_enqueueCont"); // ( kont -- )
  dat("uFork_eventQueueAndContQueue", "qz@"); // ( kont k_tail )
  dat("2DUP", "qz!", "DROP");
  dat("uFork_eventQueueAndContQueue", "qz!"); // ( )
  dat("EXIT");

  def("uFork_signal_sponsor_controler"); // ( kont E_* -- )
  dat("SWAP", "qy@");     // ( E_* event )
  dat("qt@");             // ( E_* sponsor )
  dat("DUP", "qz@");      // ( E_* sponsor signal )
  dat("DUP", "uFork_#?", "=", "(BRNZ)", "uFork_HALTCORE"); // because there is no one to signal
  dat(">R", "qz!", "R>"); // ( signal )
  dat("uFork_enqueueEvents"); // ( )
  dat("EXIT");

  def("uFork_isContHalted?"); // ( kont -- kont bool )
  dat("DUP");      // ( kont kont )
  dat("qy@");      // ( kont event )
  dat("qt@");      // ( kont sponsor )
  dat("qz@");      // ( kont signal )
  dat("DUP");      // ( kont signal signal )
  dat("uFork_#?"); // ( kont signal signal #? )
  dat("=");        // ( kont signal bool )
  dat("SWAP");     // ( kont bool signal )
  dat("uFork_isFixnum?"); // ( kont bool bool )
  dat("INVERT");   // ( kont bool ~bool )
  dat("OR");       // ( kont bool )
  dat("EXIT");

  def("uFork_sponsor_cycles_check&burn"); // ( kont -- kont )
  dat("DUP");           // ( kont kont )
  dat("qy@");           // ( kont event )
  dat("qt@");           // ( kont sponsor )
  dat("DUP", "qy@");    // ( kont sponsor cycles_fixnum )
  dat("DUP", "ZERO", "uFork_int2fixnum", "=", "(BRZ)", "uFork_sponsor_cycles_check_l0");
  dat("2DROP");         // ( kont )
  dat("DUP");           // ( kont kont )
  dat("uFork_E_CPU_LIM", "uFork_signal_sponsor_controler");
  dat("R>", "@", ">R", "EXIT");
  def("uFork_sponsor_cycles_check_l0");
  dat("uFork_decr");    // ( kont sponsor cycles-1_fixnum )
  dat("SWAP", "qy!");   // ( kont )
  dat("R>", "1+", ">R", "EXIT");
  
  
  def("uFork_doOneInstrOfContinuation"); // ( -- )
  dat("uFork_eventQueueAndContQueue", "qy@"); // ( k_head )
  dat("DUP", "qz@");    // ( k_head k_next )
  dat("uFork_eventQueueAndContQueue", "qy!"); // ( k_head )
  dat("DUP", "uFork_fetchAndExec"); // ( k_head )
  dat("uFork_enqueueCont"); // ( k_head )
  dat("EXIT");

  def("uFork_fetchAndExec"); // ( kont -- )
  dat("uFork_isContHalted", "(BREXIT)");
  // done: insert sponsor cycles fuel check&burn here.
  dat("uFork_sponsor_cycles_check&burn", "RDROP");
  dat("DUP", "qt@");         // ( kont ip )
  // todo: insert ip #instr_t check here
  dat("DUP", "qx@");         // ( kont ip opcode )
  // dat("(JMP)", "uFork_doInstr"); fallthrough
  // def("uFork_doInstr"); // ( opcode_fixnum -- )
  dat("uFork_fixnum2int"); // ( opcode )
  dat("(JMPTBL)");
  dat(37); // number of base instructions
  dat("uFork_instr_debug");   // +0
  dat("uFork_instr_jump");    // +1
  dat("uFork_instr_push");    // +2
  dat("uFork_instr_if");      // +3
  dat("uFork_instr__error");  // +4  unused
  dat("uFork_instr_typeq");   // +5
  dat("uFork_instr_eq");      // +6
  dat("uFork_instr_assert");  // +7
  dat("uFork_instr_sponsor"); // +8
  dat("uFork_instr_quad");    // +9
  dat("uFork_instr_dict");    // +10
  dat("uFork_instr_deque");   // +11
  dat("uFork_instr_my");      // +12
  dat("uFork_instr_alu");     // +13
  dat("uFork_instr_cmp");     // +14
  dat("uFork_instr_end");     // +15
  dat("uFork_instr__error");  // +16  unused
  dat("uFork_instr_pair");    // +17
  dat("uFork_instr_part");    // +18
  dat("uFork_instr_nth");     // +19
  dat("uFork_instr_pick");    // +20
  dat("uFork_instr_roll");    // +21
  dat("uFork_instr_dup");     // +22
  dat("uFork_instr_drop");    // +23
  dat("uFork_instr_msg");     // +24
  dat("uFork_instr_state");   // +25
  dat("uFork_instr_send");    // +26
  dat("uFork_instr_signal");  // +27
  dat("uFork_instr_new");     // +28
  dat("uFork_instr_beh");     // +29
  dat("uFork_instr__error");  // +30
  dat("uFork_instr__error");  // +31
  
  dat("uFork_instr__rpush");  // +32
  dat("uFork_instr__rpop");   // +33
  dat("uFork_instr__subroutine_call"); // +34
  dat("uFork_instr__subroutine_exit"); // +35
  dat("uFork_instr_nop");     // +36

  def("uFork_instr__error");
  def("uFork_no_such_opcode"); // ( kont ip opcode )
  // todo: cause a error signal
  dat("EXIT");

  def("uFork_cons"); // ( item tail -- pair_quad )
  dat("uFork_allot"); // ( i t qa )
  dat("DUP", ">R");  // ( i t qa ) R:( qa )
  dat("qy!", "R@");  // ( i qa ) R:( qa )
  dat("qx!");        // ( ) R:( qa )
  dat("uFork_#pair_t", "R@", "qt!");
  dat("uFork_#?", "R@", "qz!");
  dat("R>");
  dat("EXIT");

  def("uFork_push");    // ( item kont -- )
  dat("DUP", ">R");     // ( item kont ) R:( kont )
  dat("uFork_sp@");     // ( item stack ) R:( kont )
  dat("uFork_cons");    // ( pair_quad ) R:( kont )
  dat("R>");            // ( pair_quad kont ) R:( )
  dat("uFork_sp!");     // ( )
  dat("EXIT");

  def("uFork_car", "qx@"); // ( pair_quad -- car )
  def("uFork_cdr", "qy@"); // ( pair_quad -- cdr )

  def("uFork_carAndCdr");  // ( pair_quad -- car cdr )
  dat("DUP");              // ( pair_quad pair_quad )
  dat("uFork_car");        // ( pair_quad car )
  dat("SWAP");             // ( car pair_quad )
  dat("uFork_cdr");        // ( car cdr )
  dat("EXIT");

  def("uFork_ndeep"); // ( pair_list n -- car | cdr )
  dat("DUP", ">R", "ABSOLUTE");
  dat(">R", "(JMP)", "uFork_ndeep_l1");
  def("uFork_ndeep_l0");
  dat("uFork_cdr");
  def("uFork_ndeep_l1");
  dat("(NEXT)", "uFork_ndeep_l0");
  dat("R>", "DUP", "(BRZ)", "(DROP)");
  dat("0<", "(BRZ)", "uFork_cdr");
  dat("(JMP)", "uFork_car");
  

  def("uFork_pop");       // ( kont -- item )
  dat("DUP", ">R");       // ( kont ) R:( kont )
  dat("uFork_sp@");       // ( stack ) R:( kont )
  dat("DUP");             // ( stack stack ) R:( kont )
  dat("uFork_carAndCdr"); // ( stack item next_stack ) R:( kont )
  dat("R>");              // ( stack item next_stack kont ) R:( )
  dat("uFork_sp!");       // ( stack item )
  dat("SWAP");            // ( item stack )
  dat("uFork_free");      // ( item )
  dat("EXIT");

  def("uFork_push_bool"); // ( kont bool -- kont )
  dat(">R", "uFork_#f", "uFork_#t", "R>", "?:"); // ( kont uFork_bool )
  dat("OVER", "(JMP)", "uFork_push");
  
  
  def("uFork_instr_nop"); // ( kont ip opcode -- )
  dat("DROP");            // ( kont ip )
  def("uFork_instr__common_tail"); // ( kont ip -- )
  dat("qz@", "SWAP", "qt!"); // advance the ip of the kontinuation
  dat("EXIT");

  def("uFork_instr_push"); // ( kont ip opcode -- )
  dat("DROP");             // ( kont ip )
  // todo: insert sponsor mem fuel check&burn here
  dat("qy@");              // ( kont item )
  dat("OVER");             // ( kont item kont )
  dat("uFork_push");       // ( kont )
  def("uFork_instr__common_longer_tail"); // ( kont -- )
  dat("DUP", "qt@");       // ( kont ip )
  dat("(JMP)", "uFork_instr__common_tail");

  def("uFork_instr_dup"); // ( kont ip opcode )
  dat("DROP");            // ( kont ip )
  dat("qy@");             // ( kont n )
  // todo: insert fixnum type check here for n
  // todo: insert allot fuel check&burn here taking n into consideration
  dat("uFork_fixnum2int", ">R");          // ( kont ) R:( n )
  dat("DUP", "uFork_sp@", "uForm_allot"); // ( kont stack tmp ) R:( n )
  dat("DUP", "R>", "SWAP", ">R", ">R");   // ( kont stack tmp ) R:( tmp1st n )
  dat("(JMP)", "uFork_instr_dup_l1");
  def("uFork_instr_dup_l0"); // ( kont tmp stack )
  dat("OVER");         // ( kont stack tmp stack )
  dat("uForm_car");    // ( kont stack tmp item  )
  dat("uFork_allot");  // ( kont stack tmp item q )                  Q:[#?, #?, <hole>, #?]
  dat("DUP", ">R");    // ( kont stack tmp item q ) R:( tmp1st n q ) Q:[#?, #?, <hole>, #?]
  dat("qx!");          // ( kont stack tmp ) R:( tmp1st n q )        Q:[#?, item, <hole>, #?]
  dat("uFork_#pair_t");
  dat("R@", "qt!");    // ( kont stack tmp ) R:( tmp1st n q )        Q:[#pair_t, item, <hole>, #?]
  dat("R@", "SWAP");   // ( kont stack q tmp ) R:( tmp1st n q )
  dat("qy!"); // fill earlier hole ( kont stack ) R:( tmp1st n q )   Q:[#pair_t, item, tmp, #?]
  dat("R>");  // ( kont stack new_tmp ) R:( tmp1st n )
  dat("SWAP", "qy@", "SWAP");
  def("uFork_instr_dup_l1");
  dat("(NEXT)", "uFork_instr_dup_l0"); // ( kont stack newest_tmp ) R:( tmp1st )
  dat("NIP"); // ( kont newest_tmp ) R:( tmp1st )
  dat("OVER"); // ( kont newest_tmp kont ) R:( tmp1st )
  dat("uFork_sp@"); // ( kont newest_tmp original_stack ) R:( tmp1st )
  dat("SWAP"); // ( kont original_stack newest_tmp ) R:( tmp1st )
  dat("qy!"); // join the two stack parts together ( kont ) R:( tmp1st )
  dat("R@");  // ( kont tmp1st ) R:( tmp1st )
  dat("qy@"); // ( kont uFork_new_tos ) R:( tmp1st )
  dat("OVER", "uFork_sp!"); // ( kont ) R:( tmp1st )
  dat("R>", "uFork_free");  // ( kont ) R:( )
  dat("(JMP)", "uFork_instr__common_longer_tail");

  def("uFork_instr_drop"); // ( kont ip opcode )
  dat("DROP");             // ( kont ip )
  dat("qy@");              // ( kont n )
  // todo: insert fixnum type tag check here
  dat(">R");               // ( kont ) R:( count )
  dat("DUP", "uFork_sp@"); // ( kont stack ) R:( count )
  dat("(JMP)", "uFork_instr_drop_l1");
  def("uFork_instr_drop_l0"); // ( kont stack ) R:( count )
  dat("DUP", "qy@", "SWAP", "uFork_free"); // ( kont next_stack ) R:( count )
  def("uFork_instr_drop_l1");
  dat("(NEXT)", "uFork_instr_drop_l0"); // ( kont nextest_stack ) R:( )
  dat("OVER", "uFork_sp!"); // ( kont )
  dat("(JMP)", "uFork_instr__common_longer_tail");

  def("uFork_instr_pick"); // ( kont ip opcode )
  dat("DROP");             // ( kont ip )
  // todo: insert here a memory fuel check&burn here
  dat("qy@");              // ( kont fixnum )
  // todo: insert isFixnum? check and sponsor signal here
  dat("uFork_fixnum2int"); // ( kont n )
  dat("DUP", "0<");        // ( kont n bool )
  dat("(BRNZ)", "uFork_instr_pick_l0"); // ( kont n )
  dat("1-", ">R");         // ( kont ) R:( count )
  dat("DUP", "uFork_sp@"); // ( kont stack ) R:( count )
  dat("(JMP)", "uFork_instr_pick_l2");
  def("uFork_instr_pick_l1"); // ( kont stack ) R:( count )
  dat("qy@"); // ( kont next_stack )
  def("uFork_instr_pick_l2"); // ( kont stack ) R:( count )
  dat("(NEXT)", "uFork_instr_pick_l1"); // ( kont stack ) R:( )
  dat("qx@");
  def("uFork__push_then_instrTail");
  dat("OVER", "uFork_push");
  dat("(JMP)", "uFork_instr__common_longer_tail");
  def("uFork_instr_pick_l0"); // ( kont -n )
  dat("NEGATE");              // ( kont n )
  dat(">R", "DUP");           // ( kont kont ) R:( n )
  dat("uFork_sp@");           // ( kont stack ) R:( n )
  dat("uFork_carAndCdr");     // ( kont item next_stack ) R:( n )
  dat("(JMP)", "uFork_instr_pick_l4");
  def("uFork_instr_pick_l3"); // ( kont item nth_next_stack ) R:( n )
  dat("uFork_cdr");
  def("uFork_instr_pick_l4"); // ( kont item nth_next_stack ) R:( n )
  dat("(NEXT)", "uFork_instr_pick_l3"); // ( kont item nth_next_stack ) R:( )
  dat("DUP", ">R");           // ( kont it nth ) R:( nth )
  dat("uFork_cdr");           // ( kont it n+1th )
  dat("uFork_cons");          // ( kont pair_quad )
  dat("R>");                  // ( kont pair_quad nth ) R:( )
  dat("qy!");  // rejigger the stack by inserting the new pair quad
  dat("(JMP)", "uFork_instr__common_longer_tail");

  def("uFork_instr_roll"); // ( kont ip opcode -- )
  dat("DROP");             // ( kont ip )
  dat("qy@");              // ( kont n_fixnum )
  // todo: insert isFixnum? check and sponsor signal here
  dat("uFork_fixnum2int"); // ( kont n )
  dat("DUP", "0<");        // ( kont n bool )
  dat("(BRNZ)", "uFork_instr_roll_l0"); // ( kont n )
  dat("1-", ">R", "DUP", "uFork_sp@");  // ( kont stack ) R:( n )
  dat("(JMP)", "uForm_instr_roll_l2");
  def("uFork_instr_roll_l1"); // ( kont stack ) R:( n )
  dat("uFork_cdr");           // ( kont next_stack ) R:( n )
  def("uFork_instr_roll_l2"); // ( kont stack ) R:( n )
  dat("(NEXT)", "uFork_instr_roll_l1"); // ( kont stack_next2target ) R:( )
  // bog standard singly linked list item removal -byrjun-
  dat("DUP");                 // ( kont n2t n2t )
  dat("uFork_cdr");           // ( kont n2t target )
  dat("DUP", ">R");           // ( kont n2t target ) R:( target )
  dat("uFork_cdr");           // ( kont n2t prev2t ) R:( target )
  dat("SWAP");                // ( kont prev2t n2t ) R:( target )
  dat("qy!", "R>");           // ( kont target )
  // -lok-
  dat("OVER", "uFork_sp@");   // ( kont target stack )
  dat("OVER", "qy!");         // ( kont target )
  dat("OVER", "uFork_sp!");   // ( kont )
  dat("(JMP)", "uFork_instr__common_longer_tail");
  def("uFork_instr_roll_l0"); // ( kont -n )
  dat("NEGATE");              // ( kont n )
  dat("OVER");                // ( kont n kont ) R:( )
  dat("uFork_sp@");           // ( kont n v1_stack ) R:( )
  dat("DUP", "uFork_cdr");    // ( kont n v1_stack v2_stack ) R:( )
  dat(">R", "SWAP", ">R");    // ( kont v1_stack ) R:( v2_stack n )
  dat("(JMP)", "uFork_instr_roll_l4");
  def("uFork_instr_roll_l3"); // ( kont vn_stack ) R:( v2_stack n )
  dat("uFork_cdr");
  def("uFork_instr_roll_l4"); // ( kont vn_stack ) R:( v2_stack n )
  dat("(NEXT)", "uFork_instr_roll_l3"); // ( kont vn_stack ) R:( v2_stack )
  dat("OVER", "uFork_sp@");   // ( kont vn_stack v1_stack )  R:( v2_stack )
  dat("OVER", "uFork_cdr");   // ( kont vn_stack v1_stack vm_stack ) R:( v2_stack )
  dat("OVER", "qy!");         // ( kont vn_stack v1_stack ) R:( v2_stack )
  dat("SWAP", "qy!");         // ( kont ) R:( v2_stack )
  dat("R>", "OVER", "uFork_sp!"); // ( kont )
  dat("(JMP)", "uFork_instr__common_longer_tail");


  def("uFork_instr_alu"); // ( kont ip opcode )
  dat("DROP", "qy@");     // ( kont subopcode )
  // todo: insert here a fixnum type check
  dat("uFork_fixnum2int");
  dat("(JMPTBL)");
  dat(13); // nr of entries
  dat("uFork_instr_alu_not");    // +0
  dat("uFork_instr_alu_and");    // +1
  dat("uFork_instr_alu_or");     // +2
  dat("uFork_instr_alu_xor");    // +3
  dat("uFork_instr_alu_add");    // +4
  dat("uFork_instr_alu_sub");    // +5
  dat("uFork_instr_alu_mul");    // +6
  dat("uFork_instr_alu_divmod"); // +7
  dat("uFork_instr_alu_lsl");    // +8
  dat("uFork_instr_alu_lsr");    // +9
  dat("uFork_instr_alu_asr");    // +10
  dat("uFork_instr_alu_rol");    // +11
  dat("uFork_instr_alu_ror");    // +12
  // todo: insert sponsor err signalling here
  dat("EXIT");

  def("uFork_instr_alu_not"); // ( kont subopcode )
  dat("DROP");
  // todo: insert fixnum type check here for TOS item
  dat("DUP", "uFork_pop");    // ( kont fixnum )
  dat("uFork_fixnum2int");    // ( kont int )
  dat("INVERT");              // ( kont ~int )
  def("uFork_instr_alu__common_tail");
  dat("uFork_int2fixnum");    // ( kont fixnum )
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_pop_two_fixnums2ints"); // ( kont -- kont uNOS_int uTOS_int )
  dat("DUP", "uFork_pop");    // ( kont uTOS_fixnum )
  dat("uFork_fixnum2int");    // ( kont uTOS_int )
  dat("OVER", "uFork_pop");   // ( kont uTOS_int uNOS_fixnum )
  dat("uFork_fixnum2int");    // ( kont uTOS_int uNOS_int )
  dat("SWAP");
  dat("EXIT");

  def("uFork_instr_alu__common"); // ( kont subopcode ) R:( raddr_spefic_alu_instr )
  dat("DROP");                    // ( kont )
  // todo: insert fixnum type check here for TOS and NOS items
  dat("uFork_pop_two_fixnums2ints"); // ( kont n m )
  dat("R>", "@EXECUTE");          // do the op
  dat("(JMP)", "uFork_instr_alu__common_tail");

  def("uFork_instr_alu_and");
  dat("uFork_instr_alu__common", "(&)");

  def("uFork_instr_alu_or");
  dat("uFork_instr_alu__common", "OR");

  def("uFork_instr_alu_xor");
  dat("uFork_instr_alu__common", "(XOR)");

  def("uFork_instr_alu_add");
  dat("uFork_instr_alu__common", "+");

  def("uFork_instr_alu_sub");
  dat("uFork_instr_alu__common", "-");

  def("uFork_instr_alu_mul");
  dat("uFork_instr_alu__common", "*");

  def("uFork_instr_alu_lsl");
  dat("uFork_instr_alu__common", "<<");

  def("uFork_instr_alu_lsr"); // ( kont subopcode )
  dat("uFork_instr_alu__common", ">>");

  def("uFork_instr_alu_asr"); // ( kont subopcode )
  dat("uFork_instr_alu__common", ">>>");

  def("uFork_instr_alu_rol"); // ( kont subopcode )
  dat("uFork_instr_alu__common", "<<>");

  def("uFork_instr_alu_ror"); // ( kont subopcode )
  dat("uFork_instr_alu__common", "<>>");

  def("uFork_instr_typeq");   // ( kont ip opcode )
  dat("DROP");                // ( kont ip )
  dat("qy@");                 // ( kont expected_type )
  // todo: insert check here for expected_type being a quad with #type_t in t field
  dat("DUP", "uFork_#fixnum_t", "="); // special case #fixnum_t check due to fixnums not being quads
  dat("(BRNZ)", "uFork_instr_typeq_l0"); // ( kont expected_type )
  dat("OVER", "uFork_pop");           // ( kont expected_type value )
  dat("qt@");
  def("uFork_instr_typeq_l2");
  dat("=");
  def("uFork_instr_typeq_l1");
  dat("uFork_push_bool"); // ( kont )
  dat("(JMP)", "uFork_instr__common_longer_tail");
  def("uFork_instr_typeq_l0");        // ( kont #fixnum_t )
  dat("DROP", "DUP", "uFork_pop");    // ( kont value )
  dat("uFork_isFixnum?");
  dat("(JMP)", "uFork_instr_typeq_l1");

  def("uFork_instr_eq");      // ( kont ip opcode )
  dat("DROP");                // ( kont ip )
  dat("qy@");                 // ( kont expected_value )
  dat("OVER", "uFork_pop");   // ( kont expected_value value )
  dat("(JMP)", "uFork_instr_typeq_l2");

  def("uFork_instr_cmp");     // ( kont ip opcode )
  dat("DROP", "qy@");         // ( kont subopcode )
  dat("(JMPTBL)");
  dat(6);
  dat("uFork_instr_cmp_eq"); // +0
  dat("uFork_instr_cmp_ge"); // +1
  dat("uFork_instr_cmp_gt"); // +2
  dat("uFork_instr_cmp_lt"); // +3
  dat("uFork_instr_cmp_le"); // +4
  dat("uFork_instr_cmp_ne"); // +5
  // todo: insert sponsor err signalling here
  dat("EXIT");

  def("uFork_pop2items"); // ( kont -- kont u v )
  dat("DUP", "uFork_pop", "OVER", "uFork_pop");
  dat("EXIT");

  def("uFork_instr_cmp_eq"); // ( kont subopcode )
  dat("DROP");
  dat("uFork_pop2items");
  dat("(JMP)", "uFork_instr_typeq_l2");

  def("uFork_instr_cmp_ne"); // ( kont subopcode )
  dat("DROP");               // ( kont )
  dat("uFork_pop2items");    // ( kont u v )
  dat("=", "INVERT", "(JMP)", "uFork_instr_typeq_l1");

  def("uFork_instr_cmp__common");    // ( kont subopcode ) R:( raddr raddr_op )
  dat("DROP");                       // ( kont )
  // todo: insert here a check if uFork TOS and NOS are fixnums
  dat("uFork_pop_two_fixnums2ints"); // ( kont NOS_int TOS_int ) R:( raddr raddr_op )
  dat("R>", "@EXECUTE", "(JMP)", "uFork_instr_typeq_l1");

  def("uFork_instr_cmp_lt");
  dat("uFork_instr_cmp__common", "<");

  def("uFork_instr_cmp_le");
  dat("uFork_instr_cmp__common", "<=");

  def("uFork_instr_cmp_ge");
  dat("uFork_instr_cmp__common", ">=");

  def("uFork_instr_cmp_gt");
  dat("uFork_instr_cmp__cpmmon", ">");

  def("uFork_instr_if");    // ( kont ip opcode -- )
  dat("DROP");              // ( kont ip )
  dat("OVER", "uFork_pop"); // ( kont ip booly )
  dat("uFork_#f", "OVER");  // ( kont ip booly #f booly )
  dat("ZERO", "uFork_int2fixnum", "=", "?:"); // ( kont ip booly2 )
  dat("uFork_#f", "OVER");  // ( kont ip booly2 #f booly2 )
  dat("uFork_()", "=", "?:"); // ( kont ip booly3 )
  dat("uFork_#f", "OVER");  // ( kont ip booly3 #f booly3 )
  dat("uFork_#?", "=", "?:"); // ( kont ip booly4 )
  dat("uFork_#f", "=", "(BRNZ)", "uFork_instr__common_tail"); // ( kont ip )
  dat("qy@");               // ( kont true_path )
  def("uFork_instr_if_l0");
  dat("OVER", "qt!", "EXIT");

  def("uFork_instr_jump");  // ( kont ip opcode )
  dat("2DROP");             // ( kont )
  dat("DUP", "uFork_pop");  // ( kont k )
  dat("(JMP)", "uFork_instr_if_l0");

  def("uFork_instr_pair"); // ( kont ip opcode )
  dat("DROP");             // ( kont ip )
  dat("qy@");              // ( kont n_fixnum )
  // todo: insert here a sponsor mem fuel check&burn. Fuel usage: 1
  // todo: insert here a TOS fixnum check
  dat("uFork_fixnum2int"); // ( kont n )
  dat("DUP", "-1", "=", "(BRNZ)", "uFork_instr_pair_l0");
  dat("1-", "NEGATE", "OVER", "uFork_sp@", "SWAP", "uFork_ndeep"); // ( kont stack@n-1 )
  dat("DUP", "uFork_cdr", "SWAP", "uFork_()", "SWAP", "qy!"); // ( kont stack@n+1 )
  dat("OVER", "uFork_sp@");  // ( kont stack@n+1 stack )
  dat("SWAP");
  def("uFork_instr_pair_l1");
  dat("uFork_cons"); // ( kont pair )
  dat("OVER", "uFork_sp!");  // ( kont )
  dat("(JMP)", "uFork_instr__common_longer_tail");
  def("uFork_instr_pair_l0"); // ( kont -1 )
  dat("DROP");                // ( kont )
  dat("DUP", "uFork_sp@");    // ( kont stack )
  dat("uFork_()");            // ( kont pair )
  dat("(JMP)", "uFork_instr_pair_l1");

  def("uFork_copy_pairlist_until_n"); // ( pair n -- new_tailend new_headend )
  dat("uFork_allot");      // ( pair n q ) R:( )
  dat("DUP", ">R");        // ( pair n q ) R:( headend )
  dat("SWAP", ">R");       // ( pair q ) R:( headend n )
  dat("(JMP)", "uFork_copy_pairlist_until_n_l1");
  def("uFork_copy_pairlist_until_n_l0"); // ( pair q ) R:( headend n )
  dat("SWAP");            // ( q pair )
  dat("uFork_carAndCdr"); // ( q item next )
  dat(">R");              // ( q item ) R:( headend n next )
  dat("OVER");            // ( q item q )
  dat("qx!");             // ( q )
  dat("uFork_#pair_t", "OVER", "qt!"); // ( q )
  dat("uFork_#?", "OVER", "qz!");      // ( q )
  dat("uFork_allot", "DUP", ">R");     // ( q new_q ) R:( headend n next new_q )
  dat("SWAP", "qy!", "R>");            // ( new_q )   R:( headend n next )
  dat("R>", "SWAP");                   // ( next new_q ) R:( headend n )
  def("uFork_copy_pairlist_until_n_l1");
  dat("(NEXT)", "uFork_copy_pairlist_until_n_l0"); // ( nextest tailend )
  dat("NIP", "R>");                    // ( tailend headend )
  dat("EXIT");

  def("uFork_pairlist_length"); // ( pair -- n )
  dat("ZERO", "SWAP");          // ( n pair )
  def("uFork_pairlist_length_l0");
  dat("DUP", "uFork_()", "=", "(BRNZ)", "(DROP)");
  dat("uFork_cdr", "SWAP", "1+", "SWAP");
  dat("(JMP)", "uFork_pairlist_length_l0");
  
  def("uFork_instr_part"); // ( kont ip opcode )
  dat("DROP");             // ( kont ip )
  dat("qy@");              // ( kont n_fixnum? )
  // todo: insert here a check to see if TOS value is a pair
  // todo: insert fixnum check here
  dat("uFork_fixnum2int"); // ( kont n )
  // todo: insert here sponsor mem fuel check&burn
  dat("DUP", "0<", "(BRNZ)", "uFork_instr_part_l0"); // ( kont n )
  dat("OVER", "uFork_pop");
  def("uFork_instr_part_l1");
  dat("SWAP");                    // ( kont pair n )
  dat("uFork_copy_pairlist_until_n"); // ( kont new_tailend new_headend )
  dat(">R", "OVER", "uFork_sp@"); // ( kont new_tailend stack ) R:( new_headend )
  dat("SWAP", "qy!", "R>");       // ( kont new_headend ) R:( )
  dat("OVER", "uFork_sp!");       // ( kont )
  dat("(JMP)", "uFork_instr__common_longer_tail");
  def("uFork_instr_part_l0"); // ( kont -n )
  dat("-1", "=", "(BRNZ)", "uFork_instr_part_l2");
  dat("DROP");                // ( kont -1 )
  dat("DUP");                 // ( kont kont )
  dat("uFork_pop", "DUP");    // ( kont pair pair )
  dat("uFork_pairlist_length"); // ( kont pair n )
  dat("(JMP)", "uFork_instr_part_l1");
  def("uFork_instr_part_l2"); // ( kont -n )
  // todo: insert err signal to sponsor here
  dat("uFork_HARDHALT");

  def("uFork_instr_nth"); // ( kont ip opcode )
  dat("DROP");            // ( kont ip )
  dat("qy@");             // ( kont n_fixnum )
  // todo: insert here a fixnum check for the immediate param of the uFork instr
  dat("uFork_fixnum2int");  // ( kont n )
  dat("OVER", "uFork_pop"); // ( kont n pairlist )
  def("uFork_instr_nth_l0");
  dat("SWAP");              // ( kont pairlist n )
  dat("uFork_ndeep");       // ( kont item|tail )
  dat("(JMP)", "uFork__push_then_instrTail");

  //  t        x    y      z
  // [#dict_t, key, value, next]
  
  def("uFork_dict_forEach"); // ( dict -- ) R:( raddr )
  dat("R>", "DUP", "1+", ">R", ">R"); // ( dict ) R:( raddr+1 xt )
  def("uFork_dict_forEach_l0");
  dat("R@",  "@EXECUTE");    // ( dict ) R:( raddr+1 xt )
  dat("qz@");                // ( next ) R:( raddr+1 xt )
  dat("DUP", "uFork_()", "=", "OVER", "uFork_#?", "=", "OR");
  dat("(BRZ)", "uFork_dict_forEach_l0");
  dat("DROP", "R>", "DROP", "EXIT");
  def("uFork_dict_forEach_exitEarly"); // ( dict -- ) R:( raddr+1_forEachCaller xt raddr_xt raddr )
  dat("DROP", "RDROP", "RDROP", "RDROP", "EXIT");

  def("uFork_dict_size"); // ( dict -- n )
  dat("ZERO", "SWAP");    // ( n dict )
  dat("uFork_dict_forEach", "uFork_dict_size_l0"); // ( n )
  dat("EXIT");
  def("uFork_dict_size_l0"); // ( n dict -- n+1 dict )
  dat("SWAP", "1+", "SWAP", "EXIT");
  
  
  def("uFork_instr_dict"); // ( kont ip opcode -- )
  dat("DROP");             // ( kont ip )
  dat("qy@");              // ( kont subopcode )
  dat("(JMPTBL)", 5);
  dat("uFork_instr_dict_has");
  dat("uFork_instr_dict_get");
  dat("uFork_instr_dict_add");
  dat("uFork_instr_dict_set");
  dat("uFork_instr_dict_del");
  // todo: insert here err signalling
  dat("EXIT");

  def("uFork_dict_has");  // ( key dict -- bool )
  dat("FALSE", "-ROT");   // ( bool key dict )
  dat("uFork_dict_forEach", "uFork_dict_has_l0"); // ( bool key )
  dat("DROP", "EXIT");
  def("uFork_dict_has_l0"); // ( bool key dict -- bool key dict )
  dat("DUP", ">R", "qx@");  // ( bool key dkey ) R:( dict )
  dat("OVER", "=", "ROT");  // ( key dbool bool ) R:( dict )
  dat("OR", "SWAP", "R>");  // ( bool key dict ) R:( )
  dat("EXIT");

  def("uFork_dict_count_until"); // ( dict key -- count )
  dat("SWAP");
  dat("ZERO", "-ROT");           // ( 0 key dict )
  dat("uFork_dict_forEach");
  dat("uFork_dict_count_until_l0"); // ( count key )
  dat("DROP", "EXIT");
  def("uFork_dict_count_until_l0"); // ( count key dict -- count key dict )
  // note: exits early
  dat("2DUP");                 // ( count key dict key dict )
  dat("qx@", "=");             // ( count key dict bool )
  dat("(BRZ)", "uFork_dict_count_until_l1");
  dat("uFork_dict_forEach_exitEarly", "EXIT");
  def("uFork_dict_count_until_l1"); // ( count key dict )
  dat("ROT", "1+", "-ROT", "EXIT");

  def("uFork_dict_del"); // ( key dict -- dict' )
  dat("2DUP", "uFork_dict_has"); // ( key dict bool )
  dat("(BRZ)", "NIP");           // ( key dict )
  dat("uFork_allot");            // ( key old_dict new_dict )
  dat("DUP", ">R");              // ( key old_dict new_dict ) R:( dict' )
  dat("-ROT");                   // ( new_dict key old_dict ) R:( dict' )
  def("uFork_dict_del_l0");      // ( new_dict key old_dict ) R:( dict' )
  dat("2DUP", "qx@", "=");       // ( new_dict key old_dict bool ) R:( dict' )
  dat("(BRNZ)", "uFork_dict_del_l1"); // ( new_dict key old_dict ) R:( dict' )
  dat("ROT");                    // ( key old_dict new_dict ) R:( dict' )
  dat("uFork_allot");            // ( key old_dict new_dict new_dict' ) R:( dict' )
  dat("SWAP", "2DUP", "qz!");    // ( key old_dict new_dict' new_dict ) R:( dict' )
  dat("DROP");                   // ( key old_dict new_dict ) R:( dict' )
  dat("OVER");                   // ( key old_dict new_dict' old_dict ) R:( dict' )
  dat("qx@");                    // ( key old_dict new_dict' entry_key ) R:( dict' )
  dat("OVER");                   // ( key old_dict new_dict' entry_key new_dict ) R:( dict' )
  dat("qx!");                    // ( key old_dict new_dict' ) R:( dict' )
  dat("OVER", "qy@");            // ( key old_dict new_dict' entry_value ) R:( dict' )
  dat("OVER", "qy!");            // ( key old_dict new_dict' ) R:( dict' )
  dat("uFork_#dict_t");          // ( key old_dict new_dict' #dict_t ) R:( dict' )
  dat("OVER", "qt!");            // ( key old_dict new_dict' ) R:( dict' )
  dat("-ROT");                   // ( q key old_dict_next ) R:( dict' )
  dat("(JMP)", "uFork_dict_del_l0");
  def("uFork_dict_del_l1"); // ( new_dict key old_dict ) R:( dict' )
  dat("NIP", "qz@");        // ( new_dict old_dict_next ) R:( dict' )
  dat("SWAP", "qz!");       // ( ) R:( dict' )
  dat("R>", "DUP", "qz@", "SWAP", "uFork_free", "EXIT");

  def("uFork_instr_dict_has"); // ( kont subopcode )
  dat("DROP");                 // ( kont )
  // todo: insert here a check that uFork NOS is of #dict_t
  dat("DUP", "uFork_pop");     // ( kont key )
  dat("OVER", "uFork_pop");    // ( kont key dict )
  dat("uFork_dict_has");       // ( kont bool )
  dat("(JMP)", "uFork_instr_typeq_l1");

  def("uFork_instr_dict_get"); // ( kont subopcode )
  dat("DROP");                 // ( kont )
  // todo: insert here a check that uFork NOS is of #dict_t
  dat("DUP", "uFork_pop");     // ( kont key )
  dat("OVER", "uFork_pop");    // ( kont key dict )
  dat("2DUP", "uFork_dict_has"); // ( kont key dict bool )
  dat("(BRZ)", "uFork_instr_dict_get_l0"); // ( kont key dict )
  dat("uFork_dict_forEach", "uFork_instr_dict_get_l1"); // ( kont value )
  dat("(JMP)", "uFork__push_then_instrTail");
  def("uFork_instr_dict_get_l0"); // ( kont key dict )
  dat("2DROP");
  def("uFork__push_#?_then_instrTail");
  dat("uFork_#?", "(JMP)", "uFork__push_then_instrTail");
  def("uFork_instr_dict_get_l1"); // ( key dict -- key dict | value )
  // note: this will exit early
  dat("2DUP", "qx@", "=");        // ( key dict bool )
  dat("(BRZ)", "uFork_instr_dict_get_l2"); // ( key dict )
  dat("NIP", "qy@", "uFork_dict_forEach_exitEarly");
  def("uFork_instr_dict_get_l2")
  dat("EXIT");

  def("uFork_instr_dict_add"); // ( kont subopcode )
  dat("DROP");                 // ( kont )
  // todo: insert here check that ÞOS (Þird On Stack) is of #dict_t
  // todo: insert here sponsor mem fuel check&burn: 1 quad usage
  def("uFork_instr_dict_add_l0"); // ( kont )
  dat("uFork_allot");          // ( kont q )
  dat("uFork_#pair_t");        // ( kont q #pair_t )
  dat("OVER", "qt!");          // ( kont q )
  dat("OVER", "uFork_pop");    // ( kont q value )
  dat("OVER", "qy!");          // ( kont q )
  dat("OVER", "uFork_pop");    // ( kont q key )
  dat("OVER", "qx!");          // ( kont q )
  dat("OVER", "uFork_pop");    // ( kont q dict )
  dat("OVER", "qz!");          // ( kont q )
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_dict_set"); // ( kont subopcode )
  dat("DROP");                 // ( kont )
  // todo: insert here check that ÞOS (Þird On Stack) is of #dict_t
  // todo: insert here sponsor mem fuel check&burn: 1 quad usage + n head copy
  dat("DUP", "uFork_pop", ">R"); // ( kont ) R:( value )
  dat("DUP", "uFork_pop");       // ( kont key ) R:( value )
  dat("OVER", "uFork_pop");      // ( kont key dict ) R:( value )
  dat("2DUP", "uFork_dict_del"); // ( kont key dict dict' ) R:( value )
  dat("NIP");                    // ( kont key dict' ) R:( value )
  dat("SWAP", ">R", "OVER");     // ( kont dict' kont ) R:( value key )
  dat("uFork_push");             // ( kont ) R:( value key )
  dat("R>", "OVER", "uFork_push"); // ( kont ) R:( value )
  dat("R>", "OVER", "uFork_push"); // ( kont ) R:( )
  dat("(JMP)", "uFork_instr_dict_add_l0");

  def("uFork_instr_dict_del"); // ( kont subopcode )
  dat("DROP");                 // ( kont )
  // todo: insert here check that NOS is of #dict_t
  // todo: insert here sponsor mem fuel check&burn
  dat("DUP", "uFork_pop", "OVER", "uFork_pop");
  dat("uFork_dict_del");
  dat("(JMP)", "uFork__push_then_instrTail");

  // deque gagnabygging: [#pair_t, fram, bak, #?]
  // þar sem fram og bak eru par listar hver
  // bankers todo algorithm

  def("uFork_deque_new"); // ( -- deque )
  dat("uFork_allot");     // ( q )
  dat("uFork_#pair_t", "OVER", "qt!");
  dat("uFork_()",      "OVER", "qx!");
  dat("uFork_()",      "OVER", "qy!");
  dat("uFork_#?",      "OVER", "qz!");
  dat("EXIT");

  def("uFork_deque_frá_bak_til_fram"); // ( deque -- deque' )
  dat("uFork_carAndCdr");              // ( fram bak )
  def("uFork_deque_frá_bak_til_fram_l0"); // ( fram bak )
  dat("uFork_carAndCdr", ">R");        // ( fram item ) R:( bak_next )
  dat("SWAP", "uFork_cons");           // ( fram' ) R:( bak_next )
  dat("R>", "DUP");                    // ( fram' bak_next bak_next )
  dat("uFork_()", "=", "OVER");        // ( fram' bak_next bool bak_next )
  dat("uFork_#?", "=", "OR");          // ( fram' bak_next bool )
  dat("(BRZ)", "uFork_deque_frá_bak_til_fram_l0");
  dat("uFork_cons", "EXIT");

  def("uFork_deque_empty?");    // ( deque -- bool )
  dat("uFork_carAndCdr");       // ( fram bak )
  dat("uFork_pairlist_length"); // ( fram bak_lengd )
  dat("0=");                    // ( bool )
  dat("SWAP");                  // ( bool fram )
  dat("uFork_pairlist_length"); // ( bool fram_lengd )
  dat("0=");                    // ( bool bool )
  dat("&", "EXIT");

  def("uFork_deque_push");      // ( value deque -- deque )
  dat("uFork_carAndCdr");       // ( value fram bak )
  dat(">R");                    // ( value fram ) R:( bak )
  dat("uFork_cons");            // ( fram' ) R:( bak )
  dat("R>");                    // ( fram' bak ) R:( )
  dat("uFork_cons", "EXIT");    // ( deque' )

  def("uFork_deque_pop");       // ( deque -- deque' value )
  dat("uFork_carAndCdr");       // ( fram bak )
  dat("OVER");
  dat("uFork_pairlist_length"); // ( fram bak fram_lengd )
  dat("0=");
  dat("(BRZ)", "uFork_deque_pop_l0"); // ( fram bak )
  dat("DUP");
  dat("uFork_pairlist_length");       // ( fram bak bak_lengd )
  dat("0=");
  dat("(BRZ)", "uFork_deque_pop_l1");
  dat("uFork_cons", "uFork_#?", "EXIT");
  def("uFork_deque_pop_l1");
  dat("uFork_deque_frá_bak_til_fram_l0"); // ( deque' )
  dat("uFork_carAndCdr");             // ( fram bak )
  def("uFork_deque_pop_l0");          // ( fram bak )
  dat("SWAP");                        // ( bak fram )
  dat("uFork_carAndCdr");             // ( bak value fram' )
  dat("SWAP", ">R", "SWAP");          // ( fram' bak ) R:( value )
  dat("uFork_cons", "R>");            // ( deque' value ) R:( )
  dat("EXIT");

  def("uFork_deque_put"); // ( value deque -- deque' )
  dat("uFork_carAndCdr"); // ( value fram bak )
  dat("SWAP", ">R");      // ( value bak ) R:( fram )
  dat("uFork_cons");      // ( bak' ) R:( fram )
  dat("R>", "SWAP");      // ( fram bak' ) R:( )
  dat("uFork_cons");
  dat("EXIT");

  def("uFork_deque_swap"); // ( deque -- deque' )
  dat("uFork_carAndCdr");  // ( fram bak )
  dat("SWAP");
  dat("uFork_cons");
  dat("EXIT");

  def("uFork_deque_pull"); // ( deque -- deque' value )
  dat("uFork_deque_swap"); // ( deque_swapped )
  dat("uFork_deque_pop");  // ( deque_swapped' value )
  dat("SWAP");             // ( value deque_swapped' )
  dat("uFork_deque_swap"); // ( value deque' )
  dat("SWAP");             // ( deque' value )
  dat("EXIT");

  def("uFork_deque_length"); // ( deque -- n )
  dat("uFork_carAndCdr");    // ( fram bak )
  dat("uFork_pairlist_length");
  dat("SWAP");
  dat("uFork_pairlist_length");
  dat("+");
  dat("EXIT");

  def("uFork_instr_deque"); // ( kont ip opcode )
  dat("DROP");              // ( kont ip )
  dat("qy@");               // ( kont subopcode_fixnum )
  // todo: insert here a fixnum type check
  dat("uFork_fixnum2int");  // ( kont subopcode )
  dat("(JMPTBL)", 7);       //
  dat("uFork_instr_deque_new");
  dat("uFork_instr_deque_empty");
  dat("uFork_instr_deque_push");
  dat("uFork_instr_deque_pop");
  dat("uFork_instr_deque_put");
  dat("uFork_instr_deque_pull");
  dat("uFork_instr_deque_len");
  // todo: insert here an err signal to sponsor
  dat("EXIT");

  def("uFork_instr_deque_new"); // ( kont subopcode )
  dat("DROP");                  // ( kont )
  // todo: insert here sponsor mem fuel check&burn: 1 quad spent
  dat("uFork_deque_new");
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_deque_empty"); // ( kont subopcode )
  dat("DROP");                    // ( kont )
  // todo: insert here a check that TOS is a deque
  dat("DUP", "uFork_pop", "uFork_deque_empty");
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_deque_push"); // ( kont supopcode )
  dat("DROP");                   // ( kont )
  // todo: insert here a check that NOS is a deque
  // todo: insert here sponsor mem fuel check&burn: 2 quads
  dat("DUP");                    // ( kont kont )
  dat("uFork_pop");              // ( kont value )
  dat("OVER", "uFork_pop");      // ( kont value deque )
  dat("uFork_deque_push");       // ( kont deque' )
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_deque_pop");   // ( kont subopcode )
  dat("DROP");                    // ( kont )
  // todo: insert here a check that TOS is a deque
  dat("DUP", ">R");
  dat("DUP", "uFork_pop");        // ( kont deque )
  dat("uFork_deque_pop");         // ( kont deque' value )
  dat("SWAP");                    // ( kont value deque' )
  dat("R>", "uFork_push");        // ( kont value )
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_deque_put");  // ( kont supopcode )
  dat("DROP");                   // ( kont )
  // todo: insert here a check that NOS is a deque
  // todo: insert here sponsor mem fuel check&burn: 2 quads
  dat("DUP");                    // ( kont kont )
  dat("uFork_pop");              // ( kont value )
  dat("OVER", "uFork_pop");      // ( kont value deque )
  dat("uFork_deque_put");        // ( kont deque' )
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_deque_pull");  // ( kont subopcode )
  dat("DROP");                    // ( kont )
  // todo: insert here a check that TOS is a deque
  dat("DUP", ">R");
  dat("DUP", "uFork_pop");        // ( kont deque )
  dat("uFork_deque_pull");        // ( kont deque' value )
  dat("SWAP");                    // ( kont value deque' )
  dat("R>", "uFork_push");        // ( kont value )
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_deque_length"); // ( kont subopcode )
  dat("DROP");                    // ( kont )
  // todo: insert here a check that TOS is a deque
  dat("DUP", "uFork_pop", "uFork_deque_length");
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_quad"); // ( kont ip opcode )
  dat("DROP");             // ( kont ip )
  dat("qy@");              // ( kont n_fixnum )
  // todo: insert here a fixnum typecheck
  dat("uFork_fixnum2int"); // ( kont n )
  dat("DUP", "0<", "(BRNZ)", "uFork_instr_quad_access");
  dat("DUP", "4", ">", "(BRZ)", "uFork_instr_quad_l0");
  // todo: insert here an error signal to sponsor
  def("uFork_instr_quad_l0"); // ( kont n )
  dat("OVER", ">R");          // ( kont n ) R:( kont )
  dat("uFork_allot", "SWAP"); // ( kont q n ) R:( kont )
  dat("1-", "SWAP", "R@", "uFork_pop", "OVER", "qt!", "SWAP");
  dat("DUP", "1", ">", "(BRZ)", "uFork_instr_quad_l1");
  dat("1-", "SWAP", "R@", "uFork_pop", "OVER", "qx!", "SWAP");
  dat("DUP", "1", ">", "(BRZ)", "uFork_instr_quad_l1");
  dat("1-", "SWAP", "R@", "uFork_pop", "OVER", "qy!", "SWAP");
  dat("DUP", "1", ">", "(BRZ)", "uFork_instr_quad_l1");
  dat("1-", "SWAP", "R@", "uFork_pop", "OVER", "qz!", "SWAP");
  def("uFork_instr_quad_l1"); // ( kont q 0 ) R:( kont )
  dat("R>", "2DROP");
  dat("(JMP)", "uFork__push_then_instrTail");
  def("uFork_instr_quad_access"); // ( kont -n )
  dat("NEGATE");                  // ( kont n )
  // todo: insert here a check for that uFork TOS is not a fixnum nor a capability
  dat("DUP", "4", ">", "(BRZ)", "uFork_instr_quad_l2");
  // todo: insert here error signalling to sponsor
  def("uFork_instr_quad_l2");     // ( kont n )
  dat("OVER", "uFork_pop");       // ( kont n q )
  dat("SWAP");                    // ( kont q n )
  dat("DUP", "4", "=", "(BRZ)", "uFork_instr_quad_l3");
  dat("1-", ">R", "2DUP", "SWAP", "qz@", "SWAP", "uFork_push", "R>");
  def("uFork_instr_quad_l3");
  dat("DUP", "3", "=", "(BRZ)", "uFork_instr_quad_l4");
  dat("1-", ">R", "2DUP", "SWAP", "qy@", "SWAP", "uFork_push", "R>");
  def("uFork_instr_quad_l4");
  dat("DUP", "2", "=", "(BRZ)", "uFork_instr_quad_l5");
  dat("1-", ">R", "2DUP", "SWAP", "qx@", "SWAP", "uFork_push", "R>");
  def("uFork_instr_quad_l5");
  dat("1-", ">R", "2DUP", "SWAP", "qt@", "SWAP", "uFork_push", "R>");
  dat("2DROP");
  dat("(JMP)", "uFork_instr__common_longer_tail");

  def("uFork_instr_msg"); // ( kont ip opcode )
  dat("DROP");            // ( kont ip )
  dat("qy@");             // ( kont n_fixnum )
  // todo: insert here a fixnum typecheck
  dat("uFork_fixnum2int"); // ( kont n )
  dat("OVER", "qy@", "qy@"); // ( kont n msg )
  dat("(JMP)", "uFork_instr_nth_l0");

  def("uFork_instr_state"); // ( kont ip opcode )
  dat("DROP");            // ( kont ip )
  dat("qy@");             // ( kont n_fixnum )
  // todo: insert here a fixnum typecheck
  dat("uFork_fixnum2int"); // ( kont n )
  dat("OVER", "qy@", "qx@", "qy@");
  dat("(JMP)", "uFork_instr_nth_l0");

  def("uFork_instr_my"); // ( kont ip opcode )
  dat("DROP");           // ( kont ip )
  dat("qy@");            // ( kont subopcode )
  // todo: insert here a fixnum type check
  dat("uFork_fixnum2int");
  dat("(JMPTBL)", 3);
  dat("uFork_instr_my_self");  // +0
  dat("uFork_instr_my_beh");   // +1
  dat("uFork_instr_my_state"); // +2
  // todo: insert here error signalling to sponsor
  dat("EXIT");

  def("uFork_instr_my_self"); // ( kont subopcode )
  dat("DROP");                // ( kont )
  dat("DUP");                 // ( kont kont )
  dat("qy@");                 // ( kont ep )
  dat("qx@");                 // ( kont actor )
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_my_beh"); // ( kont subopcode )
  dat("DROP");
  dat("DUP", "qy@", "qx@", "qx@");
  dat("(JMP)", "uFork__push_then_instrTail");



  // todo: sponsor <peek> instruction
  //       þar sem <peek> er capability og ekki fixnum
  

  def("uFork_instr__subroutine_call"); // ( kont ip opcode -- )
  if (uForkSubroutines) {
    dat("DROP"); // ( kont ip )
    // todo: insert allot fuel check&burn here
    dat("DUP", "qz@", ">R"); // ( kont ip ) R:( next_ip )
    dat("qy@", "OVER");      // ( kont subr_ip kont ) R:( next_ip )
    dat("qt!");              // ( kont ) R:( next_ip )
    dat("R>");               // ( kont next_ip ) R:( )
    dat("OVER");             // ( kont next_ip kont )
    dat("uFork_rp@");        // ( kont next_ip uFork_rp )
    dat("uFork_cons");       // ( kont uFork_new_rp )
    dat("SWAP", "uFork_rp!");
    dat("EXIT");
  } else {
    dat("(JMP)", "uFork_no_such_opcode");
  }

  def("uFork_instr__subroutine_exit"); // ( kont ip opcode -- )
  if (uForkSubroutines) {
    dat("2DROP");     // ( kont ) 2DROP because there is no next_ip in ip
    dat("DUP");       // ( kont kont )
    dat("uFork_rp@"); // ( kont uFork_rstack )
    dat("DUP");       // ( kont uFork_rstack uFork_rstack )
    dat("qx@");       // ( kont uFork_rstack resume_ip )
    dat(">R");        // ( kont uFork_rstack ) R:( resume_ip )
    dat("DUP");       // ( kont uFork_rstack uFork_rstack ) R:( resume_ip )
    dat("qy@");       // ( kont uFork_rstack uFork_next_rstack ) R:( resume_ip )
    dat(">R");        // ( kont uFork_rstack ) R:( resume_ip uFork_next_rstack )
    dat("uFork_free"); // ( kont ) R:( resume_ip uFork_next_rstack )
    dat("R>");        // ( kont uFork_next_rstack ) R:( resume_ip )
    dat("OVER");      // ( kont uFork_next_rstack kont ) R:( resume_ip )
    dat("uFork_rp!"); // ( kont ) R:( resume_ip )
    dat("R>");        // ( kont resume_ip ) R:( )
    dat("SWAP");      // ( resume_ip kont )
    dat("qt!");       // ( )
    dat("EXIT");
  } else {
    dat("(JMP)", "uFork_no_such_opcode");
  }

  def("uFork_instr__rpush"); // ( kont ip opcode )
  if (uForkSubroutines) {
    dat("2DROP");            // ( kont )
    dat("DUP");              // ( kont kont )
    dat("uFork_pop");        // ( kont item )
    dat("OVER");             // ( kont item kont )
    dat("uFork_rpush");      // ( kont )
    dat("(JMP)", "uFork_instr__common_longer_tail");
  } else {
    dat("(JMP)", "uFork_no_such_opcode");
  }

  def("uFork_instr__rpop"); // ( kont ip opcode )
  if (uForkSubroutines) {
    dat("2DROP");            // ( kont )
    dat("DUP");              // ( kont kont )
    dat("uFork_rpop");       // ( kont item )
    dat("OVER");             // ( kont item kont )
    dat("uFork_push");      // ( kont )
    dat("(JMP)", "uFork_instr__common_longer_tail");
  } else {
    dat("(JMP)", "uFork_no_such_opcode");
  }

  // this definition must be the last one
  def("uFork_last_ucode_address");
  
  return asm;
};

export default Object.freeze({
  uFork
});
/* tbd: 
   quad encoded chunked overlay protocol:
     instead of #instr_t in t field of first quad we have an closely held
     type quad we call here #ucode_load_t
         
     1st [#ucode_load_t, 
          ucode_program_memory_address_fixnum,
          chunk_size_fixnum,
          next]
      nth [payload1_fixnum, payload2_fixnum, payload3_fixnum, next]

      next eather points to next payload quad or next instruction

      if chunk_size is zero then call the ucode_program_memory_address

   tbd: priviledged ucode backdoor call
     instead of #instr_t in t field of first quad we have an closely held
     type quad we call here #ucode_backdoor_call_t

     [#ucode_backdoor_call_t, ucode_addr_fixnum, #?, next_instr]

 */

/* tbd:
     möguleiki á að búa til actor þar sem sp bendir ekki á stack heldur á
     quad þar sem z field bendir á
       [debugger_sponsor, debugger, #?, #?]
     ef anonomulous staða kemur upp þá er þetta notað til að senda event boð til
     debugger á forminu:
       [debugger_sponsor, debugger, msg, #?]
                                    |
                                    V
                                 [resume_cap, afrit_af_faulting_continuation, #?, #?]
   resume_cap er capability sem bendir a psuedo-actor sem býst við event boði
   þar sem msg er nýja instruction pointer fyrir það continuation
*/
