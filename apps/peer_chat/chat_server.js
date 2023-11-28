// Runs a Deno server for the Peer Chat app. It serves the HTML and JavaScript,
// and also acts as a signalling server for WebRTC connections.

// To start:

//  $ deno run --allow-net --allow-read chat_server.js localhost:3528 [--dev]

// Pass the --dev flag to load source files from disk instead of
// https://ufork.org.

/*jslint deno */

import start_server from "https://ufork.org/js/websockets_signalling_server.js";
const lib_href = import.meta.resolve("../../lib/");
const js_href = import.meta.resolve("../../vm/js/");
const wasm_href = import.meta.resolve("../../vm/wasm/");
const cwd_href = import.meta.resolve("./");

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
const is_dev = Deno.args[1] === "--dev";
const importmap_html = `
    <script type="importmap">
        {"imports": {"https://ufork.org/": "/@/"}}
    </script>
`;
const dev_import_map = {
    "/@/lib/": lib_href,
    "/@/js/": js_href,
    "/@/wasm/": wasm_href
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
            return Deno.readFile(file_url).then(function (buffer) {
                return respond_with(new Response(
                    (

// Provide an import map pointing back to this server, so that source files
// are loaded from disk.

                        (is_dev && file_url.pathname.endsWith("index.html"))
                        ? new TextDecoder().decode(buffer).replace(
                            "<!-- importmap goes here -->",
                            importmap_html
                        )
                        : buffer
                    ),
                    {headers: {"content-type": mime_type}}
                ));
            }).catch(not_found);
        }

        let {pathname} = new URL(request.url);
        let file_url;
        if (pathname === "/") {
            file_url = new URL("./index.html", cwd_href);
        } else if (pathname.startsWith("/@/")) {
            const alias = Object.keys(dev_import_map).find(function (key) {
                return pathname.startsWith(key);
            });
            file_url = new URL(pathname.replace(alias, dev_import_map[alias]));
        } else {
            file_url = new URL(pathname.slice(1), cwd_href);
        }
        return serve(file_url);
    }
);
