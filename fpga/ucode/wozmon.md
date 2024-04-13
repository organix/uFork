# Wozmon cheatsheat

Each command is on its own line.

Command: | Action: | Description:
---------|---------|-------------
 <hex>   | Examine | the contents of uCode memory address <hex> is printed out
 <hex1>.<hex2> | Examine block | the contents of uCode memory block from address <hex1> to <hex2> is printed out
 <hex1>:<hex2>\[<space><hexN>\[...\]\] | Poke data into memory | Puts data <hex2> to <hexN> into uCode memory starting at address <hex1>
 <hex> R | Run code | Start running code at uCode memory address <hex>. This is effectively a call to that address, returning leads back to wozmon.
 Q | Exit Wozmon | returns to whatever called wozmon. Usually the boot loop that calls back to wozmon but usefull in other cases.

 

 
