// ed.js
// James Diacono
// 2024-06-01

// A minimal code editor for the Web, with support for syntax highlighting,
// copy/paste, and undo/redo. Tested on Chrome, Safari, and Firefox.

// Public Domain.

/*jslint browser */

function find(node, callback) {
    let result = callback(node);
    if (result === undefined) {
        Array.from(node.childNodes).every(function (child_node) {
            result = find(child_node, callback);
            return result === undefined;
        });
    }
    return result;
}

function next(node) {
    while (!node.nextSibling && node.parentNode) {
        node = node.parentNode;
    }
    return node.nextSibling;
}

function is_text(node) {
    return node.nodeType === Node.TEXT_NODE;
}

function get_selection_range(element) {

// If a valid Selection lies within 'element', its Range is returned, otherwise
// undefined is returned.

    try {

// When the element is within a ShadowRoot, browser compatibility breaks down.
// See https://stackoverflow.com/a/70523247.

        const selection = (
            typeof element.getRootNode().getSelection === "function"
            ? element.getRootNode().getSelection() // Chrome
            : document.getSelection() // Firefox
        );
        const is_shadow = element.getRootNode() !== document;
        const range = (
            (is_shadow && typeof selection.getComposedRanges === "function")
            ? selection.getComposedRanges(element.getRootNode())[0] // Safari
            : selection.getRangeAt(0)
        );
        if (
            element.contains(range.startContainer)
            && element.contains(range.endContainer)
        ) {
            return range;
        }
    } catch (_) {}
}

function get_position(element, caret) {
    let [caret_node, caret_offset] = caret;
    if (!is_text(caret_node)) {
        caret_node = caret_node.childNodes[caret_offset] ?? next(caret_node);
        caret_offset = 0;
    }
    let position = 0;
    find(element, function (node) {
        if (node === caret_node) {
            position += caret_offset;
            return true;
        }
        if (is_text(node)) {
            position += node.textContent.length;
        }
    });
    return position;
}

function get_caret(element, position) {
    return (

// Find the text node encompassing the position.

        find(element, function (node) {
            if (is_text(node)) {
                if (position >= 0 && position <= node.textContent.length) {
                    return [node, position];
                }
                position -= node.textContent.length;
            }
        })

// If there were no text nodes, or the position was out of range, place the
// caret at the start of the element.

        ?? [element, 0]
    );
}

// document.body.innerHTML = `
//     <b>
//         B
//         <c> C </c>
//         <d>
//             D
//             <e> E </e>
//         </d>
//     </b>
//     <f> F </f>
//     <g>
//         G
//         <h> H </h>
//     </g>
// `.replace(/\s/g, "");
// const b = document.body.querySelector("b");
// console.log(get_position(document.body, [b, b.childNodes.length])); // </d>I
// console.log(get_position(document.body, [document.body, 1])); // I<f>
// const caret = get_caret(document.body, 4);
// console.log(caret.node.nodeValue, caret.offset);

function is_apple() {
    return (
        navigator.platform.startsWith("Mac")
        || navigator.platform === "iPhone"
        || navigator.platform === "iPad"
        || navigator.platform === "iPod"
    );
}

function is_command(keyboard_event) {
    return (
        is_apple()
        ? keyboard_event.metaKey
        : keyboard_event.ctrlKey
    );
}

function normalize_line_endings(text) {
    return text.replace(/\r\n?/g, "\n");
}

