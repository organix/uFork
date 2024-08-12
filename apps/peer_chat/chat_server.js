// Runs the server for the Peer Chat app. It serves the HTML and JavaScript, and
// also acts as a signalling server for WebRTC connections.

// To start, run one of the following

//  $ deno run --allow-net --allow-read chat_server.js localhost:3528 [--local]

//  $ node \
//      --experimental-default-type=module \
//      chat_server.js
//      localhost:3528 \
//      [--local]

// Pass the --local flag to load source files from disk instead of
// https://ufork.org.

/*jslint node, deno */

import console from "node:console";
import fs from "node:fs";
import http from "node:http";
import process from "node:process";
import make_signalling_server from "./websockets_signalling_server_node.js";
const lib_href = import.meta.resolve("../../lib/");
const js_href = import.meta.resolve("../../vm/js/");
const wasm_href = import.meta.resolve("../../vm/wasm/");
const cwd_href = import.meta.resolve("./");

const mime_types = {
    html: "text/html",
    js: "text/javascript",
    wasm: "application/wasm",
    svg: "image/svg+xml",
    png: "image/png",
    asm: "text/plain"
};
const bind_address = process.argv[2];
const [hostname, port_string] = bind_address.split(":");
const port = Number(port_string);
const is_dev = process.argv[3] === "--local";
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

const server = http.createServer(function (req, res) {

    function not_found() {
        res.statusCode = 404;
        return res.end();
    }

    function serve(file_url) {
        const extension = file_url.pathname.split(".").pop();
        const mime_type = mime_types[extension];
        if (typeof mime_type !== "string") {
            return not_found();
        }
        return fs.promises.readFile(file_url).then(function (buffer) {
            res.statusCode = 200;
            res.setHeader("content-type", mime_type);
            return res.end(

// Provide an import map pointing back to this server, so that source files
// are loaded from disk.

                (is_dev && file_url.pathname.endsWith("index.html"))
                ? new TextDecoder().decode(buffer).replace(
                    "<!-- importmap goes here -->",
                    importmap_html
                )
                : buffer
            );
        }).catch(not_found);
    }

    let {pathname} = new URL(req.url, "http://dummy");
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

});
make_signalling_server(server, console.log);
server.listen(port, hostname);
