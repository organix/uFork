// ui.js
// James Diacono
// 2024-02-16

// Custom Elements with a safer, more expressive interface.

// This module does not pass JSLint because it uses JavaScript's class syntax,
// so that you never have to.

// Public Domain.

let instances = new WeakMap();

function ui(tag, create) {

// It seems that the only way to efficiently monitor a DOM element's
// connectedness to a document, without knowledge of its parent, is thru
// connectedCallback and disconnectedCallback. If a better approach presents
// itself (perhaps https://github.com/whatwg/dom/issues/533), there will be no
// need to use Custom Elements and hence no need for this library.

    if (customElements.get(tag) === undefined) {
        customElements.define(tag, class extends HTMLElement {
            connectedCallback() {
                const connect = instances.get(this)?.connect;
                if (typeof connect === "function") {
                    connect();
                }
            }
            disconnectedCallback() {
                const disconnect = instances.get(this)?.disconnect;
                if (typeof disconnect === "function") {
                    disconnect();
                }
            }
        });
    }
    return Object.freeze(function make_element(params) {
        const element = document.createElement(tag);
        instances.set(element, create(element, params));
        return element;
    });
}

if (import.meta.main) {
    document.documentElement.innerHTML = "";
    const make_blink = ui("blink-ui", function create(element, params) {
        let {interval} = params;
        let timer;
        let shadow = element.attachShadow({mode: "closed"});
        shadow.append(document.createElement("slot"));
        function toggle_visibility() {
            element.style.visibility = (
                element.style.visibility === "hidden"
                ? "visible"
                : "hidden"
            );
        }
        return {
            connect() {
                timer = setInterval(toggle_visibility, interval);
            },
            disconnect() {
                clearInterval(timer);
            }
        };
    });
    const blink_element = make_blink({interval: 300});
    blink_element.textContent = "Look at me!";
    document.body.append(blink_element);
}

export default Object.freeze(ui);
