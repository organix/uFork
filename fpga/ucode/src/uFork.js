// @ts-check js
/**
 * @use JSDoc
 * @overview Implements the uFork instructionset in microcode
 * @author Zarutian
 */
// using uFork/docs/vm.md as reference

export const uFork = (asm, opts) => {
  opts = (opts == undefined) ? {} : opts ;
  const eventQueueAndContQueue_qaddr = (opts.eventQueueAndContQueue_qaddr == undefined ) ?
    0x4001 : opts.eventQueueAndContQueue_qaddr ;
  const memoryDescriptor_qaddr = (opts.memoryDescriptor_qaddr == undefined) ?
    0x4000 : opts.memoryDescriptor_qaddr ;
  const uForkSubroutines = (opts.uForkSubroutines == undefined) ? false : opts.uForkSubroutines ;
  const hwImplOfQuadAllotAndFree = (opts.hwImplOfQuadAllotAndFree == undefined) ? false : opts.hwImplOfQuadAllotAndFree ;
  const maxTopOfQuadMemory = (opts.maxTopOfQuadMemory == undefined) ? 0x5000 : opts.maxTopOfQuadMemory ;
  
  def("uFork_doOneRunLoopTurn"); // ( -- ) 
  dat("uFork_dispatchOneEvent");
  dat("uFork_doOneInstrOfContinuation");
  dat("uFork_gcOneStep");
  dat("EXIT");

  def("uFork_memoryDescriptor");
  dat("(CONST", memoryDescriptor_qaddr);

  def("uFork_eventQueueAndContQueue");
  dat("(CONST)", eventQueueAndContQueue_qaddr);

  def("uFork_#?");
  dat("(CONST)", 0x0000);

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
  }

  def("uFork_isFixnum?"); // ( specimen -- bool )
  dat("0x8000", "&", "(JMP)", "CLEAN_BOOL");

  def("uFork_isMutable?"); // ( specimen -- bool )
  dat("0x4000", "&", "(JMP)", "CLEAN_BOOL");

  def("uFork_isImmutable?"); // ( specimen -- bool )
  dat("uFork_isMutable?", "INVERT", "EXIT");

  def("uFork_fixnum2int"); // ( fixnum -- int )
  dat("0x7FFF_&", "DUP" "1<<", "0x8000", "&", "OR"); // sign extend
  dat("EXIT");

  def("uFork_int2fixnum"); // ( int -- fixnum )
  dat("DUP", "0x8000", "&", "1>>", "OR"); // move the sign bit
  dat("0x8000_OR", "EXIT"); // tag it as fixnum and return

  def("uFork_incr"); // ( fixnum -- fixnum )
  dat("uFork_fixnum2int", "1+", "uFork_int2fixnum", "EXIT");

  def("uFork_decr"); // ( fixnum -- fixnum )
  dat("uFork_fixnum2int", "1-", "uFork_int2fixnum", "EXIT");

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
  
  def("uFork_doOneInstrOfContinuation"); // ( -- )
  dat("uFork_eventQueueAndContQueue", "qy@"); // ( k_head )
  dat("DUP", "qz@");    // ( k_head k_next )
  dat("uFork_eventQueueAndContQueue", "qy!"); // ( k_head )
  dat("DUP", "uFork_fetchAndExec");
  dat("DUP", "uFork_enqueueCont"); // ( k_head )
  dat("EXIT");

  def("uFork_fetchAndExec"); // ( kont -- )
  // todo: insert sponsor instr fuel check&burn here.
  dat("DUP", "qt@");         // ( kont ip )
  // todo: insert ip #instr_t check here
  dat("DUP", "qx@");         // ( kont ip opcode )
  // dat("(JMP)", "uFork_doInstr"); fallthrough
  def("uFork_doInstr"); // ( opcode -- )
  dat("(JMPTBL)");
  dat(31); // number of base instructions
  dat("uFork_instr_nop");
  dat("uFork_instr_push");
  dat("uFork_instr_dup");
  dat("uFork_instr_drop");
  dat("uFork_instr_pick");
  dat("uFork_instr_roll");
  dat("uFork_instr_alu");
  dat("uFork_instr_typeq");
  dat("uFork_instr_eq");
  dat("uFork_instr_cmp");
  dat("uFork_instr_if");
  dat("uFork_instr_jump");
  dat("uFork_instr_pair");
  dat("uFork_instr_part");
  dat("uFork_instr_nth");
  dat("uFork_instr_dict");
  dat("uFork_instr_deque");
  dat("uFork_instr_quad");
  dat("uFork_instr_msg");
  dat("uFork_instr_state");
  dat("uFork_instr_my");
  dat("uFork_instr_send");
  dat("uFork_instr_signal");
  dat("uFork_instr_new");
  dat("uFork_instr_beh");
  dat("uFork_instr_end");
  dat("uFork_instr_sponsor");
  dat("uFork_instr_assert");
  dat("uFork_instr_debug");
  dat("uFork_instr__subroutine_call");
  dat("uFork_instr__subroutine_exit");
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

  // todo: refactor following to use uFork_cons
  def("uFork_push");    // ( item kont -- )
  dat(">R");            // ( item ) R:( kont )
  dat("uFork_allot");   // ( item q ) R:( kont )
  dat("SWAP");          // ( q item ) R:( kont )
  dat("OVER");          // ( q item q ) R:( kont )  Q:[#?, #?, #?, #?]
  dat("qx!");           // ( q ) R:( kont )         Q:[#?, item, #?, #?]
  dat("uFork_#pair_t"); // ( q #pair_t ) R:( kont ) Q:[#?, item, #?, #?]
  dat("OVER", "qt!");   // ( q ) R:( kont )         Q:[#pair_t, item, #?, #?]
  dat("DUP", "R@");     // ( q q kont ) R:( kont )  Q:[#pair_t, item, #?, #?]
  dat("uFork_sp@");     // ( q q stack ) R:( kont ) Q:[#pair_t, item, #?, #?]
  dat("SWAP", "qy!");   // ( q ) R:( kont )         Q:[#pair_t, item, stack, #?]
  dat("R>");            // ( q kont ) R:( )         Q:[#pair_t, item, stack, #?]
  dat("uFork_sp!");     // ( )
  dat("EXIT");
  
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
  dat("uFork_sp@");        // ( kont item sp_tail )
  dat("uFork_cons");       // ( kont pair_quad )
  dat("OVER");             // ( kont pair_quad kont )
  dat("uFork_sp!");        // ( kont )
  def("uFork_instr__common_longer_tail"); // ( kont -- )
  dat("DUP", "qt@");       // ( kont ip )
  dat("(JMP)", "uFork_instr__common_tail");

  def("uFork_instr_dup"); // ( kont ip opcode )
  dat("DROP");            // ( kont ip )
  dat("qy@");             // ( kont n )
  // todo: insert fixnum type check here for n
  // todo: insert allot fuel check&burn here taking n into consideration
  dat(">R");              // ( kont ) R:( n )
  dat("DUP", "uFork_sp@", "uForm_allot"); // ( kont stack tmp ) R:( n )
  dat("DUP", "R>", "SWAP", ">R", ">R");   // ( kont stack tmp ) R:( tmp1st n )
  dat("(JMP)", "uFork_instr_dup_l1");
  def("uFork_instr_dup_l0"); // ( kont tmp stack )
  dat("OVER");         // ( kont stack tmp stack )
  dat("qx@");          // ( kont stack tmp item  )
  // -merkill1- hvað var þetta aftur?
  dat("uFork_allot");  // ( kont stack tmp item qa ) Qn:[#?, #?, <hole>, #?]
  dat("DUP", ">R");    // ( kont stack tmp item qa ) R:( tmp1st n qa ) Qn:[#?, #?, <hole>, #?]
  dat("qx!");          // ( kont stack tmp ) R:( tmp1st n qa ) Qn:[#?, item, <hole>, #?]
  dat("uFork_#pair_t");
  dat("R@", "qt!");    // ( kont stack tmp ) R:( tmp1st n qa ) Qn:[#pair_t, item, <hole>, #?]
  dat("R@", "SWAP");   // ( kont stack qa tmp ) R:( tmp1st n qa )
  dat("qy!"); // fill earlier hole ( kont stack ) R:( tmp1st n qa )
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
  dat("(BRZ)", "uFork_instr_pick_l0"); // ( kont n )
  dat("1-", ">R");         // ( kont ) R:( count )
  dat("DUP", "uFork_sp@"); // ( kont stack ) R:( count )
  dat("(JMP)", "uFork_instr_pick_l2");
  def("uFork_instr_pick_l1"); // ( kont stack ) R:( count )
  dat("qy@"); // ( kont next_stack )
  def("uFork_instr_pick_l2"); // ( kont stack ) R:( count )
  dat("(NEXT)", "uFork_instr_pick_l1"); // ( kont stack ) R:( )
  dat("qx@", "OVER", "uFork_push");
  dat("(JMP)", "uFork_instr__common_longer_tail");

  

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
    // todo: insert a signalling to sponsor here
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
    // todo: insert a signalling to sponsor here
  }
  
  return asm;
};

export default {
  uFork_instrHandling
};
