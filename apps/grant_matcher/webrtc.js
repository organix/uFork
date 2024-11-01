// Runs a Deno server supporting the Grant Matcher browser demo.

/*jslint deno, global */

import {toFileUrl} from "https://deno.land/std@0.203.0/path/to_file_url.ts";
import start_server from "https://ufork.org/js/websockets_signalling_server.js";
import import_map from "./import_map.js";

const bind_address = Deno.args[0];
const [hostname, port_string] = bind_address.split(":");
const mime_types = {
    js: "text/javascript",
    wasm: "application/wasm",
    asm: "text/plain"
};

start_server(
    {hostname, port: Number(port_string)},
    globalThis.console.log,
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
            const html = `
                <script type="importmap">
                    {"imports": {"https://ufork.org/": "/@/"}}
                </script>
                <script type="module" src="${pathname.slice(1)}.js"></script>
            `;
            return respond_with(new Response(
                html,
                {headers: {"content-type": "text/html"}}
            ));
        }
        const cwd = toFileUrl(Deno.cwd()) + "/";
        if (typeof mime_types[extension] === "string") {
            if (pathname.startsWith("/@/")) {

// Consult the import map.

                const canon = "https://ufork.org/" + pathname.slice(3);
                const alias = Object.keys(import_map).find(function (key) {
                    return canon.startsWith(key);
                });
                return serve(new URL(canon.replace(alias, import_map[alias])));
            }
            return serve(new URL(pathname.slice(1), cwd));
        }
        return not_found();
    }
);
