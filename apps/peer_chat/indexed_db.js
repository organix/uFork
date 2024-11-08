// A requestor-based interface for the browser's IndexedDB storage.

/*jslint browser, global */

import parseq from "https://ufork.org/lib/parseq.js";

function indexed_db(
    db_name,
    db_version,
    on_upgrade,
    object_store_name,
    make_store_request,
    default_result
) {
    return function indexed_db_requestor(callback, value) {

        function fail(event) {
            return callback(undefined, event.target?.error);
        }

        try {
            const open_request = indexedDB.open(db_name, db_version);
            open_request.onupgradeneeded = function (event) {
                on_upgrade(open_request.result, event.oldVersion);
            };
            open_request.onsuccess = function () {
                const db = open_request.result;

// All IndexedDB requests must take place within a transaction. Create a
// transaction, and within it execute a request to the specified object store.
// Close the database when we're done.

                const transaction = db.transaction(
                    object_store_name,
                    "readwrite"
                );
                transaction.oncomplete = function () {
                    return db.close();
                };
                transaction.onerror = function (event) {
                    fail(event);
                    return db.close();
                };
                const request = make_store_request(
                    transaction.objectStore(object_store_name),
                    value
                );
                request.onsuccess = function () {
                    return callback(request.result ?? default_result);
                };
            };
            open_request.onblocked = fail;
            open_request.onerror = fail;
        } catch (exception) {
            return callback(undefined, exception);
        }
    };
}

function feijoa(...args) {
    return indexed_db(
        "fruit_basket",
        1,
        function on_upgrade(db, old_version) {
            if (old_version < 1) {
                db.createObjectStore("feijoa", {keyPath: "color"});
            }
        },
        "feijoa",
        ...args
    );
}

if (import.meta.main) {
    parseq.sequence([
        feijoa(function (store, object) {
            return store.put(object);
        }),
        feijoa(function (store) {
            return store.get("deep orange");
        })
    ])(
        globalThis.console.log,
        {color: "deep orange", ripeness: "very"}
    );
}

export default Object.freeze(indexed_db);
