// @ts-check js
/**
 * @use JSDoc
 * @overview Implements the uFork instructionset in microcode
 * @author Zarutian
 */
// using uFork/docs/vm.md as reference

export const uFork_instrHandling = (asm, opts) => {
  opts = (opts == undefined) ? {} : opts ;
  const eventQueueAndContQueue_qaddr = (opts.eventQueueAndContQueue_qaddr == undefined ) ?
    0x4001 : opts.eventQueueAndContQueue_qaddr ;
  const memoryDescriptor_qaddr = (opts.memoryDescriptor_qaddr == undefined) ?
    0x4000 : opts.memoryDescriptor_qaddr ;
  const uForkSubroutines = (opts.uForkSubroutines == undefined) ? false : opts.uForkSubroutines ;
  
  def("uFork_doOneSnú"); // ( -- ) 
  dat("uFork_dispatchOneEvent");
  dat("uFork_doOneInstrOfContinuation");
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
    dat("OVER", "uFork_rp!");
    dat("(JMP)", "uFork_instr__common_longer_tail");
  } else {
  }

  def("uFork_instr__subroutine_exit"); // ( kont ip opcode -- )
  
  return asm;
};

export default {
  uFork_instrHandling
};
