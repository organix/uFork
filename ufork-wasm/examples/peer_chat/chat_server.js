// Runs a Deno server for the Peer Chat app. It serves the HTML and JavaScript,
// and also acts as a signalling server for WebRTC connections.

// To start:

//      deno run \
//          --allow-net \
//          --allow-read=. \
//          examples/peer_chat/chat_server.js \
//          localhost:3528

/*jslint deno */

import {toFileUrl} from "https://deno.land/std@0.111.0/path/mod.ts";
import start_server from "../../www/transports/websockets_signalling_server.js";

const bind_address = Deno.args[0];
const [hostname, port_string] = bind_address.split(":");
const mime_types = {
    html: "text/html",
    js: "text/javascript",
    wasm: "application/wasm",
    svg: "image/svg+xml",
    png: "image/png",
    asm: "text/plain"
};

start_server(
    {hostname, port: Number(port_string)},
    window.console.log,
    function on_unhandled_request(request, respond_with) {

        function not_found() {
            return respond_with(new Response("", {status: 404}));
        }

        function serve(file_url) {
            const extension = file_url.pathname.split(".").pop();
            const mime_type = mime_types[extension];
            if (typeof mime_type !== "string") {
                return not_found();
            }
            return Deno.readFile(file_url).then(function (uint8array) {
                return respond_with(new Response(
                    uint8array,
                    {headers: {"content-type": mime_type}}
                ));
            }).catch(not_found);
        }

        let {pathname} = new URL(request.url);
        if (pathname === "/") {
            pathname = "/examples/peer_chat/chat.html";
        }
        const cwd = toFileUrl(Deno.cwd()) + "/";
        return serve(new URL(pathname.slice(1), cwd));
    }
);
