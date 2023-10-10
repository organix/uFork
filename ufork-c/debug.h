/*
 * debug.h -- uFork debuging tools
 * Copyright 2022 Dale Schumacher
 */

#ifndef _DEBUG_H_
#define _DEBUG_H_

void print_word(char* prefix, int_t word);
void print_quad(char* prefix, int_t quad);
void print_sexpr(int_t x);

#if INCLUDE_DEBUG
void hexdump(char *label, int_t *addr, size_t cnt);
void debug_print(char *label, int_t addr);
void print_event(int_t ep);
void print_inst(int_t ip);
void print_list(int_t xs);
void continuation_trace();
int_t debugger();
#endif // INCLUDE_DEBUG

#endif // _DEBUG_H_
