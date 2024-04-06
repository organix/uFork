// @ts-check js
/**
 * @use JSDoc
 * @overview Implements the uFork instructionset in microcode
 * @author Zarutian
 */
// using uFork/docs/vm.md as reference
//   as that is a bit incomplete use uFork/vm/rs/src/any.rs as suppliment
// also using uFork/docs/sponsor.md as reference

import { uFork_quadmem_and_gc } from "./uFork_quadmem.js";

export const uFork = (asm) => {
  asm.def("meta_hereBeyondEnd", asm.incr("uFork_last_ucode_address", 0x0000));
  asm = uFork_quadmem_and_gc(asm);
  const { def, dat, isDefined } = asm;

  const hwImplOfQuadMemory =           isDefined("instrset_w/qmem");
  const hwImplOfQuadMemoryGC =         isDefined("instrset_w/hwgc");
  const hwImplOfQuadAllotAndFree =     hwImplOfQuadMemoryGC;
  
  if (!isDefined("uFork_eventQueueAndKontQueue_qaddr")) {
    def("uFork_eventQueueAndKontQueue_qaddr", 0x4001);
  }
  if (!isDefined("uFork_memoryDescriptor_qaddr")) {
    def("uFork_memoryDescriptor_qaddr", 0x4000);
  }
  const maxTopOfQuadMemory =           0x5000;
  def("meta_quadMemSize_in_quads", asm.deferedOp.minus(maxTopOfQuadMemory, "uFork_memoryDescriptor_qaddr"));
  const uForkSubroutines =             isDefined("uFork_subroutines_support");

  def("uFork_doOneRunLoopTurn"); // ( -- )
  dat("uFork_checkPendingInterrupts"); // ( -- )
  dat("uFork_dispatchOneEvent"); // ( -- )
  dat("uFork_doOneInstrOfContinuation"); // ( -- )
  dat("uFork_gcOneStep"); // ( -- )
  dat("EXIT");

  def("uFork_daliclock_count");
  dat("(VAR)", 0x0000, 0x0000);

  def("uFork_daliclock_tick");  // ( -- )
  dat("uFork_daliclock_count"); // ( ucode_addr )
  dat("1+");                    // ( ucode_addr+1 )
  dat("@");                     // ( count_lower )
  dat("1+");                    // ( count_lower+1 )
  dat("DUP");                   // ( count_lower+1 count_lower+1 )
  dat("uFork_daliclock_count"); // ( count_lower+1 count_lower+1 ucode_addr )
  dat("1+");                    // ( count_lower+1 count_lower+1 ucode_addr+1 )
  dat("!");                     // ( count_lower+1 )
  dat("(BRZ)", "uFork_daliclock_tick_l0");
  dat("EXIT");
  def("uFork_daliclock_tick_l0");
  dat("uFork_daliclock_count", "@", "1+", "uFork_daliclock_count", "!", "EXIT");

  def("uFork_checkPendingInterrupts");
  dat("uFork_daliclock_tick");
  // more to come
  dat("EXIT");

  def("uFork_memoryDescriptor");
  dat("(CONST)", "uFork_memoryDescriptor_qaddr");

  def("uFork_eventQueueAndContQueue");
  dat("(CONST)", "uFork_eventQueueAndKontQueue_qaddr");

  def("uFork_#?",            "0"); // aka UNDEF or UNDEFINED
  def("uFork_()",            "1"); def("uFork_nil", "1");
  def("uFork_#f",            "2");
  def("uFork_#t",            "3");
  def("uFork_#unit",         "4");
  def("uFork_EMPTY_DQ",      "5");
  def("uFork_#type_t",       "6");
  def("uFork_#fixnum_t",     "7");
  def("uFork_#actor_t",      "8");
  def("uFork_PROXY_T",       "9");
  def("uFork_STUB_T",       "10");
  def("uFork_#instr_t",     "11");
  def("uFork_#pair_t",      "12");
  def("uFork_#dict_t",      "13");
  def("uFork_GC_FWD_REF_T", "14");
  def("uFork_FREE_T",       "15");

  // source uFork/vm/rs/src/lib.rs
  def("uFork_E_OK",        "0"); // not an error
  def("uFork_E_FAIL",     "-1"); // general failure
  def("uFork_E_BOUNDS",   "-2"); // out of bounds
  def("uFork_E_NO_MEM",   "-3"); // no memory available
  def("uFork_E_NOT_FIX",  "-4"); // fixnum required
  def("uFork_E_NOT_CAP",  "-5"); // capability required
  def("uFork_E_NOT_PTR",  "-6"); // memory pointer required
  def("uFork_E_NOT_ROM",  "-7"); // ROM pointer required
  def("uFork_E_NOT_RAM",  "-8"); // RAM pointer required
  def("uFork_E_NOT_EXE",  "-9"); // instruction required
  def("uFork_E_NO_TYPE", "-10"); // type required
  def("uFork_E_MEM_LIM", "-11"); // Sponsor memory limit reached
  def("uFork_E_CPU_LIM", "-12"); // Sponsor instruction limit reached
  def("uFork_E_MSG_LIM", "-13"); // Sponsor event limit reached
  def("uFork_E_ASSERT",  "-14"); // assertion failed
  def("uFork_E_STOP",    "-15"); // actor stopped

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
  dat("0x8000_&", "(JMP)", "CLEAN_BOOL");

  def("uFork_isMutable?"); // ( specimen -- bool )
  dat("0x4000_&", "(JMP)", "CLEAN_BOOL");

  def("uFork_isImmutable?"); // ( specimen -- bool )
  dat("uFork_isMutable?", "INVERT", "EXIT");

  def("uFork_isQuad?"); // ( specimen -- bool )
  dat("uFork_isFixnum?", "INVERT", "EXIT");

  def("uFork_isRamQuad?"); // ( specimen -- bool )
  dat("DUP", "uFork_isQuad?", "SWAP", "uFork_isMutable?", "&", "EXIT");

  def("uFork_isOpaque?"); // ( specimen -- bool )
  dat("DUP", "uFork_isRamQuad?", "(BRZ)", "uFork_isOpaque?_l0");
  dat("(LIT)", 0x2000, "&", "(JMP)", "CLEAN_BOOL");
  def("uFork_isOpaque?_l0");
  dat("DROP", "(JMP)", "FALSE");

  def("uFork_opaquefy"); // ( quad_ram_addr -- ocap )
  dat("DUP", "uFork_isRamQuad?", "(BRZ)", "(EXIT)");
  dat("(LIT)", 0x2000, "OR", "EXIT");

  def("uFork_transparenify"); // ( ocap -- quad_ram_addr )
  dat("DUP", "uFork_isOpaque?", "(BRZ)", "(EXIT)");
  dat("(LIT)", 0xDFFF, "&", "EXIT");
  

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
    dat("uFork_gcStopTheWorld");
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
    dat("uFork_transparenify");
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

  def("uFork_dispatchOneEvent"); // ( -- )
  dat("uFork_eventQueueAndContQueue", "qt@"); // ( events_head )
  dat("DUP", "uFork_()", "=", "OVER", "uFork_#?", "=", "OR"); // ( events_head bool )
  dat("(BRNZ)", "(DROP)");
  dat("DUP", "qz@", "uFork_eventQueueAndContQueue", "qt!"); // ( events_head ) move the event queue along
  dat("uFork_()", "OVER", "qz!"); // ( event )
  dat("DUP", "qx@", "DUP", "qz@"); // ( event actor effect|uFork_#? )
  dat("uFork_#?", "=");            // ( event actor idle? )
  dat("(BRNZ)", "uFork_dispatchOneEvent_l0"); // ( event actor )
  // actor is busy
  dat("DROP"); // ( event )
  dat("(JMP)", "uFork_enqueueEvents"); // put the event at the back of the event queue
  def("uFork_dispatchOneEvent_l0"); // actor was idle
  // todo: insert here an event sponsor mem fuel check&burn here: 2 quads spent
  dat("uFork_allot");              // ( event actor quad )
  dat("uFork_#actor_t");           // ( event actor quad uFork_#actor_t )
  dat("OVER", "qt!");              // ( event actor quad )
  dat("OVER", "qx@");              // ( event actor quad beh )
  dat("OVER", "qx!");              // ( event actor quad )
  dat("OVER", "qy@");              // ( event actor quad state )
  dat("OVER", "qy!");              // ( event actor quad )
  dat("uFork_()", "OVER", "qz!");  // ( event actor effect )
  dat("OVER", "qz!");              // ( event actor )
  dat("qx@");                      // ( event beh )
  dat("uFork_allot");              // ( event beh kont )
  dat("SWAP", "OVER", "qt!");      // ( event kont )
  dat("SWAP", "OVER", "qy!");      // ( kont )
  dat("uFork_()");                 // ( kont uFork_() )
  if (uForkSubroutines) {
    dat("uFork_allot", "SWAP", "OVER", "qx!"); // ( kont spAndRp_quad )
    dat("uFork_()", "OVER", "qy!");
  }
  dat("OVER", "qx!"); // ( kont )
  // dat("(JMP)", "uFork_enqueueCont"); // deliberate fallthrough to uFork_enqueueCont

  def("uFork_enqueueCont"); // ( kont -- )
  dat("DUP", "uFork_()", "=", "(BRNZ)", "(DROP)");
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
  dat("(JMP)", "uFork_enqueueEvents"); // ( )

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
  dat("uFork_isContHalted?", "(BREXIT)");
  // done: insert sponsor cycles fuel check&burn here.
  dat("uFork_sponsor_cycles_check&burn", "RDROP");
  dat("DUP", "qt@");         // ( kont ip )
  // done: insert ip #instr_t check here
  dat("DUP", "qt@", "uFork_#instr_t", "=", "(BRNZ)", "uFork_fetchAndExec_l0");
  dat("DROP", "uFork_E_NOT_EXE", "(JMP)", "uFork_signal_sponsor_controler");
  def("uFork_fetchAndExec_l0"); // ( kont ip )
  //
  dat("DUP", "qx@");         // ( kont ip opcode )
  // dat("(JMP)", "uFork_doInstr"); fallthrough
  // def("uFork_doInstr"); // ( kont ip opcode_fixnum -- )
  // done: insert instruction being an fixnum or within 'bounds'
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_no_such_opcode"); // ( kont ip opcode_fixnum )
  dat("uFork_fixnum2int"); // ( kont ip opcode )
  dat("(JMPTBL)");
  if (uForkSubroutines) {
    dat(37);
  } else {
    dat(32); // number of base instructions
  }
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
  if (uForkSubroutines) {
    dat("uFork_instr__rpush");  // +32
    dat("uFork_instr__rpop");   // +33
    dat("uFork_instr__subroutine_call"); // +34
    dat("uFork_instr__subroutine_exit"); // +35
    dat("uFork_instr_nop");     // +36
  }
  def("uFork_instr__error");   // ( kont ip opcode )
  def("uFork_no_such_opcode"); // ( kont ip opcode )
  // done: cause a error signal   tbd: debug hugdettan?
  dat("2DROP", "uFork_E_BOUNDS", "(JMP)", "uFork_signal_sponsor_controler");

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
  dat("qz@");             // ( kont next_ip )
  dat("SWAP", "qt!");     // ( ) advance the ip of the kontinuation
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
  // todo: insert allot fuel check&burn here taking n into consideration
  // done: insert fixnum type check here for n
  dat("DUP", "uFork_isFixnum?", "(BRNZ)", "uFork_instr_dup_l2"); // ( kont n )
  def("uFork_instr_dup_l3");
  dat("DROP", "uFork_E_NOT_FIX", "(JMP)", "uFork_signal_sponsor_controler");
  def("uFork_instr_dup_l2");
  dat("uFork_fixnum2int", ">R");          // ( kont ) R:( n )
  dat("DUP", "uFork_sp@", "uFork_allot"); // ( kont stack tmp ) R:( n )
  dat("DUP", "R>", "SWAP", ">R", ">R");   // ( kont stack tmp ) R:( tmp1st n )
  dat("(JMP)", "uFork_instr_dup_l1");
  def("uFork_instr_dup_l0"); // ( kont tmp stack )
  dat("OVER");         // ( kont stack tmp stack )
  dat("uFork_car");    // ( kont stack tmp item  )
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
  // done: insert fixnum type tag check here
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
  dat("uFork_fixnum2int", ">R"); // ( kont ) R:( count )
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
  // done: insert isFixnum? check and sponsor signal here
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
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
  // done: insert isFixnum? check and sponsor signal here
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
  dat("uFork_fixnum2int"); // ( kont n )
  dat("DUP", "0<");        // ( kont n bool )
  dat("(BRNZ)", "uFork_instr_roll_l0"); // ( kont n )
  dat("1-", ">R", "DUP", "uFork_sp@");  // ( kont stack ) R:( n )
  dat("(JMP)", "uFork_instr_roll_l2");
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
  // done: insert here a fixnum type check
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_no_such_opcode"); // ( kont ip subopcode_fixnum )
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
  // done: insert here an error signal to sponsor controller
  def("uFork_instr_alu_divmod"); // tbd: verður þessi aðgerð studd í uFork?
  dat("(JMP)", "uFork_no_such_opcode"); // ( kont ip subopcode )

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
  // done: insert fixnum type check here for uFork TOS and uFork NOS items
  dat("DUP", "uFork_sp@", "DUP", "uFork_car"); // ( kont stack n_fixnum )
  dat("uFork_isFixnum?", "SWAP", "uFork_cdr"); // ( kont bool next_stack )
  dat("uFork_car", "uFork_isFixnum?", "&");    // ( kont bool )
  dat("DUP", "(BRZ)", "uFork_instr_dup_l3");   // ( kont bool )
  dat("DROP");                                 // ( kont )
  dat("DUP", "uFork_pop");    // ( kont uTOS_fixnum )
  dat("uFork_fixnum2int");    // ( kont uTOS_int )
  dat("OVER", "uFork_pop");   // ( kont uTOS_int uNOS_fixnum )
  dat("uFork_fixnum2int");    // ( kont uTOS_int uNOS_int )
  dat("SWAP");
  dat("EXIT");

  def("uFork_instr_alu__common"); // ( kont subopcode ) R:( raddr_spefic_alu_instr )
  dat("DROP");                    // ( kont )
  dat("uFork_pop_two_fixnums2ints");           // ( kont n m )
  dat("R>", "@EXECUTE");                       // do the op
  dat("(JMP)", "uFork_instr_alu__common_tail");

  def("uFork_instr_alu_and");
  dat("uFork_instr_alu__common", "(&)");

  def("uFork_instr_alu_or");
  dat("uFork_instr_alu__common", "(OR)");

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
  dat("DROP", "DUP", "qy@");  // ( kont subopcode )
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_no_such_opcode"); // ( kont ip subopcode_fixnum )
  dat("uFork_fixnum2int");
  dat("NIP");
  dat("(JMPTBL)");
  dat(6);
  dat("uFork_instr_cmp_eq"); // +0
  dat("uFork_instr_cmp_ge"); // +1
  dat("uFork_instr_cmp_gt"); // +2
  dat("uFork_instr_cmp_lt"); // +3
  dat("uFork_instr_cmp_le"); // +4
  dat("uFork_instr_cmp_ne"); // +5
  // done: insert sponsor err signalling here
  dat("DUP", "(JMP)", "uFork_no_such_opcode"); // ( kont item item )

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
  dat("uFork_pop_two_fixnums2ints"); // ( kont NOS_int TOS_int ) R:( raddr raddr_op )
  dat("R>", "@EXECUTE", "(JMP)", "uFork_instr_typeq_l1");

  def("uFork_instr_cmp_lt");
  dat("uFork_instr_cmp__common", "<");

  def("uFork_instr_cmp_le");
  dat("uFork_instr_cmp__common", "<=");

  def("uFork_instr_cmp_ge");
  dat("uFork_instr_cmp__common", ">=");

  def("uFork_instr_cmp_gt");
  dat("uFork_instr_cmp__common", ">");

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
  // todo: insert a check that k is not fixnum nor an actor
  dat("(JMP)", "uFork_instr_if_l0");

  def("uFork_instr_pair"); // ( kont ip opcode )
  dat("DROP");             // ( kont ip )
  dat("qy@");              // ( kont n_fixnum )
  // todo: insert here a sponsor mem fuel check&burn. Fuel usage: 1
  // done: insert here a fixnum check
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
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
  // done: insert fixnum check here
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
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
  // done: insert here a fixnum check for the immediate param of the uFork instr
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
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
  dat("DUP");
  dat("qy@");              // ( kont ip subopcode )
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_no_such_opcode"); // ( kont ip opcode_fixnum )
  dat("uFork_fixnum2int");
  dat("NIP");
  dat("(JMPTBL)", 5);
  dat("uFork_instr_dict_has");
  dat("uFork_instr_dict_get");
  dat("uFork_instr_dict_add");
  dat("uFork_instr_dict_set");
  dat("uFork_instr_dict_del");
  // done: insert here err signalling
  dat("DUP", "(JMP)", "uFork_no_such_opcode"); // ( kont ip opcode_fixnum )

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
  dat("DUP");               // ( kont ip ip )
  dat("qy@");               // ( kont subopcode_fixnum )
  // done: insert here a fixnum type check
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_no_such_opcode"); // ( kont ip opcode_fixnum )
  dat("uFork_fixnum2int");  // ( kont subopcode )
  dat("NIP");
  dat("(JMPTBL)", 7);       //
  dat("uFork_instr_deque_new");
  dat("uFork_instr_deque_empty");
  dat("uFork_instr_deque_push");
  dat("uFork_instr_deque_pop");
  dat("uFork_instr_deque_put");
  dat("uFork_instr_deque_pull");
  dat("uFork_instr_deque_length");
  // done: insert here an err signal to sponsor
  dat("DUP", "(JMP)", "uFork_no_such_opcode");

  def("uFork_instr_deque_new"); // ( kont subopcode )
  dat("DROP");                  // ( kont )
  // todo: insert here sponsor mem fuel check&burn: 1 quad spent
  dat("uFork_deque_new");
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_deque_empty"); // ( kont subopcode )
  dat("DROP");                    // ( kont )
  // todo: insert here a check that TOS is a deque
  dat("DUP", "uFork_pop", "uFork_deque_empty?");
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
  // done: insert here a fixnum typecheck
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
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
  // done: insert here a fixnum typecheck
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
  dat("uFork_fixnum2int"); // ( kont n )
  dat("OVER", "qy@", "qy@"); // ( kont n msg )
  dat("(JMP)", "uFork_instr_nth_l0");

  def("uFork_instr_state"); // ( kont ip opcode )
  dat("DROP");            // ( kont ip )
  dat("qy@");             // ( kont n_fixnum )
  // done: insert here a fixnum typecheck
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
  dat("uFork_fixnum2int"); // ( kont n )
  dat("OVER", "qy@", "qx@", "qy@");
  dat("(JMP)", "uFork_instr_nth_l0");

  def("uFork_instr_my"); // ( kont ip opcode )
  dat("DROP");           // ( kont ip )
  dat("DUP");            // ( kont ip ip )
  dat("qy@");            // ( kont ip subopcode )
  // done: insert here a fixnum type check
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_no_such_opcode"); // ( kont ip opcode_fixnum )
  dat("uFork_fixnum2int");
  dat("NIP");
  dat("(JMPTBL)", 3);
  dat("uFork_instr_my_self");  // +0
  dat("uFork_instr_my_beh");   // +1
  dat("uFork_instr_my_state"); // +2
  // done: insert here error signalling to sponsor
  dat("DUP", "(JMP)", "uFork_no_such_opcode"); // ( kont item item )


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

  def("uFork_instr_my_state"); // ( kont subopcode )
  dat("DROP");                 // ( kont )
  dat("DUP");                  // ( kont kont )
  dat("qy@");                  // ( kont event )
  dat("qx@");                  // ( kont actor )
  dat("qy@");                  // ( kont state )
  dat("DUP");                  // ( kont state state )
  dat("uFork_pairlist_length"); // ( kont state length )
  // todo: insert here a sponsor mem fuel check&burn: length units of fuel
  dat("uFork_copy_pairlist_until_n"); // ( kont new_tail new_head )
  // todo: there should be a word definition tail this definition can share, find it
  dat("ROT");                  // ( new_tail new_head kont )
  dat(">R");                   // ( new_tail new_head ) R:( kont )
  dat("SWAP");                 // ( new_head new_tail ) R:( kont )
  dat("R@");                   // ( new_head new_tail kont ) R:( kont )
  dat("uFork_sp@");            // ( new_head new_tail stack ) R:( kont )
  dat("SWAP");                 // ( new_head stack new_tail ) R:( kont )
  dat("qy!");                  // ( new_head ) R:( kont )
  dat("R@");                   // ( new_head kont ) R:( kont )
  dat("uFork_sp!");            // ( ) R:( kont )
  dat("R>");                   // ( kont )
  dat("(JMP)", "uFork_instr__common_longer_tail");


  def("uFork_send_msg"); // ( kont actor msg sponsor -- )
  dat("uFork_allot", "DUP", ">R"); // ( kont actor msg sponsor quad ) R:( quad )
  dat("qt!");            // ( kont actor msg ) R:( quad )
  dat("R@", "qy!");      // ( kont actor ) R:( quad )
  dat("R@", "qx!");      // ( kont ) R:( quad )
  dat("qy@");            // ( event ) R:( quad )
  dat("qx@");            // ( this_actor ) R:( quad )
  dat("qz@");            // ( effects ) R:( quad )
  dat("DUP", "qz@");     // ( effects outgoing_events ) R:( quad )
  dat("R@", "qz!");      // ( effects ) R:( quad )
  dat("R>", "SWAP");     // ( quad effects ) R:( )
  dat("qz!", "EXIT");    // ( ) R:( )

  def("uFork_stack_pluck"); // ( kont n -- head )
  dat("1-", "NEGATE");      // ( kont -(n-1) )
  dat("OVER", "uFork_sp@", "DUP", ">R"); // ( kont -(n-1) head ) R:( head )
  dat("SWAP", "uFork_ndeep"); // ( kont tail ) R:( head )
  dat("DUP", "uFork_cdr", "ROT", "uFork_sp!");
  dat("uFork_()", "SWAP", "qy!"); // ( )
  dat("R>", "EXIT");

  def("uFork_instr_send"); // ( kont ip opcode )
  dat("DROP");             // ( kont ip )
  dat("qy@");              // ( kont n_fixnum )
  // todo: insert here a sponsor mem fuel check&burn: 1 quad spent
  // done: insert here fixnum type check
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
  dat("uFork_fixnum2int"); // ( kont n )
  dat("OVER", "uFork_pop", "SWAP"); // ( kont actor n )
  dat("DUP", "-1", "=", "(BRZ)", "uFork_instr_send_l0");
  dat("DROP", "OVER", "uFork_pop"); // ( kont actor msg )
  dat("(JMP)", "uFork_instr_send_l1");
  def("uFork_instr_send_l0"); // ( kont actor n )
  // todo: insert a sponsor mem fuel check&burn: n quads spent
  dat("ROT", "DUP", ">R", "-ROT", "R>"); // ( kont actor n kont )
  dat("SWAP", "uFork_stack_pluck"); // ( kont actor msg )
  def("uFork_instr_send_l1"); // ( kont actor msg )
  dat("ROT", "DUP", ">R", "-ROT"); // ( kont actor msg ) R:( kont )
  dat("R@", "qy@", "qt@");    // ( kont actor msg sponsor ) R:( kont )
  dat("uFork_send_msg");      // ( ) R:( kont )
  dat("R>");                  // ( kont ) R:( kont )
  dat("(JMP)", "uFork_instr__common_longer_tail");

  def("uFork_instr_signal"); // ( kont ip opcode )
  dat("DROP");               // ( kont ip )
  dat("qy@");                // ( kont n_fixnum )
  // todo: insert here a sponsor mem fuel check&burn: 1 quad spent
  // done: insert here fixnum type check
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
  dat("uFork_fixnum2int");   // ( kont n )
  dat("OVER", "uFork_pop", "SWAP"); // ( kont actor n )
  dat("DUP", "-1", "=", "(BRZ)", "uFork_instr_signal_l0");
  dat("DROP", "OVER", "uFork_pop"); // ( kont actor msg )
  dat("(JMP)", "uFork_instr_signal_l1");
  def("uFork_instr_signal_l0");
  // todo: insert a sponsor mem fuel check&burn: n quads spent
  dat("ROT", "DUP", ">R", "-ROT", "R>"); // ( kont actor n kont )
  dat("SWAP", "uFork_stack_pluck"); // ( kont actor msg )
  def("uFork_instr_signal_l1"); // ( kont actor msg )
  dat("ROT", "DUP", ">R", "-ROT"); // ( kont actor msg ) R:( kont )
  dat("R@", "uFork_pop", "uFork_send_msg"); // ( )
  dat("R>", "(JMP)", "uFork_instr__common_longer_tail");

  // tbd: provide a hook so new actors could be created
  //      elsewhere instead of this quads space
  def("uFork_instr_new"); // ( kont ip opcode )
  dat("DROP");            // ( kont ip )
  dat("qy@");             // ( kont n_fixnum )
  // done: insert here a fixnum type check
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
  dat("uFork_fixnum2int"); // ( kont n )
  // todo: insert here sponsor mem fuel check&burn: 1 quad spend
  dat("DUP", "0", "=", "(BRZ)", "uFork_instr_new_l0"); // ( kont n )
  dat("DROP", "uFork_()", "OVER", "uFork_pop"); // ( kont staða hegðun )
  dat("(JMP)", "uFork_instr_new_l4");
  def("uFork_instr_new_l0"); // ( kont n )
  dat("DUP", "-1", "=", "(BRZ)", "uFork_instr_new_l1"); // ( kont n )
  dat("DROP", "DUP", "uFork_pop");  // ( kont hegðun )
  dat("OVER", "uFork_pop", "SWAP"); // ( kont staða hegðun )
  dat("(JMP)", "uFork_instr_new_l4");
  def("uFork_instr_new_l1"); // ( kont n )
  dat("DUP", "-2", "=", "(BRZ)", "uFork_instr_new_l2"); // ( kont n )
  dat("DROP", "DUP", "uFork_pop", "uFork_carAndCdr");   // ( kont staða hegðun )
  dat("(JMP)", "uFork_instr_new_l4");
  def("uFork_instr_new_l2"); // ( kont n )
  dat("DUP", "-3", "=", "(BRZ)", "uFork_instr_new_l3"); // ( kont n )
  dat("DROP", "DUP", "uFork_pop", "DUP", "qz@"); // ( kont staða hegðun )
  dat("(JMP)", "uFork_instr_new_l4");
  def("uFork_instr_new_l3"); // ( kont n )
  dat(">R", "DUP", ">R", "DUP"); // ( kont kont ) R:( n kont )
  dat("uFork_pop");          // ( kont hegðun )
  dat("R>", "R>");           // ( kont hegðun kont n ) R:( )
  dat("uFork_stack_pluck");  // ( kont hegðun staða )
  dat("SWAP");               // ( kont staða hegðun )
  def("uFork_instr_new_l4"); // ( kont staða hegðun )
  // tbd punktur
  dat("uFork_allot");        // ( kont staða hegðun quad )
  dat("uFork_#actor_t", "OVER", "qt!"); // ( kont staða hegðun quad )
  dat("SWAP", "OVER", "qx!"); // ( kont staða quad )
  dat("SWAP", "OVER", "qy!"); // ( kont quad )
  dat("uFork_#?", "OVER", "qz!"); // ( kont quad )
  dat("uFork_opaquefy");
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_beh"); // ( kont ip opcode )
  dat("DROP");            // ( kont ip )
  dat("qy@");             // ( kont n_fixnum )
  // done: insert here a fixnum type check
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_instr_dup_l3"); // ( kont n )
  dat("uFork_fixnum2int"); // ( kont n )
  dat("DUP", "0", "=", "(BRZ)", "uFork_instr_beh_l0"); // ( kont n )
  dat("DROP", "uFork_()", "OVER", "uFork_pop"); // ( kont staða hegðun )
  dat("(JMP)", "uFork_instr_beh_l4");
  def("uFork_instr_beh_l0"); // ( kont n )
  dat("DUP", "-1", "=", "(BRZ)", "uFork_instr_beh_l1"); // ( kont n )
  dat("DROP", "DUP", "uFork_pop");  // ( kont hegðun )
  dat("OVER", "uFork_pop", "SWAP"); // ( kont staða hegðun )
  dat("(JMP)", "uFork_instr_beh_l4");
  def("uFork_instr_beh_l1"); // ( kont n )
  dat("DUP", "-2", "=", "(BRZ)", "uFork_instr_beh_l2"); // ( kont n )
  dat("DROP", "DUP", "uFork_pop", "uFork_carAndCdr");   // ( kont staða hegðun )
  dat("(JMP)", "uFork_instr_beh_l4");
  def("uFork_instr_beh_l2"); // ( kont n )
  dat("DUP", "-3", "=", "(BRZ)", "uFork_instr_beh_l3"); // ( kont n )
  dat("DROP", "DUP", "uFork_pop", "DUP", "qz@"); // ( kont staða hegðun )
  dat("(JMP)", "uFork_instr_beh_l4");
  def("uFork_instr_beh_l3"); // ( kont n )
  dat(">R", "DUP", ">R", "DUP"); // ( kont kont ) R:( n kont )
  dat("uFork_pop");          // ( kont hegðun )
  dat("R>", "R>");           // ( kont hegðun kont n ) R:( )
  dat("uFork_stack_pluck");  // ( kont hegðun staða )
  dat("SWAP");               // ( kont staða hegðun )
  def("uFork_instr_beh_l4"); // ( kont staða hegðun )
  dat("ROT", "DUP", ">R", "-ROT", "R>"); // ( kont staða hegðun kont )
  dat("qy@");                // ( kont staða hegðun event )
  dat("qx@");                // ( kont staða hegðun actor )
  dat("qz@");                // ( kont staða hegðun effect )
  dat("SWAP", "OVER", "qx!"); // ( kont staða effect )
  dat("qy!");                // ( kont )
  dat("(JMP)", "uFork_instr__common_longer_tail");

  def("uFork_instr_end"); // ( kont ip opcode )
  dat("DROP");
  dat("DUP");
  dat("qy@");             // ( kont subopcode_fixnum )
  // done: insert fixnum type check here
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_no_such_opcode"); // ( kont ip opcode_fixnum )
  dat("uFork_fixnum2int"); // ( kont subopcode )
  dat("NIP");
  dat("DUP", "-1", "=", "(BRZ)", "uFork_instr_end_l0");
  // end abort  acts like the instigating event message was thrown away
  //            reason gets reported to attached debugger
  dat("2DROP");           // ( )
  def("uFork_instr_end_l3");
  dat("DROP");            // not an error, there is k_head on the stack gets dropped
  dat("uFork_()");        // and gets replaced with NullInList
  dat("EXIT");
  def("uFork_instr_end_l0"); // ( kont subopcode )
  dat("DUP", "0", "=", "(BRZ)", "uFork_instr_end_l1"); // ( kont subopcode )
  // end stop  halts the sponsor configuration this kontinuation runs under
  //           END_HALT gets reported to the sponsor controler
  dat("DROP");               // ( kont )
  // todo: insert here END_HALT signal to sponsor controler
  dat("uFork_E_STOP", "uFork_signal_sponsor_controler");
  dat("(JMP)", "uFork_instr_end_l3");
  def("uFork_instr_end_l1"); // ( kont subopcode )
  dat("DUP", "1", "=", "(BRZ)", "uFork_instr_end_l2");
  // end commit  commits the effects of this kontinuation to the actor
  //             and releases the accumulated outgoing events to the event queue
  dat("DROP");               // ( kont )
  dat("qy@");                // ( event )
  dat("qx@", "DUP", "qz@");  // ( actor effect )
  dat("DUP", ">R",  "qx@");  // ( actor beh' ) R:( effect )
  dat("OVER", "qx!");        // ( actor ) R:( effect )
  dat("R@", "qy@");          // ( actor state' ) R:( effect )
  dat("OVER", "qy!");        // ( actor ) R:( effect )
  dat("uFork_#?", "SWAP", "qz!"); // ( ) R:( effect )
  dat("R>", "qz@");          // ( outgoing_events ) R:( )
  dat("uFork_enqueueEvents"); // ( )
  dat("(JMP)", "uFork_instr_end_l3");
  def("uFork_instr_end_l2");
  // done: signal sponsor controler that an errornous subopcode was encountered
  dat("DUP", "(JMP)", "uFork_no_such_opcode");

  // todo: sponsor <peek> instruction
  //       þar sem <peek> er capability og ekki fixnum
  def("uFork_sponsor_peek");
  dat("(CONST)", 0x4010);
  
  def("uFork_instr_sponsor"); // ( kont ip opcode )
  dat("DROP");                // ( kont ip )
  dat("DUP");                 // ( kont ip ip )
  dat("qy@");                 // ( kont ip subopcode )
  dat("DUP", "uFork_sponsor_peek", "=", "(BRZ)", "uFork_instr_sponsor_peek");
  dat("DUP", "uFork_isFixnum?", "(BRZ)", "uFork_no_such_opcode"); // ( kont ip subopcode_fixnum )
  dat("uFork_fixnum2int");
  dat("NIP");
  dat("(JMPTBL)", 7);
  dat("uFork_instr_sponsor_new");     // +0
  dat("uFork_instr_sponsor_memory");  // +1
  dat("uFork_instr_sponsor_events");  // +2
  dat("uFork_instr_sponsor_cycles");  // +3
  dat("uFork_instr_sponsor_reclaim"); // +4
  dat("uFork_instr_sponsor_start");   // +5
  dat("uFork_instr_sponsor_stop");    // +6
  dat("DUP", "(JMP)", "uFork_no_such_opcode");

  def("uFork_instr_sponsor_peek"); // ( kont ip subopcode )
  dat("2DROP");                    // ( kont )
  dat("DUP", "qy@");               // ( kont event )
  dat("qt@");                      // ( kont sponsor )
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_sponsor_new"); // ( kont subopcode )
  dat("DROP");                    // ( kont )
  // todo: insert here this events sponsor mem fuel check&burn
  dat("uFork_allot");             // ( kont quad )
  dat("0_i2f_OVER", "qt!");
  dat("0_i2f_OVER", "qx!");
  dat("0_i2f_OVER", "qy!");
  dat("uFork_#?", "OVER", "qz!");
  // dat("uFork_opaquefy"); the sponsor is always transparent but the resource security against counterfitting a sponsor relies on the uFork `quad` constructing instruction checking that the t field points to a valid #type 
  dat("(JMP)", "uFork__push_then_instrTail");

  def("0_i2f_OVER");
  dat("0", "uFork_int2fixnum", "OVER", "EXIT");

  def("uFork_instr_sponsor_memory");
  def("uFork_instr_sponsor_events");
  def("uFork_instr_sponsor_cycles");
  def("uFork_instr_sponsor__resources_common"); // ( kont subopcode )
  dat(">R");                     // ( kont ) R:( subopcode )
  // todo: insert here a fixnum type check
  dat("DUP", "uFork_pop");       // ( kont n_fixnum ) R:( subopcode )
  dat("uFork_fixnum2int");       // ( kont n )
  // todo: insert here a check that n is greater than 0
  dat("OVER");                   // ( kont n kont )
  dat("qy@");                    // ( kont n event )
  dat("qt@");                    // ( kont n my_sponsor ) R:( subopcode )
  dat("R@");                     // ( kont n my_sponsor subopcode ) R:( subopcode )
  dat("uFork_instr_sponsor__resources_common_res@"); // ( kont n my_quota ) R:( subopcode )
  dat("2DUP", "<", "(BRZ)", "uFork_instr_sponsor__resources_common_l0");
  dat("uFork_fixnum2int", "OVER", "-", "uFork_int2fixnum"); // ( kont n my_quota-n )
  dat("ROT", "DUP", ">R", "-ROT", "R>"); // ( kont n my_quota-n kont ) R:( subopcode )
  dat("qy@", "qt@", "R@"); // ( kont n my_quota-n my_sponsor subopcode ) R:( subopcode )
  dat("uFork_instr_sponsor__resources_common_res!"); // ( kont n ) R:( subopcode )
  dat("OVER", "uFork_pop"); // ( kont n dest_sponsor ) R:( subopcode )
  dat("SWAP", "OVER", "R@"); // ( kont dest_sponsor n dest_sponsor subopcode ) R:( subopcode )
  dat("uFork_instr_sponsor__resources_common_res@"); // ( kont dest_sponsor n dest_quota ) R:( subopcode )
  dat("uFork_fixnum2int", "+", "uFork_int2fixnum");  // ( kont dest_sponsor dest_quota+n ) R:( subopcode )
  dat("OVER");               // ( kont dest_sponsor dest_quota+n dest_sponsor ) R:( subopcode )
  dat("R>", "uFork_instr_sponsor__resources_common_res!"); // ( kont dest_sponsor )
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_sponsor__resources_common_res@"); // ( sponsor subopcode -- quota )
  dat("1-");
  dat("(JMPTBL)", 3);
  dat("uFork_instr_sponsor__resources_common_qt@");
  dat("uFork_instr_sponsor__resources_common_qx@");
  dat("uFork_instr_sponsor__resources_common_qy@");
  dat("EXIT");
  def("uFork_instr_sponsor__resources_common_qt@");
  dat("DROP", "qt@", "EXIT");
  def("uFork_instr_sponsor__resources_common_qx@");
  dat("DROP", "qx@", "EXIT");
  def("uFork_instr_sponsor__resources_common_qy@");
  dat("DROP", "qy@", "EXIT");

  def("uFork_instr_sponsor__resources_common_res!"); // ( quota sponsor subopcode -- )
  dat("1-");
  dat("(JMPTBL)", 3);
  dat("uFork_instr_sponsor__resources_common_qt!");
  dat("uFork_instr_sponsor__resources_common_qx!");
  dat("uFork_instr_sponsor__resources_common_qy!");
  dat("EXIT");
  def("uFork_instr_sponsor__resources_common_qt!"); // ( quota sponsor -- )
  dat("DROP", "qt!", "EXIT");
  def("uFork_instr_sponsor__resources_common_qx!"); // ( quota sponsor -- )
  dat("DROP", "qx!", "EXIT");
  def("uFork_instr_sponsor__resources_common_qy!"); // ( quota sponsor -- )
  dat("DROP", "qy!", "EXIT");

  def("uFork_sponsor_reclaim"); // ( reclaimed_sponsor reclaiming_sponsor -- )
  dat("OVER", "qt@");           // ( eds ings eds_mem_quota_fixnum )
  dat("uFork_fixnum2int");      // ( eds ings eds_mem_quota )
  dat("OVER", "qt@");           // ( eds ings eds_mem_quota ings_mem_quota_fixnum )
  dat("uFork_fixnum2int");      // ( eds ings eds_mem_quota ings_mem_quota )
  dat("+");                     // ( eds ings ings_mem_quota )
  dat("uFork_int2fixnum");      // ( eds ings ings_mem_quota_fixnum )
  dat("OVER", "qt!");           // ( eds ings )
  dat("OVER", "qx@");           // ( eds ings eds_events_quota_fixnum )
  dat("uFork_fixnum2int");      // ( eds ings eds_events_quota )
  dat("OVER", "qx@");           // ( eds ings eds_events_quota ings_events_quota_fixnum )
  dat("uFork_fixnum2int");      // ( eds ings eds_events_quota ings_events_quota )
  dat("+");                     // ( eds ings ings_events_quota )
  dat("uFork_int2fixnum");      // ( eds ings ings_events_quota_fixnum )
  dat("OVER", "qx!");           // ( eds ings )
  dat("OVER", "qy@");           // ( eds ings eds_cycles_quota_fixnum )
  dat("uFork_fixnum2int");      // ( eds ings eds_cycles_quota )
  dat("OVER", "qy@");           // ( eds ings eds_cycles_quota ings_cycles_quota_fixnum )
  dat("uFork_fixnum2int");      // ( eds ings eds_cycles_quota ings_cycles_quota )
  dat("+");                     // ( eds ings ings_cycles_quota )
  dat("uFork_int2fixnum");      // ( eds ings ings_cycles_quota_fixnum )
  dat("SWAP", "qy!");           // ( eds )
  dat("0", "uFork_int2fixnum", "OVER", "qt!");
  dat("0", "uFork_int2fixnum", "OVER", "qx!");
  dat("0", "uFork_int2fixnum", "SWAP", "qy!");
  dat("EXIT");
  
  def("uFork_instr_sponsor_reclaim"); // ( kont subopcode )
  dat("DROP");                        // ( kont )
  // todo: insert here an uFork TOS type check that it is a sponsor
  dat("DUP", "uFork_pop");            // ( kont reclaimed_sponsor )
  dat("DUP", ">R");                   // ( kont reclaimed_sponsor ) R:( reclaimed_sponsor )
  dat("OVER", "qy@", "qt@");          // ( kont reclaimed_sponsor reclaiming_sponsor )
  dat("uFork_sponsor_reclaim");       // ( kont ) R:( reclaimed_sponsor )
  dat("R>");                          // ( kont reclaimed_sponsor )
  dat("(JMP)", "uFork__push_then_instrTail");

  def("uFork_instr_sponsor_start"); // ( kont subopcode )
  dat("DROP");                      // ( kont )
  // todo: insert here that uFork TOS is opaque and an actor
  // todo: insert here that uFork NOS is an sponsor
  // todo: insert here that signal field of that sponsor is fixnum
  // todo: insert here mem fuel of this kont sponsor check&burn: 1 quad spent
  dat("DUP", "uFork_pop");          // ( kont ctrlr )
  dat("OVER", "uFork_pop");         // ( kont ctrlr spn )
  dat(">R");                        // ( kont ctrlr ) R:( spn )
  dat("uFork_allot");               // ( kont ctrlr quad )
  dat("DUP", ">R");                 // ( kont ctrlr quad ) R:( spn quad )
  dat("qx!");                       // ( kont ) R:( spn quad )
  dat("DUP", "qy@", "qt@");         // ( kont ctrlr_spn ) R:( spn quad )
  dat("R@", "qt!");                 // ( kont ) R:( spn quad )
  dat("R>", "DUP", "R@");           // ( kont quad quad spn ) R:( spn )
  dat("SWAP", "qy!");               // ( kont quad ) R:( spn )
  dat("R>", "qz!");                 // ( kont ) R:( )
  dat("(JMP)", "uFork_instr__common_longer_tail");

  def("uFork_instr_sponsor_stop"); // ( kont subopcode )
  dat("DROP");                     // ( kont )
  // todo: insert here that uFork NOS is an sponsor
  dat("DUP", "uFork_pop");         // ( kont spn )
  dat("OVER", "qy@", "qt@");       // ( kont spn kont_spn )
  dat("OVER", "SWAP");             // ( kont spn spn kont_spn )
  dat("uFork_sponsor_reclaim");    // ( kont spn )
  dat("0", "uFork_int2fixnum");    // ( kont spn zero_fixnum )
  dat("SWAP", "qz!");              // ( kont )
  dat("(JMP)", "uFork_instr__common_longer_tail");


  // tbd: new instruction for uFork `throw_away_effects`
  //      throws away the accumulated outgoing events and cancels beh update of the actor

  if (uForkSubroutines) {
    def("uFork_instr__subroutine_call"); // ( kont ip opcode -- )
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
    
    def("uFork_instr__subroutine_exit"); // ( kont ip opcode -- )
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

    def("uFork_instr__rpush"); // ( kont ip opcode )
    dat("2DROP");            // ( kont )
    dat("DUP");              // ( kont kont )
    dat("uFork_pop");        // ( kont item )
    dat("OVER");             // ( kont item kont )
    dat("uFork_rpush");      // ( kont )
    dat("(JMP)", "uFork_instr__common_longer_tail");

    def("uFork_instr__rpop"); // ( kont ip opcode )
    dat("2DROP");            // ( kont )
    dat("DUP");              // ( kont kont )
    dat("uFork_rpop");       // ( kont item )
    dat("OVER");             // ( kont item kont )
    dat("uFork_push");      // ( kont )
    dat("(JMP)", "uFork_instr__common_longer_tail");
  }

  // this definition must be the last one
  def("uFork_last_ucode_address");
  
  return asm;
};

export default Object.freeze({
  uFork
});
// forkmon sem nafn á monitor dæminu
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
     möguleiki á að búa til actor þar sem code bendir ekki á stack heldur á
     quad
       þar sem t field bendir á #debug_t
       þar sem x field bendir á raunverulegan kóða
       þar sem z field bendir á
         [debugger_sponsor, debugger, #?, #?]
     þegar slíkur actor fær boð þá bendir sp (x quad field) á quad sem z field bendir á
        debugger event quad hér rétt fyrir ofan
     ef anonomulous staða kemur upp þá er þetta notað til að senda event boð til
     debugger á forminu:
       [debugger_sponsor, debugger, msg, #?]
                                    |
                                    V
                                 [resume_cap, afrit_af_faulting_continuation, #?, #?]
   resume_cap er capability sem bendir a psuedo-actor sem býst við event boði
   þar sem msg er nýja instruction pointer fyrir það continuation
*/
