// Renders the remote debugger component and connects it to a remote core.

/*jslint browser, global */

import dom from "https://ufork.org/lib/dom.js";
import theme from "https://ufork.org/lib/theme.js";
import websockets_bridge from "https://ufork.org/js/udbg/websockets_bridge.js";
import window_bridge from "https://ufork.org/js/udbg/window_bridge.js";
import debugger_ui from "https://ufork.org/js/udbg/debugger_ui.js";

const params = new URLSearchParams(location.hash.slice(1));
const url = params.get("url") ?? "ws://127.0.0.1:8325";
const origin = params.get("origin");
const session = params.get("session");
let debugger_element;
let bridge;

function reset() {
    if (debugger_element !== undefined) {
        debugger_element.remove();
    }
    debugger_element = debugger_ui({
        send_command(message) {
            bridge.send(message);
        }
    });
    debugger_element.style.position = "fixed";
    debugger_element.style.inset = "0";
    document.body.append(debugger_element);
}

function on_status(message) {
    if (message.kind === "reset") {
        reset();
        debugger_element.set_connected(true);
    } else {
        debugger_element.receive_status(message);
    }
}

function connect() {

// Attempt to connect to the core only if currently disconnected and the page is
// visible. Browsers apply heavy throttling to hidden pages, so there
// is no point attempting to maintain a connection in that case.

    if (bridge === undefined && document.visibilityState === "visible") {
        if (origin) {
            bridge = window_bridge(
                globalThis.opener,
                origin,
                session,
                on_status
            );
            debugger_element.set_connected(true);
        } else {
            bridge = websockets_bridge.connect(
                url,
                on_status,
                function on_connectivity(open) {
                    if (open) {
                        reset();
                    } else {
                        bridge = undefined;
                        setTimeout(connect, 250);
                    }
                    debugger_element.set_connected(open);
                }
            );
        }
    }
}

reset();
document.head.append(dom("style", theme.monospace_font_css));
document.addEventListener("visibilitychange", connect);
connect();
