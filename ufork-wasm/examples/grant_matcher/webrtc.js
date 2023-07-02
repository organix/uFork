// Runs a Deno server supporting the Grant Matcher browser demo.

/*jslint deno */

import {toFileUrl} from "https://deno.land/std@0.111.0/path/mod.ts";
import start_server from "../../www/transports/websockets_signalling_server.js";

const bind_address = Deno.args[0];
const [hostname, port_string] = bind_address.split(":");
const mime_types = {
    js: "text/javascript",
    wasm: "application/wasm",
    asm: "text/plain"
};

start_server(
    {hostname, port: Number(port_string)},
    window.console.log,
    function on_unhandled_request(request, respond_with) {
        const {pathname} = new URL(request.url);
        const extension = pathname.split(".").pop();

        function not_found() {
            return respond_with(new Response("", {status: 404}));
        }

        function serve(file_url) {
            return Deno.readFile(file_url).then(function (uint8array) {
                return respond_with(new Response(
                    uint8array,
                    {headers: {"content-type": mime_types[extension]}}
                ));
            }).catch(not_found);
        }

        if (
            pathname === "/gm"
            || pathname === "/keqd"
            || pathname === "/donor"
        ) {
            return respond_with(new Response(
                (
                    "<script type=\"module\" src=\"/examples/grant_matcher/"
                    + pathname.slice(1)
                    + ".js\"></script>"
                ),
                {headers: {"content-type": "text/html"}}
            ));
        }
        const cwd = toFileUrl(Deno.cwd()) + "/";
        if (typeof mime_types[extension] === "string") {
            return serve(new URL(pathname.slice(1), cwd));
        }
        if (pathname === "/favicon.ico") {
            return serve(new URL("./www/favicon-128.png", cwd));
        }
        return not_found();
    }
);
