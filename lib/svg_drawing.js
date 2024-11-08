// SVG Drawing Device

// Translates a `fixnum` sequence into drawing commands
// for an SVG element on an HTML page.

// The API is described in `svg_drawing.md`.

const join = [ "butt", "round", "square" ];  // linecap and linejoin attributes

function svg_drawing(add_html) {
    // The `svg_drawing` function returns a call-back function
    // that processes a fixnum `code` from the command stream.

    // The `add_html` function is called (with a String argument)
    // to append HTML elements to an SVG drawing.

    let next = parse_start;  // parser state-machine (strategy pattern)
    let cmd, nargs, args, path, text, stroke;  // parser context

    function parse_start(code) {
        cmd = undefined;
        nargs = 0;
        path = "";
        text = undefined;
        stroke = "";
        //console.log("parse_start code:", code);
        const char = (code > 0 ? String.fromCodePoint(code) : undefined);
        if (char === "M") {
            cmd = char;
            nargs = 2;
            args = [];
            next = parse_path_args;
        } else if (char === "X") {
            cmd = char;
            nargs = 3;
            args = [];
            next = parse_text_args;
        }
    }

    function parse_path_args(code) {
        args.push(code);
        nargs -= 1;
        if (nargs <= 0) {
            path += cmd;
            path += args.join(",");
            path += ' ';
            next = parse_path;
        }
    }

    function parse_path(code) {
        //console.log("parse_path code:", code);
        const char = (code > 0 ? String.fromCodePoint(code) : undefined);
        if ((char === "Z") || (char === "z")) {
            cmd = char;
            path += cmd + ' ';
            next = parse_path;
        } else if ((char === "M") || (char === "m") || (char === "L") || (char === "l")) {
            cmd = char;
            nargs = 2;
            args = [];
            next = parse_path_args;
        } else if ((char === "H") || (char === "h") || (char === "V") || (char === "v")) {
            cmd = char;
            nargs = 1;
            args = [];
            next = parse_path_args;
        } else if ((char === "C") || (char === "c")) {
            cmd = char;
            nargs = 6;
            args = [];
            next = parse_path_args;
        } else if ((char === "S") || (char === "s")) {
            cmd = char;
            nargs = 4;
            args = [];
            next = parse_path_args;
        } else if ((char === "Q") || (char === "q")) {
            cmd = char;
            nargs = 4;
            args = [];
            next = parse_path_args;
        } else if ((char === "T") || (char === "t")) {
            cmd = char;
            nargs = 2;
            args = [];
            next = parse_path_args;
        } else if ((char === "A") || (char === "a")) {
            cmd = char;
            nargs = 7;
            args = [];
            next = parse_path_args;
        } else if (char === "D") {
            cmd = char;
            nargs = 7;
            args = [];
            next = parse_stroke_args;
        } else if (char === "d") {
            cmd = char;
            nargs = 7;
            args = [];
            next = parse_pending_args;
        } else if (char === "F") {
            cmd = char;
            nargs = 4;
            args = [];
            next = parse_stroke_args;
        } else if (char === "f") {
            cmd = char;
            nargs = 4;
            args = [];
            next = parse_pending_args;
        } else {
            next = parse_start;  // syntax error
        }
    }

    function parse_text_args(code) {
        args.push(code);
        nargs -= 1;
        if (nargs <= 0) {
            path += 'x="' + args[0] + '" ';
            path += 'y="' + args[1] + '" ';
            nargs = args[2];
            //console.log("parse_text_arg args:", args);
            text = "";
            next = parse_text_codes;
        }
    }

    function parse_text_codes(code) {
        //console.log("parse_text_codes code:", code);
        let char = (code > 0 ? String.fromCodePoint(code) : undefined);
        if (char === '&') {
            char = '&amp;';
        } else if (char === '<') {
            char = '&lt;';
        } else if (char === '>') {
            char = '&gt;';
        }
        if (typeof char === "string") {
            text += char;
        }
        nargs -= 1;
        if (nargs <= 0) {
            //console.log("parse_text_codes text:", text);
            next = parse_stroke;
        }
    }

    function parse_stroke(code) {
        //console.log("parse_stroke code:", code);
        const char = (code > 0 ? String.fromCodePoint(code) : undefined);
        if (char === "D") {
            cmd = char;
            nargs = 7;
            args = [];
            next = parse_stroke_args;
        } else if (char === "d") {
            cmd = char;
            nargs = 7;
            args = [];
            next = parse_pending_args;
        } else if (char === "F") {
            cmd = char;
            nargs = 4;
            args = [];
            next = parse_stroke_args;
        } else if (char === "f") {
            cmd = char;
            nargs = 4;
            args = [];
            next = parse_pending_args;
        } else {
            next = parse_start;  // syntax error
        }
    }

    function stroke_draw() {
        stroke += 'stroke="rgb(';
        stroke += args.slice(0, 3).join(',');
        stroke += ')" ';
        if (args[3] !== 255) {
            stroke += 'stroke-opacity="' + (args[3] / 255).toFixed(2) + '" ';
        }
        stroke += 'stroke-width="' + args[4] + '" ';
        stroke += 'stroke-linecap="' + join[args[5]] + '" ';
        stroke += 'stroke-linejoin="' + join[args[6]] + '" ';
    }

    function stroke_fill() {
        stroke += 'fill="rgb(';
        stroke += args.slice(0, 3).join(',');
        stroke += ')" ';
        if (args[3] !== 255) {
            stroke += 'fill-opacity="' + (args[3] / 255).toFixed(2) + '" ';
        }
    }

    function parse_pending_args(code) {
        args.push(code);
        nargs -= 1;
        if (nargs <= 0) {
            if (cmd === "d") {
                stroke_draw();
                next = parse_stroke;
            } else if (cmd === "f") {
                stroke_fill();
                next = parse_stroke;
            } else {
                next = parse_start;  // syntax error
            }
        }
    }

    function compose_html() {
        if (typeof text === "string") {
            return '<text ' + path + stroke + '>' + text + '</text>';
        } else {
            return '<path d="' + path + '" ' + stroke + '/>';
        }
    }

    function parse_stroke_args(code) {
        args.push(code);
        nargs -= 1;
        if (nargs <= 0) {
            if (cmd === "D") {
                stroke_draw();
                const html = compose_html();
                add_html(html);
                next = parse_start;
            } else if (cmd === "F") {
                stroke_fill();
                const html = compose_html();
                add_html(html);
                next = parse_start;
            } else {
                next = parse_start;  // syntax error
            }
        }
    }

    function on_fixnum(code) {
        //console.log("on_fixnum code:", code);
        next(code);
    }

    return on_fixnum;
}

