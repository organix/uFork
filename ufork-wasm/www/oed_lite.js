// oed_lite.js
// Dale Schumacher
// 2023-03-06
// Public Domain
// `decompose_number` based on code by Douglas Crockford and James Diacono

const false_octet =     0b1000_0000;    // 128 = false
const true_octet =      0b1000_0001;    // 129 = true
const num_sign_bit =    0b0000_0001;    //   1 = Number sign (0=positive, 1=negative)
const integer_octet =   0b1000_0010;    // 130 = Number (positive Integer)
const decimal_octet =   0b1000_0100;    // 132 = Number (positive Decimal)
const rational_octet =  0b1000_0110;    // 134 = Number (positive Rational)
const array_octet =     0b1000_1000;    // 136 = Array
const object_octet =    0b1000_1001;    // 137 = Object
const blob_octet =      0b1000_1010;    // 138 = String (blob)
const extension_octet = 0b1000_1011;    // 139 = String (extension)
const string_octet =    0b1000_1100;    // 140 = String (utf8)
const string_memo =     0b1000_1101;    // 141 = String (utf8) + memoize
const memo_reference =  0b1000_1110;    // 142 = retrieve memoized
const null_octet =      0b1000_1111;    // 143 = null

const radix = 256;
const utf8encoder = new TextEncoder();
const utf8decoder = new TextDecoder();

function stringify(iterable) {
    if (iterable.length < 32768) {
        return String.fromCodePoint(...iterable);
    }
    return Array.from(iterable, function (code) {
        return String.fromCodePoint(code);
    }).join("");
}
function decompose_number(number) {
    let sign = 1;
    let integer = number;
    let exponent = 0;
    if (number < 0) {  // remove sign
        sign = -1;
        integer = -integer;
    }
    if (Number.isFinite(number) && (number !== 0)) {
        exponent = -1128;
        let reduction = integer;  // reduce integer to determine exponent
        while (reduction !== 0) {
            exponent += 1;
            reduction /= 2;
        }
        reduction = exponent;  // reduce exponent to determine integer
        while (reduction > 0) {
            integer /= 2;
            reduction -= 1;
        }
        while (reduction < 0) {
            integer *= 2;
            reduction += 1;
        }
        while (integer % 2 === 0) {  // push information into exponent
            integer /= 2;
            exponent += 1;
        }
    }
    if (sign < 0) {  // restore sign
        integer = -integer;
    }
    return { integer, exponent, base: 2 };
}
function compose_number({ integer, exponent = 0, base = 10 }) {
    return integer * (base ** exponent);
}