function ed({
    element,
    highlight,
    on_keydown,
    on_input
}) {
    const trailing_br = document.createElement("br");
    let history = [];
    let history_at = -1;
    let text_at_last_change;

    function get_text() {
        return element.textContent;
    }

    function set_text(text) {
        element.textContent = text;
        if (highlight !== undefined) {
            highlight(element);
        }
        element.append(trailing_br);
    }

    function get_cursor() {
        const range = get_selection_range(element);
        if (range === undefined) {
            return;
        }
        return [
            get_position(element, [range.startContainer, range.startOffset]),
            get_position(element, [range.endContainer, range.endOffset])
        ];
    }

    function set_cursor(cursor) {
        if (cursor !== undefined) {
            const [startContainer, startOffset] = get_caret(element, cursor[0]);
            const [endContainer, endOffset] = get_caret(element, cursor[1]);
            document.getSelection().setBaseAndExtent(
                startContainer,
                startOffset,
                endContainer,
                endOffset
            );
        }
    }

    function insert_text(text) {
        const cursor = get_cursor();
        const start = Math.min(...cursor);
        const end = Math.max(...cursor);
        set_text(
            get_text().slice(0, start)
            + text
            + get_text().slice(end)
        );
        set_cursor([start + text.length, start + text.length]);
    }

    function maybe_text_changed() {
        if (on_input !== undefined) {
            const text = get_text();
            if (text !== text_at_last_change) {
                text_at_last_change = text;
                on_input(text);
            }
        }
    }

    function record_history() {
        const text = get_text();
        const cursor = get_cursor();
        let at_record = history[history_at];
        if (text === at_record?.text) {
            at_record.cursor = cursor;
        } else {
            const record = {text, cursor};
            history_at += 1;
            history.length = history_at; // truncate
            history.push(record);
        }
    }

    function travel_history(direction) {
        const record = history[history_at + direction];
        if (record !== undefined) {
            set_text(record.text);
            set_cursor(record.cursor);
            history_at += direction;
        }
    }

    function keydown(event) {
        record_history();
        if (is_command(event) && event.key.toLowerCase() === "z") {
            event.preventDefault();
            travel_history(
                event.shiftKey
                ? 1
                : -1
            );
        }
        if (on_keydown !== undefined) {
            on_keydown(event);
        }
        if (!event.defaultPrevented && event.key === "Enter") {

// Browsers insert a <br> on Enter, but we just want a newline character.

            event.preventDefault();
            insert_text("\n");
        }
        maybe_text_changed();
    }

    function input(event) {
        if (!event.isComposing) {
            maybe_text_changed();
            if (highlight !== undefined) {
                const cursor = get_cursor();
                trailing_br.remove();
                highlight(element);
                element.append(trailing_br);
                set_cursor(cursor);
            }

// A contenteditable element does not render its trailing newline, if it has
// one. This frustrates the user by rejecting their cursor from the last line.
// Our crude workaround is to maintain a trailing <br>, invisible to
// element.textContent.

            element.append(trailing_br);
        }
    }

    function paste(event) {

// Pasting almost works fine without intervention, except that leading newlines
// are lost.

        event.preventDefault();
        insert_text(normalize_line_endings(
            event.clipboardData.getData("text/plain")
        ));
        maybe_text_changed();
    }

    function selectionchange() {

// If the selection extends beyond the trailing <br>, pressing Backspace appears
// to do nothing because the <br> is added back immediately. Our workaround is
// to exclude the trailing <br> from the selection.

        const range = get_selection_range(element);
        if (range !== undefined) {
            const end = element.childNodes.length;
            if (
                (range.startContainer === element && range.startOffset === end)
                || (range.endContainer === element && range.endOffset === end)
            ) {
                set_cursor(get_cursor());
            }
        }
    }

    function destroy() {
        element.removeEventListener("keydown", keydown);
        element.removeEventListener("input", input);
        element.removeEventListener("paste", paste);
        element.removeEventListener("cut", record_history);
        document.removeEventListener("selectionchange", selectionchange);
    }

    element.addEventListener("keydown", keydown);
    element.addEventListener("input", input);
    element.addEventListener("paste", paste);
    element.addEventListener("cut", record_history);
    document.addEventListener("selectionchange", selectionchange);
    element.contentEditable = "true";
    element.spellcheck = false;
    text_at_last_change = get_text();
    if (highlight !== undefined) {
        highlight(element);
    }
    element.append(trailing_br);
    return {
        get_text,
        set_text,
        insert_text,
        get_cursor,
        set_cursor,
        record_history,
        travel_history,
        is_command,
        destroy
    };
}

