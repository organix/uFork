// A bridge client/server that uses postMessage to securely communicate with a
// server/client running in another browser window.

/*jslint browser, global */

const self_href = import.meta.resolve("./window_bridge.js");

function window_bridge(remote_window, remote_origin, session, on_message) {

    function on_message_event(event) {
        if (event.origin === remote_origin && event.data?.session === session) {
            on_message(event.data.message);
        }
    }

    addEventListener("message", on_message_event);
    return Object.freeze({
        send(message) {
            remote_window.postMessage({message, session}, remote_origin);
        },
        dispose() {
            removeEventListener("message", on_message_event);
        }
    });
}

function demo(log) {
    const session = Math.random();
    const remote_window = globalThis.open();
    const server = window_bridge(
        remote_window,
        remote_window.origin,
        session,
        function on_message(message) {
            log("on_message", message);
            setTimeout(server.send, 500, message + 1);
        }
    );
    remote_window.eval(`
        import("${self_href}").then(function (module) {
            const client = module.default(
                globalThis.opener,
                "${globalThis.origin}",
                ${session},
                function on_message(message) {
                    client.send(message); // echo
                }
            );
            client.send(0);
        });
    `);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(window_bridge);