function encode_integer(integer) {
    //console.log("encode_integer", integer);
    let integer_type = integer_octet;
    if ((integer >= -112) && (integer <= 127)) {
        return new Uint8Array([integer & 0xFF]);  // small 2's-complement integer
    }
    if (integer < 0) {
        integer_type |= num_sign_bit;  // encode sign bit
        integer = -integer;  // encode _natural_ magnitude
    }
    if (integer <= 0xFF) return new Uint8Array([integer_type, 8, (integer & 0xFF)]);
    if (integer <= 0xFFFF) return new Uint8Array([integer_type, 16, (integer & 0xFF), ((integer >> 8) & 0xFF)]);
    if (integer <= 0xFFFFFF) return new Uint8Array([integer_type, 24, (integer & 0xFF), ((integer >> 8) & 0xFF), ((integer >> 16) & 0xFF)]);
    if (integer <= 0xFFFFFFFF) return new Uint8Array([integer_type, 32, (integer & 0xFF), ((integer >> 8) & 0xFF), ((integer >> 16) & 0xFF), ((integer >> 24) & 0xFF)]);
    const digits = [];
    while (integer > 0) {
        const digit = (integer % radix);
        digits.push(digit);
        integer = Math.floor(integer / radix);
    }
    digits.unshift(integer_type, digits.length * 8);
    return new Uint8Array(digits);
}
function encode_number(number) {
    //console.log("encode_number", number);
    let sign_bit = (number < 0) ? num_sign_bit : 0;
    let prefix = integer_octet | sign_bit;
    let base = [];
    let exponent = [];
    number = decompose_number(number);
    if (number.base !== 10) {
        prefix = rational_octet | sign_bit;
        base = encode_integer(number.base);
        exponent = encode_integer(number.exponent);
    } else if (number.exponent !== 0) {
        prefix = decimal_octet | sign_bit;
        exponent = encode_integer(number.exponent);
    }
    let integer = encode_integer(number.integer);
    if (integer.length > 1) {
        integer = integer.subarray(1);  // exclude integer prefix
    } else {
        integer = new Uint8Array([8, integer[0]]);  // small integer encoded as a 8-bit integer
    }
    const octets = new Uint8Array(1 + base.length + exponent.length + integer.length);
    octets.set([prefix], 0);
    octets.set(base, 1);
    octets.set(exponent, 1 + base.length);
    octets.set(integer, 1 + base.length + exponent.length);
    return octets;
}
function encode_string(string) {
    //console.log("encode_string", string);
    let count = 0;
    for (const codepoint of string) {
        count += 1;
    }
    if (count === 0) {
        return new Uint8Array([string_octet, 0]);  // empty string
    }
    const length = encode_integer(count);
    const data = utf8encoder.encode(string);
    const size = encode_integer(data.length);
    const octets = new Uint8Array(1 + length.length + size.length + data.length);
    octets.set([string_octet], 0);
    octets.set(length, 1);
    octets.set(size, 1 + length.length);
    octets.set(data, 1 + length.length + size.length);
    return octets;
}
function encode_blob(blob) {
    //console.log("encode_blob", blob);
    const size = encode_integer(blob.length);
    const octets = new Uint8Array(1 + size.length + blob.length);
    octets.set([blob_octet], 0);
    octets.set(size, 1);
    octets.set(blob, 1 + size.length);
    return octets;
}
function encode_array(array) {
    //console.log("encode_array", array);
    if (array.length === 0) {
        return new Uint8Array([array_octet, 0]);  // empty array
    }
    let size = 0;
    const elements = [];
    array.forEach((element) => {
        let octets = encode(element);
        if (octets === undefined) {
            octets = new Uint8Array([null_octet]);  // replace error with null element
        }
        size += octets.length;
        elements.push(octets);
    });
    //console.log("encode_array: elements =", elements);
    const length_octets = encode_integer(elements.length);
    const size_octets = encode_integer(size);
    const octets = new Uint8Array(1 + length_octets.length + size_octets.length + size);
    let offset = 0;
    octets.set([array_octet], offset);
    offset += 1;
    octets.set(length_octets, offset);
    offset += length_octets.length;
    octets.set(size_octets, offset);
    offset += size_octets.length;
    elements.forEach((element) => {
        octets.set(element, offset);
        offset += element.length;
    });
    return octets;
}
function encode_object(object) {
    //console.log("encode_object", object);
    const keys = Object.keys(object);
    if (keys.length === 0) {
        return new Uint8Array([object_octet, 0]);  // empty object
    }
    let size = 0;
    const members = [];
    keys.forEach((key) => {
        const value_octets = encode(object[key]);
        if (value_octets !== undefined) {  // skip non-encodeable values
            const key_octets = encode_string(key);
            size += key_octets.length;
            members.push(key_octets);
            size += value_octets.length;
            members.push(value_octets);
        }
    });
    //console.log("encode_object: members =", members);
    const length_octets = encode_integer(members.length / 2);
    const size_octets = encode_integer(size);
    const octets = new Uint8Array(1 + length_octets.length + size_octets.length + size);
    let offset = 0;
    octets.set([object_octet], offset);
    offset += 1;
    octets.set(length_octets, offset);
    offset += length_octets.length;
    octets.set(size_octets, offset);
    offset += size_octets.length;
    members.forEach((member) => {
        octets.set(member, offset);
        offset += member.length;
    });
    return octets;
}
function encode(value) {
    if (Number.isSafeInteger(value)) return encode_integer(value);
    if (typeof value === "string") return encode_string(value);
    if (Number.isFinite(value)) return encode_number(value);
    if (value === null) return new Uint8Array([null_octet]);
    if (value === false) return new Uint8Array([false_octet]);
    if (value === true) return new Uint8Array([true_octet]);
    if (Array.isArray(value)) return encode_array(value);
    if (value?.constructor === Uint8Array) return encode_blob(value);
    if (typeof value === "object") return encode_object(value);
    //return undefined;  // default: encode failed
}