//debug document.documentElement.innerHTML = "<body></body>\n"; // Firefox v122
//debug const source = document.createElement("div"); // Firefox v122
//debug source.style.flex = "1 1 50%";
//debug source.style.whiteSpace = "pre";
//debug source.style.caretColor = "black";
//debug source.style.fontFamily = "monospace";
//debug source.style.outline = "none";
//debug source.style.padding = "0 5px";
//debug //source.textContent = "abc\r\ndef\rstuff\nthings";
//debug source.textContent = "abc\ndef\nstuff\nthings";
//debug const preview = document.createElement("html_preview");
//debug preview.style.flex = "1 1 50%";
//debug preview.style.whiteSpace = "pre";
//debug preview.style.fontFamily = "monospace";
//debug document.documentElement.style.height = "100%";
//debug document.body.style.margin = "0px";
//debug document.body.style.height = "100%";
//debug document.body.style.display = "flex";
//debug console.log("Rendering in ShadowRoot");
//debug const shadow = document.body.attachShadow({mode: "closed"});
//debug shadow.append(source, preview);
//debug //console.log("Rendering in window.document");
//debug //document.body.append(source, preview);
//debug const caret_anchor = "▶";
//debug const caret_focus = "◀";
//debug function alter_string(string, alterations) {
//debug     alterations = alterations.slice().sort(
//debug         function compare(a, b) {
//debug             return a.range[0] - b.range[0] || a.range[1] - b.range[1];
//debug         }
//debug     );
//debug     let end = 0;
//debug     return alterations.map(
//debug         function ({range, replacement}) {
//debug             const chunk = string.slice(end, range[0]) + replacement;
//debug             end = range[1];
//debug             return chunk;
//debug         }
//debug     ).concat(
//debug         string.slice(end)
//debug     ).join(
//debug         ""
//debug     );
//debug }
//debug function visualize_selection_range(node, range) {
//debug     let string = "";
//debug     let indent = "";
//debug     function caret(node, caret, selection_node, selection_offset) {
//debug         return (
//debug             (
//debug                 node.parentNode === selection_node
//debug                 && Array.from(
//debug                     node.parentNode.childNodes
//debug                 ).indexOf(
//debug                     node
//debug                 ) === selection_offset
//debug             )
//debug             ? caret
//debug             : ""
//debug         );
//debug     }
//debug     function carets(node, offset_offset) {
//debug         return caret(
//debug             node,
//debug             caret_anchor,
//debug             range?.startContainer,
//debug             range?.startOffset + offset_offset
//debug         ) + caret(
//debug             node,
//debug             caret_focus,
//debug             range?.endContainer,
//debug             range?.endOffset + offset_offset
//debug         );
//debug     }
//debug     function append_text(node) {
//debug         let alterations = [];
//debug         if (range?.startContainer === node) {
//debug             alterations.push({
//debug                 range: [range.startOffset, range.startOffset],
//debug                 replacement: caret_anchor
//debug             });
//debug         }
//debug         if (range?.endContainer === node) {
//debug             alterations.push({
//debug                 range: [range.endOffset, range.endOffset],
//debug                 replacement: caret_focus
//debug             });
//debug         }
//debug         const text = alter_string(node.textContent, alterations);
//debug         const pre = carets(node, 0);
//debug         const post = (
//debug             node.nextSibling
//debug             ? ""
//debug             : carets(node, -1)
//debug         );
//debug         string += indent + pre + JSON.stringify(text) + post + "\n";
//debug     }
//debug     function append_element(node) {
//debug         const children = Array.from(node.childNodes);
//debug         const tag = node.tagName.toLowerCase();
//debug         const pre = carets(node, 0);
//debug         const post = (
//debug             node.nextSibling
//debug             ? ""
//debug             : carets(node, -1)
//debug         );
//debug         if (children.length === 0) {
//debug             string += indent + pre + "<" + tag + " />" + post + "\n";
//debug         } else {
//debug             string += indent + pre + "<" + tag + ">" + post + "\n";
//debug             indent += "    ";
//debug             children.forEach(append_node);
//debug             indent = indent.slice(4);
//debug             string += indent + "</" + tag + ">\n";
//debug         }
//debug     }
//debug     function append_node(node) {
//debug         return (
//debug             node.nodeType === Node.ELEMENT_NODE
//debug             ? append_element(node)
//debug             : append_text(node)
//debug         );
//debug     }
//debug     append_node(node);
//debug     return string;
//debug }
//debug function refresh_preview() {
//debug     preview.textContent = (
//debug         "HTML\n"
//debug         + visualize_selection_range(source, get_selection_range(source))
//debug         + "\nTEXT\n"
//debug         + JSON.stringify(source.textContent)
//debug     );
//debug }
//debug const colors = ["red", "purple", "orange", "green", "blue"];
//debug function highlight(element) {
//debug     let text = element.textContent;
//debug     element.innerHTML = "";
//debug     const rx_token = /(\w+)|(\s+)|(.)/g;
//debug     while (true) {
//debug         const matches = rx_token.exec(text);
//debug         if (!matches) {
//debug             break;
//debug         }
//debug         const word = matches[1];
//debug         const space = matches[2];
//debug         const other = matches[3];
//debug         if (word !== undefined || other !== undefined) {
//debug             const span = document.createElement("span");
//debug             span.style.color = colors[
//debug                 rx_token.lastIndex % colors.length
//debug             ];
//debug             span.textContent = word ?? other;
//debug             element.append(span);
//debug         } else if (space !== undefined) {
//debug             element.append(space);
//debug         }
//debug     }
//debug }
//debug const editor = ed({
//debug     element: source,
//debug     highlight,
//debug     on_keydown(event) {
//debug         if (event.key === "Tab") {
//debug             event.preventDefault();
//debug             editor.insert_text("    ");
//debug         }
//debug     },
//debug     on_input(text) {
//debug         console.log(JSON.stringify(text));
//debug     }
//debug });
//debug window.oninput = refresh_preview;
//debug document.onselectionchange = refresh_preview;
//debug refresh_preview();

export default Object.freeze(ed);
