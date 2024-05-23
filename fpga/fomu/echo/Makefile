#
# Makefile
#

TOP = echo

all: $(TOP).vcd

clean:
	rm -f *.sim *.vcd

%.sim: %.v
	iverilog -o $@ $^

%.vcd: %.sim
	# stty raw # disable line buffering
	./$<
	# stty cooked 2>/dev/null || stty cooked # fails the first time??
