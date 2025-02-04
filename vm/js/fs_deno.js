// A filesystem for Deno.

/*jslint deno, global */

import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import unpromise from "https://ufork.org/lib/rq/unpromise.js";
import fs_demo from "./fs_demo.js";

function fs_deno() {

    function make_handle(file) {

        function read(size) {
            return unpromise(function () {
                let scratch = new Uint8Array(size);
                return file.read(scratch).then(function (nr_bytes_read) {
                    if (Number.isSafeInteger(nr_bytes_read)) {
                        return new Uint8Array(scratch.buffer, 0, nr_bytes_read);
                    }
                    return false; // EOF
                });
            });
        }

        function write() {
            return unpromise(function write_from(bytes, position = 0) {
                if (position >= bytes.byteLength) {
                    return position;
                }
                const remaining = new Uint8Array(bytes.buffer, position);
                return file.write(remaining).then(function (nr_bytes_written) {
                    return write_from(bytes, position + nr_bytes_written);
                });
            });
        }

        function seek(offset) {
            return parseq.sequence([
                unpromise(function () {
                    return file.stat();
                }),
                unpromise(function (info) {
                    const clamped = Math.max(0, Math.min(offset, info.size));
                    const seek_mode_start = 0;
                    return file.seek(offset, seek_mode_start).then(function () {
                        return clamped === offset;
                    });
                })
            ]);
        }

        function close() {
            file.close();
        }

        return Object.freeze({read, write, seek, close});
    }

    function open(create) {
        return parseq.sequence([
            unpromise(function (file_url) {
                return Deno.open(file_url, {
                    read: true,
                    write: true,
                    create
                });
            }),
            requestorize(make_handle)
        ]);
    }

    function stat() {
        return unpromise(function (file_url) {
            return Deno.stat(
                file_url
            ).then(function (file_info) {
                return {size: file_info.size};
            }).catch(function (error) {
                return (
                    error.code === "ENOENT"
                    ? false // nonexistant
                    : Promise.reject(error)
                );
            });
        });
    }

    return Object.freeze({open, stat});
}

if (import.meta.main) {
    fs_demo(fs_deno(), globalThis.console.log);
}

export default Object.freeze(fs_deno);
