# uFork/uCode Debugging

The [uFork playground](https://ufork.org/playground/?src=https://ufork.org/test/spn_test.asm)
provides a browser-based development environment for uFork programs.
Normally, the best way to test a uFork program
is to simply run it in the WASM environment
by clicking on the [Boot] or [Test] buttons.
If more detail is needed,
using shift+click on the [Boot] or [Test] buttons
will launch the uFork debugger in a separate window.

If you are running the uCode/uFork environment
on a [Fomu FPGA board](../fomu/README.md),
you can upload your uFork program to the running device
by clicking on the [Fomu] button.
If you don't have a Fomu,
or you want to debug the uCode machine itself,
you can launch the browser-based uCode debugger
using shift+click on the [Fomu] button.

## uCode Debugging Session

The uCode debugger simulates the uCode processor design
specified by the [Verilog gateware](../fomu/cpu/README.md).
Use the [Step] and [Play/Pause] buttons
to control execution of uCode instructions.
For this example session, click the [Play] button
to run the debugger at full speed.

Initially, the uCode machine runs a simple serial-port echo loop.
Each byte received is echoed as a four-digit hexadecimal number.
Scroll down to the bottom of the debugger
to access the Console I/O controls for Output and Input.
Select the ^C Line Ending and click the [Send] button.
^C echos `0003` and breaks out of the echo loop into the monitor.

The "> " prompt indicates that the [monitor](../fomu/cpu/monitor.md)
is waiting for input. The playground uses the monitor
to upload and run uFork programs on the Fomu hardware.
We won't be using the monitor.
When the playground launches the uCode debugger
(via shift+click on the [Fomu] button)
the uFork program is embedded in the uCode image.
[`spn_test.asm`](https://ufork.org/playground/?src=https://ufork.org/test/spn_test.asm)
should have been loaded from the playground,
so we can just [Send] another ^C from the uCode debugger
to leave the monitor and start running uFork.
The console Output should look like this:

```
0003

> #8ABE

#800B

#801F



8000> 
```

This corresponds to the output that would appear
in the I/O panel of the playground
if you ran the program using the [Boot] button
as previously described.

```
+2750 
+11 
+31 
```

The sponsor-test program sends the fixnum `+2750`
(encoded as `8ABE` hex) from the boot behavior.
Then it creates a sponsor, under which it starts counting
the nodes in a binary tree of depth five.
When the sponsor exhausts its event quota,
the computation is suspended and the controller is notified.
The controller refills the sponsor's event quota
and queries the counter to see how far it has gotten.
The answer is `+11` (`800B` hex).
When the sponsor is exhausted again,
and the quota refilled,
the counter reports `+31` (`801F` hex)
as the final value.
When all the work is done
there are no more events to deliver,
so the uFork core halts
with `E_OK` status (`8000` hex)
and control returns to the monitor.
