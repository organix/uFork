// @ts-check js
/**
 * @use JSDoc
 * @overview Implements the uFork instructionset in microcode
 * @author Zarutian
 */
// using uFork/docs/vm.md as reference
// also using uFork/docs/sponsor.md as reference

export const uFork = (asm, opts) => {
  opts = (opts == undefined) ? {} : opts ;
  const eventQueueAndContQueue_qaddr = (opts.eventQueueAndContQueue_qaddr == undefined ) ?
    0x4001 : opts.eventQueueAndContQueue_qaddr ;
  const memoryDescriptor_qaddr = (opts.memoryDescriptor_qaddr == undefined) ?
    0x4000 : opts.memoryDescriptor_qaddr ;
  const uForkSubroutines = (opts.uForkSubroutines == undefined) ? false : opts.uForkSubroutines ;
  const hwImplOfQuadAllotAndFree = (opts.hwImplOfQuadAllotAndFree == undefined) ? false : opts.hwImplOfQuadAllotAndFree ;
  const maxTopOfQuadMemory = (opts.maxTopOfQuadMemory == undefined) ? 0x5000 : opts.maxTopOfQuadMemory ;

  const { def, dat } = asm;
  
  def("uFork_doOneRunLoopTurn"); // ( -- ) 
  dat("uFork_dispatchOneEvent");
  dat("uFork_doOneInstrOfContinuation");
  dat("uFork_gcOneStep");
  dat("EXIT");

  def("uFork_memoryDescriptor");
  dat("(CONST", memoryDescriptor_qaddr);

  def("uFork_eventQueueAndContQueue");
  dat("(CONST)", eventQueueAndContQueue_qaddr);

  def("uFork_#?", "ZERO");

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
  // def("uFork_doInstr"); // ( opcode -- )
  dat("(JMPTBL)");
  dat(33); // number of base instructions
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
  dat("uFork_instr__rpush");
  dat("uFork_instr__rpop");
  dat("uFork_instr__subroutine_call");
  dat("uFork_instr__subroutine_exit");
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
  dat("qx@", "OVER", "uFork_push");
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
  dat("(JMPTBL)");
  dat(12); // nr of entries
  dat("uFork_instr_alu_not");
  dat("uFork_instr_alu_and");
  dat("uFork_instr_alu_or");
  dat("uFork_instr_alu_xor");
  dat("uFork_instr_alu_add");
  dat("uFork_instr_alu_sub");
  dat("uFork_instr_alu_mul");
  dat("uFork_instr_alu_lsl");
  dat("uFork_instr_alu_lsr");
  dat("uFork_instr_alu_asr");
  dat("uFork_instr_alu_rol");
  dat("uFork_instr_alu_ror");
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
  dat("OVER");                // ( kont fixnum kont )
  dat("uFork_push");          // ( kont )
  dat("(JMP)", "uFork_instr__common_longer_tail");

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
  dat("uFork_instr_cmp_eq");
  dat("uFork_instr_cmp_ne");
  dat("uFork_instr_cmp_lt");
  dat("uFork_instr_cmp_le");
  dat("uFork_instr_cmp_ge");
  dat("uFork_instr_cmp_gt");
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
  dat("SWAP");              // ( kont pairlist n )
  dat("uFork_ndeep");       // ( kont item|tail )
  dat("OVER", "uFork_push"); // ( kont )
  dat("(JMP)", "uFork_instr__common_longer_tail");

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

  def("uFork_instr_dict_has"); // ( kont subopcode )
  dat("DROP");                 // ( kont )
  // todo: insert here a check that uFork NOS is of #dict_t
  dat("DUP", "uFork_pop");     // ( kont key )
  dat("OVER", "uFork_pop");    // ( kont key dict )
  dat("FALSE", "-ROT");        // ( kont bool key dict )
  dat("uFork_dict_forEach", "uFork_instr_dict_has_l0"); // ( kont bool key )
  dat("DROP", "(JMP)", "uFork_instr_typeq_l1");
  def("uFork_instr_dict_has_l0"); // ( bool key dict -- bool key dict )
  dat("DUP", ">R", "qx@");        // ( bool key dkey ) R:( dict )
  dat("OVER", "=", "ROT");        // ( key dbool bool ) R:( dict )
  dat("OR", "SWAP", "R>");        // ( bool key dict ) R:( )
  dat("EXIT");
  

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
  
  return asm;
};

export default {
  uFork
};
