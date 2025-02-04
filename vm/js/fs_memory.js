// An in-memory filesystem.

/*jslint web, global */

import concat_bytes from "https://ufork.org/lib/concat_bytes.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import fs_demo from "./fs_demo.js";

function fs_memory() {
    const files = Object.create(null); // url -> Uint8Array

    function open(create) {
        return requestorize(function (file_url) {
            const href = new URL(file_url).href;
            if (files[href] === undefined) {
                if (create) {
                    files[href] = new Uint8Array(0);
                } else {
                    throw new Error("File does not exist.");
                }
            }
            let position = 0;
            let is_open = true;
            return Object.freeze({
                read(size) {
                    return requestorize(function () {
                        if (!is_open) {
                            throw new Error("File closed.");
                        }
                        if (position >= files[href].length) {
                            return false; // EOF
                        }
                        const bytes = files[href].slice(
                            position,
                            position + size
                        );
                        position += bytes.length;
                        return bytes;
                    });
                },
                write() {
                    return requestorize(function (bytes) {
                        if (!is_open) {
                            throw new Error("File closed.");
                        }
                        const chunks = [
                            files[href].slice(0, position),
                            bytes,
                            files[href].slice(position + bytes.length)
                        ];
                        files[href] = chunks.reduce(concat_bytes);
                        position += bytes.length;
                        return bytes.length;
                    });
                },
                seek(offset) {
                    return requestorize(function () {
                        if (!is_open) {
                            throw new Error("File closed.");
                        }
                        if (!Number.isSafeInteger(offset)) {
                            throw new Error("Bad offset.");
                        }
                        position = offset;
                        if (position < 0) {
                            position = 0;
                            return false;
                        }
                        if (position > files[href].length) {
                            position = files[href].length;
                            return false;
                        }
                        return true;
                    });
                },
                close() {
                    is_open = false;
                }
            });
        });
    }

    function stat() {
        return requestorize(function (file_url) {
            const href = new URL(file_url).href;
            if (files[href] === undefined) {
                return false;
            }
            return {size: files[href].length};
        });
    }

    return Object.freeze({open, stat});
}

if (import.meta.main) {
    fs_demo(fs_memory(), globalThis.console.log);
}

export default Object.freeze(fs_memory);
