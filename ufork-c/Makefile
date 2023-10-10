#
# Makefile for uFork
#
# Copyright 2022 Dale Schumacher
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

CFLAGS=	-Wall
#CFLAGS=	-g -Wall

CC=	cc $(CFLAGS)

HDRS=	ufork.h \
	runtime.h \
	debug.h

SRCS=	ufork.c \
	runtime.c \
	debug.c

ASMS=	boot.asm \
	scheme.asm \
	lib_scm.asm \
	peg.asm \
	scm_peg.asm \
	peg_scm.asm \
	act_scm.asm \
	asm_scm.asm

PGM=	ufork

all: $(PGM)

ufork: $(HDRS) $(SRCS) $(ASMS)
	$(CC) -Os -o $(PGM) $(SRCS)

clean:
	rm -f *.o
	rm -f *~ core
	rm -f $(PGM)
