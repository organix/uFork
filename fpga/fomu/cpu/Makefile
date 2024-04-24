#
# Makefile
#

ALL =	alu.vcd \
	alu.dfu \
	lifo.vcd \
	lifo.dfu \
	cpu.vcd \
	cpu.dfu

all: ucode_rom.mem $(ALL)

install: cpu.dfu
	dfu-util -D cpu.dfu

clean: ucode_rom.mem
	rm -f *.sim *.vcd *.json *.log *.asc *.bit *.dfu abc.history

%.sim: %_tb.v
	iverilog -o $@ $^

%.vcd: %.sim
	./$<

%.json: %_top.v
	yosys -p 'synth_ice40 -json $@' $^ >yosys.log

%.asc: %.json
	nextpnr-ice40 --up5k --package uwg30 --freq 12 --pcf pins.pcf --json $< --asc $@

%.bit: %.asc
	icepack $< $@

%.dfu: %.bit
	cp $< $@
	dfu-suffix -v 1209 -p 70b1 -a $@

ucode_rom.mem: ucode.js ucode_cli.js ucode.f
	deno run ucode_cli.js <ucode.f >ucode_rom.mem
