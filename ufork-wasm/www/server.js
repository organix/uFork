// Runs the development server.

/*jslint node */

import fs from "fs";
import path from "path";
import http from "http";

const mime_types = {
    html: "text/html",
    png: "image/png",
    svg: "image/svg+xml",
    js: "text/javascript",
    wasm: "application/wasm",
    json: "application/json",
    asm: "text/plain"
};

const server = http.createServer(function on_request(req, res) {
    const file_path = path.join(process.cwd(), req.url);
    if (!file_path.startsWith(process.cwd())) {
        res.statusCode = 400;
        return res.end("Escapee.");
    }
    return fs.readFile(file_path, function (error, buffer) {
        if (error) {
            res.statusCode = 404;
            return res.end();
        }
        res.setHeader("Content-Type", mime_types[file_path.split(".").pop()]);
        return res.end(buffer);
    });
});

server.listen(7273, "localhost", function on_listening() {
    console.log(
        "Navigate to http://localhost:"
        + server.address().port
        + "/www/index.html"
    );
});