function decode_integer(octets, offset) {
    //let number = decode({ octets, offset });
    let number = decode_number(octets, offset);
    if (number.error) return number;  // report error
    if (Number.isSafeInteger(number.value)) {
        return number;
    }
    return { error: "integer value required", octets, offset, value: number.value };
}
function decode_number(octets, offset) {
/*
`2#0xxx_xxxx` | -                                                          | positive small integer (0..127)
`2#1000_0010` | _size_::Number _nat_::Octet\*                              | Number (positive integer)
`2#1000_0011` | _size_::Number _nat_::Octet\*                              | Number (negative integer)
`2#1000_0100` | _exp_::Number _size_::Number _nat_::Octet\*                | Number (positive decimal)
`2#1000_0101` | _exp_::Number _size_::Number _nat_::Octet\*                | Number (negative decimal)
`2#1000_0110` | _base_::Number _exp_::Number _size_::Number _nat_::Octet\* | Number (positive rational)
`2#1000_0111` | _base_::Number _exp_::Number _size_::Number _nat_::Octet\* | Number (negative rational)
`2#1001_xxxx` | -                                                          | negative small integer (-112..-97)
`2#101x_xxxx` | -                                                          | negative small integer (-96..-65)
`2#11xx_xxxx` | -                                                          | negative small integer (-64..-1)
*/
    let prefix = octets[offset];
    if (typeof prefix !== "number") return { error: "offset out-of-bounds", octets, offset };
    offset += 1;
    if (prefix <= 0b0111_1111) return { value: prefix, octets, offset };
    if (prefix >= 0b1001_0000) return { value: (prefix - radix), octets, offset };
    const sign = (prefix & num_sign_bit) ? -1 : 1;
    prefix &= ~num_sign_bit;  // mask off sign bit
    let base = 10;
    let exponent = 0;
    if (prefix === rational_octet) {
        base = decode_integer(octets, offset);
        if (base.error) return base;  // report error
        offset = base.offset;
        base = base.value;
        exponent = decode_integer(octets, offset);
        if (exponent.error) return exponent;  // report error
        offset = exponent.offset;
        exponent = exponent.value;
    } else if (prefix === decimal_octet) {
        exponent = decode_integer(octets, offset);
        if (exponent.error) return exponent;  // report error
        offset = exponent.offset;
        exponent = exponent.value;
    } else if (prefix !== integer_octet) {
        return { error: "unrecognized OED number", octets, offset: offset - 1 };
    }
    const size = decode_integer(octets, offset);
    if (size.error) return size;  // report error
    let bits = size.value;
    offset = size.offset;
    let value = 0;
    let scale = 1;
    while (bits > 0) {
        value += scale * octets[offset];
        offset += 1;
        scale *= radix;
        bits -= 8;
    }
    if (offset != (size.offset + Math.ceil(size.value / 8))) {
        return { error: "offset does not match OED number size", octets, offset };
    }
    const integer = (sign < 0) ? -value : value;
    value = compose_number({ integer, base, exponent });
    return { value, octets, offset };
}
function decode_string(octets, offset) {
/*
`2#1000_1010` | _size_::Number _data_::Octet\*                             | String (Raw BLOB)
`2#1000_1011` | _meta_::Value _size_::Number _data_::Octet\*               | String (Extension BLOB)
`2#1000_1100` | _length_::Number _size_::Number _data_::Octet\*            | String (UTF-8)
`2#1000_1101` | _length_::Number _size_::Number _data_::Octet\*            | String (UTF-8 +memo)
`2#1000_1110` | _index_::Octet                                             | String (memo reference)
*/
    const prefix = octets[offset];
    if (typeof prefix !== "number") return { error: "offset out-of-bounds", octets, offset };
    if (prefix === string_octet) {
        // utf8-encoded String
        const length = decode_integer(octets, offset + 1);
        if (length.error) return length;  // report error
        if (length.value === 0) {
            return { value: "", octets, offset: length.offset };  // empty string
        }
        const size = decode_integer(octets, length.offset);
        if (size.error) return size;  // report error
        const data = octets.subarray(size.offset, (size.offset + size.value));
        const value = utf8decoder.decode(data);
        if (typeof value === "string") {
            return { value, octets, offset: (size.offset + size.value) };
        }
    } else if (prefix === blob_octet) {
        const blob = decode_blob(octets, offset);
        if (blob.error) return blob;  // report error
        const value = stringify(blob.value);
        return { value, octets, offset: blob.offset };
    } else if (prefix === extension_octet) {
        const meta = decode({ octets, offset: offset + 1 });
        if (meta.error) return meta;  // report error
        const size = decode_integer(octets, meta.offset);
        if (size.error) return size;  // report error
        const blob = octets.subarray(offset, size.offset + size.value);
        const value = stringify(blob);
        offset = size.offset + size.value;
        const data = octets.subarray(size.offset, offset);
        return { value, octets, offset, meta, data };
    }
    return { error: "unrecognized OED string", octets, offset };
}
function decode_blob(octets, offset) {
    const prefix = octets[offset];
    if (typeof prefix !== "number") return { error: "offset out-of-bounds", octets, offset };
    if (prefix === blob_octet) {
        // raw octet sequence
        const size = decode_integer(octets, offset + 1);
        if (size.error) return size;  // report error
        offset = size.offset + size.value;
        if (offset > octets.length) return { error: "offset out-of-bounds", octets, offset };
        const value = octets.subarray(size.offset, offset);
        return { value, octets, offset };
    }
    return { error: "unrecognized OED blob", octets, offset };
}
function decode_array(octets, offset) {
/*
`2#1000_1000` | _length_::Number _size_::Number _elements_::Value\*        | Array
*/
    const prefix = octets[offset];
    if (typeof prefix !== "number") return { error: "offset out-of-bounds", octets, offset };
    if (prefix === array_octet) {
        // Array
        const length = decode_integer(octets, offset + 1);
        if (length.error) return length;  // report error
        if (length.value === 0) {
            return { value: [], octets, offset: length.offset };  // empty array
        }
        const size = decode_integer(octets, length.offset);
        if (size.error) return size;  // report error
        const value = new Array(length.value);
        let index = 0;
        offset = size.offset;
        while (index < length.value) {
            const element = decode({ octets, offset });
            if (element.error) return element;  // report error
            value[index] = element.value;
            offset = element.offset;
            index += 1;
        }
        if (offset != (size.offset + size.value)) {
            return { error: "offset does not match OED array size", octets, offset };
        }
        return { value, octets, offset };
    }
    return { error: "unrecognized OED array", octets, offset };
}
function decode_object(octets, offset) {
/*
`2#1000_1001` | _length_::Number _size_::Number _members_::Octet\*         | Object
*/
    const prefix = octets[offset];
    if (typeof prefix !== "number") return { error: "offset out-of-bounds", octets, offset };
    if (prefix === object_octet) {
        // Object
        const length = decode_integer(octets, offset + 1);
        if (length.error) return length;  // report error
        if (length.value === 0) {
            return { value: {}, octets, offset: length.offset };  // empty object
        }
        const size = decode_integer(octets, length.offset);
        if (size.error) return size;  // report error
        const value = {};
        let index = 0;
        offset = size.offset;
        while (index < length.value) {
            const key = decode_string(octets, offset);
            if (key.error) return key;  // report error
            offset = key.offset;
            const member = decode({ octets, offset });
            if (member.error) return member;  // report error
            value[key.value] = member.value;
            offset = member.offset;
            index += 1;
        }
        if (offset != (size.offset + size.value)) {
            return { error: "offset does not match OED object size", octets, offset };
        }
        return { value, octets, offset };
    }
    return { error: "unrecognized OED object", octets, offset };
}
/*
const decoder = (function () {
    function literal(value) {
        return (octets, offset) => ({ value, octets, offset: offset + 1 });
    }
    let handler = [];
    let prefix = 0;
    while (prefix < false_octet) {
        handler[prefix] = literal(prefix);  // small positive integer
        prefix += 1;
    }
    handler[false_octet] = literal(false);
    handler[true_octet] = literal(true);
    handler[integer_octet] = decode_number;
    handler[integer_octet | num_sign_bit] = decode_number;
    handler[decimal_octet] = decode_number;
    handler[decimal_octet | num_sign_bit] = decode_number;
    handler[rational_octet] = decode_number;
    handler[rational_octet | num_sign_bit] = decode_number;
    handler[array_octet] = decode_array;
    handler[object_octet] = decode_object;
    handler[blob_octet] = decode_blob;
    handler[extension_octet] = decode_string;
    handler[string_octet] = decode_string;
    handler[null_octet] = literal(null);
    prefix = radix - 1;
    while (prefix > null_octet) {
        handler[prefix] = literal(prefix - radix);  // small negative integer
        prefix -= 1;
    }
    return handler;
})();
function decode(source) {
    let { octets = source, offset = 0 } = source;  // destructure parameters
    const prefix = octets[offset];
    if (typeof prefix !== "number") return { error: "offset out-of-bounds", octets, offset };
    let handler = decoder[prefix];
    if (typeof handler === "function") {
        return handler(octets, offset);
    }
    return { error: "unrecognized OED value", octets, offset };
}
*/
function decode(source) {
    let { octets = source, offset = 0 } = source;  // destructure parameters
    const prefix = octets[offset];
    if (typeof prefix !== "number") return { error: "offset out-of-bounds", octets, offset };
    switch (prefix) {
        case false_octet:
            return { value: false, octets, offset: offset + 1 };
        case true_octet:
            return { value: true, octets, offset: offset + 1 };
        case array_octet:
            return decode_array(octets, offset);
        case object_octet:
            return decode_object(octets, offset);
        case blob_octet:
            return decode_blob(octets, offset);
        case extension_octet:
        case string_octet:
            return decode_string(octets, offset);
        case string_memo:
        case memo_reference:
            return { error: "memoization not supported", octets, offset };
        case null_octet:
            return { value: null, octets, offset: offset + 1 };
        default:
            return decode_number(octets, offset);
    }
}

export default Object.freeze({encode, decode});
