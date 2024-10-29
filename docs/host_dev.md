# uFork Host Device

The **Host Device** extends the set of built-in devices with **dynamic**
devices. Dynamic devices can be installed without recompiling the uFork WASM
core, or indeed any time the core is not dispatching an event.

## Differences with "real" devices

A real device, such as the timer device, provides a single capability at boot
time. This capability is attached to the root set, and as such is not vulnerable
to garbage collection. uFork programs interact with the device by sending
messages to the device's capability.

A dynamic device, on the other hand, makes any number of capabilities in the
form of [proxies](ocaps.md). Proxies can be provided to the program at boot
time, or introduced later. Proxies are vulnerable to garbage collection unless
attached to the root set via a stub.

## Installing a dynamic device

Before installing a dynamic device, the host device must first be installed.
The `host_dev` constructor returns a `make_ddev` function that makes dynamic
devices.

```javascript
import ufork from "https://ufork.org/js/ufork.js";
import host_dev from "https://ufork.org/js/host_dev.js";

const core = ufork.make_core(/* ... */);
const make_ddev = host_dev(core);
const ddev = make_ddev(on_event_stub, on_drop_proxy);
```

We will discuss the `on_event_stub` and `on_drop_proxy` callbacks in the next
section. Now that we have a dynamic device, `ddev`, we can make a proxy and
install it as a boot capability. Here, the proxy is protected from garbage
collection by a stub.

```javascript
let proxy = ddev.h_reserve_proxy();
let stub = ddev.h_reserve_stub(proxy);
core.h_install(core.u_fixnum(1234), proxy);
```

The following assembly program would extract `proxy` from the boot caps dict and
send it the message `42`.

```
boot:                   ; _ <- {caps}
    push 42             ; 42
    msg 0               ; 42 {caps}
    push 1234           ; 42 {caps} 1234
    dict get            ; 42 proxy
    actor send          ; --
    end commit
.export
    boot
```

## Receiving a message

When a dynamic device's proxy receives a message, the `on_event_stub` callback
is called with a raw pointer to the event stub associated with the message. The
event stub contains both the message and the proxy.

If the message is found to be acceptable, `on_event_stub` should return
`ufork.E_OK` and call `core.u_defer` with a callback that will, at the very
least, release the event stub via `core.h_release_stub`. It is necessary to
defer any calls to the core's non-reentrant methods, such as
`core.h_release_stub`, because `on_event_stub` is called by the core.

If the message can not be handled, perhaps because it is malformed,
`on_event_stub` should return an error code such as `ufork.E_NOT_FIX`. Upon
failure, the event stub is released automatically so there is no need to call
`core.h_release_stub`.

For example, the following `on_event_stub` implementation prints the message to
the console if it is a fixnum, and fails otherwise.

```javascript
function on_event_stub(event_stub_raw) {
    const event_stub = core.u_read_quad(event_stub_raw);
    const event = core.u_read_quad(event_stub.y);
    const message = event.y;
    if (!core.u_is_fix(message)) {
        return ufork.E_NOT_FIX;
    }
    core.u_defer(function callback() {
        console.log("message", core.u_fix_to_i32(message));
        core.h_release_stub(event_stub_raw);
    });
    return ufork.E_OK;
}
```

### Proxy tag

Each proxy can be assigned a tag, making it possible to distinguish between
proxies in `on_event_stub` and `on_drop_proxy`. A tag may be any value, and
does not have to be unique.

```javascript
let proxy_true = ddev.h_reserve_proxy(ufork.TRUE_RAW);
let proxy_false = ddev.h_reserve_proxy(ufork.FALSE_RAW);
```

The tag is stored in the proxy's handle, which also contains routing information
used by the host device. To retrieve the tag, use the `u_tag` method.

```javascript
function on_event_stub(event_stub_raw) {
    const event_stub = core.u_read_quad(event_stub_raw);
    const proxy = core.u_read_quad(core.u_cap_to_ptr(event_stub.x));
    const handle = proxy.y;
    const tag = ddev.u_tag(handle);
    if (tag === ufork.TRUE_RAW) {
        // The message was received by proxy_true.
    }
    // ...
}
```

## Dropping proxies

The dynamic device's `on_drop_proxy` callback is called whenever one of its
proxies is garbage collected. The following `on_drop_proxy` implementation
prints the tag of proxies as they are dropped.

```javascript
function on_drop_proxy(proxy_raw) {
    const quad = core.u_read_quad(core.u_cap_to_ptr(proxy_raw));
    const tag = ddev.u_tag(quad.y);
    console.log("dropped", core.u_pprint(tag));
}
```

## Disposal

A dynamic device may be uninstalled by calling its `ddev.h_dispose` method.
The `on_event_stub` and `on_drop_proxy` callbacks will no longer be called.

A dynamic device may reserve resources on the host that should be released when
the core is disposed. In such cases, an `on_dispose` callback should be
supplied to `h_install`, like so:

```javascript
core.h_install(
    core.u_fixnum(1234),
    proxy,
    function on_dispose() {
        // release resources...
    }
);
