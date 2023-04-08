a:
    ref 42

b:
    ref a

d:
    alu xor c

c:
    alu not
    ref b
