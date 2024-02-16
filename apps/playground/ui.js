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

//debug const make_blink = ui("blink-ui", function create(element, params) {
//debug     let {interval} = params;
//debug     let timer;
//debug     let shadow = element.attachShadow({mode: "closed"});
//debug     shadow.append(document.createElement("slot"));
//debug     function toggle_visibility() {
//debug         element.style.visibility = (
//debug             element.style.visibility === "hidden"
//debug             ? "visible"
//debug             : "hidden"
//debug         );
//debug     }
//debug     return {
//debug         connect() {
//debug             timer = setInterval(toggle_visibility, interval);
//debug         },
//debug         disconnect() {
//debug             clearInterval(timer);
//debug         }
//debug     };
//debug });
//debug const blink_element = make_blink({interval: 300});
//debug blink_element.textContent = "Look at me!";
//debug document.body.append(blink_element);

export default Object.freeze(ui);
