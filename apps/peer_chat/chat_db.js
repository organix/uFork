/*jslint browser, global */

import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import thru from "https://ufork.org/lib/rq/thru.js";
import webrtc_transport from "https://ufork.org/js/webrtc_transport.js";
import indexed_db from "./indexed_db.js";

const db_version = 4; // bump to clear DB
const transport = webrtc_transport();
const awp_store_key = "awp_store";
const max_session_duration = 24 * 60 * 60 * 1000;

function db(...args) {
    return indexed_db(
        "peer_chat",
        db_version,
        function on_upgrade(db, old_version) {
            if (old_version < db_version) {
                db.createObjectStore("v" + db_version);
            }
        },
        "v" + db_version,
        ...args
    );
}

function make_chat_db(signaller_origin) {

    function set_store() {
        return thru(db(function (db_store, awp_store) {
            return db_store.put(awp_store, awp_store_key);
        }));
    }

    function get_store() {

// Attempts to read an AWP store object from IndexedDB. If one is not found, or
// if it is about to expire, a new one is generated and saved.

        return parseq.fallback([
            parseq.sequence([
                db(function (db_store) {
                    return db_store.get(awp_store_key);
                }),
                requestorize(function check_certificate_expiry(awp_store) {
                    if (
                        awp_store.identity.certificate.expires
                        < Date.now() + max_session_duration
                    ) {
                        throw "old";
                    }
                    return awp_store;
                })
            ]),
            parseq.sequence([
                transport.generate_identity(),
                requestorize(function (identity) {
                    return {
                        identity,
                        bind_info: {
                            origin: signaller_origin,
                            password: "uFork"
                        },
                        acquaintances: [{
                            name: transport.identity_to_name(identity),
                            address: signaller_origin
                        }]
                    };
                }),
                set_store()
            ])
        ]);
    }

    return Object.freeze({get_store, set_store});
}

if (import.meta.main) {
    make_chat_db().get_store()(globalThis.console.log);
}

export default Object.freeze(make_chat_db);
