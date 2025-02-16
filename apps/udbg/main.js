// Renders the remote debugger component and connects it to a remote core.

/*jslint browser, global */

import websockets_bridge from "https://ufork.org/js/udbg/websockets_bridge.js";
import debugger_ui from "https://ufork.org/js/udbg/debugger_ui.js";

const params = new URLSearchParams(location.hash.slice(1));
const url = params.get("url") ?? "ws://127.0.0.1:8325";
let debugger_element;
let bridge;

function connect() {

// Attempt to connect to the core only if currently disconnected and the page is
// visible. Browsers apply heavy throttling to hidden pages, so there
// is no point attempting to maintain a connection in that case.

    if (bridge === undefined && document.visibilityState === "visible") {
        bridge = websockets_bridge.connect(
            url,
            debugger_element.receive_status,
            function on_connectivity(open) {
                if (!open) {
                    bridge = undefined;
                    setTimeout(connect, 250);
                }
                debugger_element.set_connected(open);
            }
        );
    }
}

debugger_element = debugger_ui({
    send_command(message) {
        bridge.send(message);
    }
});
debugger_element.style.position = "fixed";
debugger_element.style.inset = "0";
document.body.append(debugger_element);
document.addEventListener("visibilitychange", connect);
connect();
