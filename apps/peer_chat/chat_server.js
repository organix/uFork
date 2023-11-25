// Runs a Deno server for the Peer Chat app. It serves the HTML and JavaScript,
// and also acts as a signalling server for WebRTC connections.

// To start:

//  $ deno run --allow-net --allow-read chat_server.js localhost:3528 [--dev]

// Pass the --dev flag to load source files from disk rather than
// https://lib.ufork.org.

/*jslint deno */

import {toFileUrl} from "https://deno.land/std@0.203.0/path/to_file_url.ts";
import start_server from "js/websockets_signalling_server.js";
import dev_import_map from "../../tools/import_map.js";

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
const rx_ufork_lib = /https:\/\/lib\.ufork\.org\//g;
const is_dev = Deno.args[1] === "--dev";

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
            return Deno.readFile(file_url).then(function (buffer) {
                return respond_with(new Response(
                    (

// Modify the import map to point back to this server, so that source files are
// loaded from the local repository.

                        (is_dev && file_url.pathname.endsWith("index.html"))
                        ? new TextDecoder().decode(buffer).replace(
                            rx_ufork_lib,
                            "/@/"
                        )
                        : buffer
                    ),
                    {headers: {"content-type": mime_type}}
                ));
            }).catch(not_found);
        }

        const cwd = toFileUrl(Deno.cwd()) + "/";
        let {pathname} = new URL(request.url);
        let file_url;
        if (pathname === "/") {
            file_url = new URL("./index.html", cwd);
        } else if (pathname.startsWith("/@/")) {
            pathname = pathname.slice(3);
            const alias = Object.keys(dev_import_map).find(function (key) {
                return pathname.startsWith(key);
            });
            file_url = new URL(pathname.replace(alias, dev_import_map[alias]));
        } else {
            file_url = new URL(pathname.slice(1), cwd);
        }
        return serve(file_url);
    }
);