function demo(log) {
    // { "0":0, "3":51, "6":102, "9":153, "C":204, "F":255 }
    // const seq = [
    //     'M'.codePointAt(0), 13, 8,
    //     'l'.codePointAt(0), 144, 42,
    //     'L'.codePointAt(0), 34, 89,
    //     'Z'.codePointAt(0),
    //     'f'.codePointAt(0), 153, 0, 204, 255,
    //     'D'.codePointAt(0), 102, 204, 51, 255, 3, 1, 1,
    // ];
    const seq = [
        'M'.codePointAt(0), 4, 20,
        'l'.codePointAt(0), 8, -14,
        'l'.codePointAt(0), 8, 14,
        'Z'.codePointAt(0),
        'm'.codePointAt(0), 28, 0,
        'a'.codePointAt(0), 7, 7, 0, 1, 0, 0, -14,
        'a'.codePointAt(0), 7, 7, 0, 1, 0, 0, 14,
        'D'.codePointAt(0), 255, 102, 102, 255, 1, 1, 1,
    //     'X'.codePointAt(0), 24, 20, 3, 'M'.codePointAt(0), '&'.codePointAt(0), 'A'.codePointAt(0),
    //     'F'.codePointAt(0), 255, 153, 0, 255,
    ];
    // const seq = [
    //     'M'.codePointAt(0), 3, 5,
    //     'h'.codePointAt(0), 8,
    //     'V'.codePointAt(0), 13,
    //     'H'.codePointAt(0), 3,
    //     'Z'.codePointAt(0),
    //     'F'.codePointAt(0), 255, 153, 0, 255,
    // ];
    let on_code = svg_drawing(log);
    seq.forEach(on_code);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(svg_drawing);
