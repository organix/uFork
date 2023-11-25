// oed.js
// James Diacono
// 2023-06-22
// Public Domain

// A JavaScript encoder and decoder for the Octet-Encoded Data (OED) format.

// OED is a binary encoding of JSON-like data structures. OED trades JSON's
// textuality and interoperability for flexibility and precision. Unlike JSON,
// OED features support for binary data, application-defined types and lossless
// encoding of numbers. The OED specification is at
// https://github.com/organix/mycelia/blob/master/OED.md.

// This module exports an object containing two functions: 'encode' and
// 'decode'. Their interface is similar to the JSON.stringify and JSON.parse
// functions.

//  OED.encode(value, pack)

//      Encodes the 'value' as a Uint8Array. Without the aid of a pack
//      function, only the following types are supported:

//          null, Boolean, Number, String, Array, Object, Uint8Array

//      Some JavaScript values, such as 'undefined', are not directly supported
//      by OED. When unsupported values are encountered by the encoder, and a
//      pack function is not provided, then the value is omitted (when it is a
//      property value) or encoded as null (when it is an array element). If
//      'value' itself is unsupported, OED.encode returns undefined.

//      The 'pack' function, if provided, is called with each value encountered
//      during encoding. Each of these values is a subvalue of 'value'.

//          pack(subvalue, path)

//      The return value of the pack function controls whether 'subvalue' is
//          - encoded normally,
//          - encoded as an Extension BLOB,
//          - encoded as an arbitrary-precision number,
//          - encoded as an object with non-string keys,
//          - transformed prior to encoding, or
//          - omitted.

//      The 'path' parameter is an array that locates the subvalue within
//      'value'. When the subvalue is 'value', the path is an empty array.
//      Otherwise the path is an array of keys, the last of which pertains to
//      the current subvalue. The pack function should never modify this
//      array.

//      A subvalue's key depends on its context:

//      Key       | Subvalue's context
//      ----------|-------------------------------------------------------------
//      false     | Meta-data of an Extension BLOB.
//      number    | Element of an array.
//      true      | Key of an object.
//      string    | Value of an object, keyed by a string.
//      function  | Value of an object, keyed by a non-string.

//      In the last case, a function wraps the non-string key value. OED objects
//      can have keys of any type, so this is just to avoid ambiguity.

//      The pack function returns an object:

//          {sign, natural, size}
//              Encode an integer as a fixed-length bit field, in signed
//              magnitude form.

//              The "sign" is either 1 or -1.

//              The "natural" is a Uint8Array describing the magnitude,
//              least-significant octet first. The most-significant octet may
//              be padded with 0.

//              The "size" is the number of bits in the bit field. The "natural"
//              is padded or truncated to fit the size if necessary.

//          {sign, natural}
//              Encode an integer as a variable-length bit field. The number of
//              significant bits in "natural" determine the size.

//          {coefficient, exponent, base}
//              Encode a rational number, equivalent to

//                  coefficient * (base ** exponent)

//              Each of "coefficient", "exponent" and "base" is either a number
//              satisfying Number.isSafeInteger, or an object like
//              {sign, natural} or {sign, natural, size}.

//          {coefficient, exponent}
//              Encode a decimal number, equivalent to

//                  coefficient * (10 ** exponent)

//          {meta, data}
//              Encode an Extension BLOB.

//              The "meta" is the BLOB's meta-data. It may be any value.

//              The optional "data" is the BLOB's data as a Uint8Array.

//          {entries}
//              Encode an object. The "entries" is an array of [key, value]
//              elements. Keys may be any value.

//          {value}
//              Encode a value normally.

//              The "value" is the value to encode. If "value" is unsupported,
//              the value is omitted.

//          {}
//              Omit the value.

//      For example, suppose we have a special kind of value called a
//      "capability" representing the authority to send an actor a message.
//      Within an application it appears as an opaque value, but globally it is
//      represented as a 521-bit public key. Transmitting it as an Extension
//      BLOB indicates that it should not be treated like a regular value. This
//      is how capabilities might be encoded:

//          let capability_registry = new WeakMap();
//          let octets = OED.encode(
//              my_capability,
//              function pack(value) {
//                  if (capability_registry.has(value)) {
//                      return {
//                          meta: "capability",
//                          data: capability_registry.get(value)
//                      };
//                  }
//                  return {value};
//              }
//          );

//  OED.decode(octets, unpack, seek)

//      Decodes the 'octets' Uint8Array, returning the value.

//      The 'unpack' function, if provided, controls how values are decoded. It
//      is called with each subvalue that is encountered. It returns the decoded
//      value, which can be anything.

//          unpack(object, canonical, path)

//      The 'object' parameter is one of:

//          {sign, natural, size}
//              The value is an integer or a bit field. See 'pack', above, for
//              details.

//          {coefficient, exponent, base}
//              The value is a rational number.

//              Each of "coefficient", "exponent" and "base" is either a number
//              satisfying Number.isSafeInteger or an object like
//              {sign, natural, size}.

//          {coefficient, exponent}
//              The value is a decimal number.

//          {meta, data}
//              The value is an Extension BLOB.

//              The "meta" property is the BLOB's meta-data value.

//              The "data" property is the BLOB's data as a Uint8Array.

//          {entries}
//              The value is an object.

//              The "entries" property is an array of [key, value] elements.
//              The keys are not necessarily strings.

//          {value}
//              The value is a Boolean, Number, String, Array, Uint8Array, or
//              null.

//      The 'canonical' function returns the default decoding of the value. It
//      takes no arguments. If 'unpack' can not make sense of the 'object', it
//      can always just

//          return canonical();

//      The 'path' parameter is the same as for the 'pack' function.

//      The capability from the previous example can be recovered like so:

//          let capability = OED.decode(
//              octets,
//              function unpack(object, canonical) {
//                  if (object.meta === "capability") {
//                      const opaque = Object.freeze({});
//                      capability_registry.set(opaque, object.data);
//                      return opaque;
//                  }
//                  return canonical();
//              }
//          );

//      Usually, 'octets' is assumed to contain exactly one OED value, aligned
//      to the bounds of the Uint8Array. Surplus octets result in an exception.
//      This requirement can be relaxed by passing an integer position as
//      the 'seek' parameter. Rather than decoding from the start of 'octets',
//      decoding begins at the given position and continues until a single
//      value has been read, ignoring any remaining octets.

// If the 'pack' or 'unpack' parameter is provided but is not a function, it is
// ignored.

/*jslint browser, null, bitwise */

// A series of octets can be thought of as a numeral, each octet being a single
// digit. The radix is then the number of possible octet permutations.

const radix = 256;

// These contants either represent single-octet values, or are used as prefixes
// in compound values.

const zero_octet = 0;                   // 0000_0000    0
                                        // ...          ...
const highest_positive_octet = 127;     // 0111_1111    127
const false_octet = 128;                // 1000_0000    false
const true_octet = 129;                 // 1000_0001    true
const positive_integer_octet = 130;     // 1000_0010    (prefix)
const negative_integer_octet = 131;     // 1000_0011    (prefix)
const positive_decimal_octet = 132;     // 1000_0100    (prefix)
const negative_decimal_octet = 133;     // 1000_0101    (prefix)
const positive_rational_octet = 134;    // 1000_0110    (prefix)
const negative_rational_octet = 135;    // 1000_0111    (prefix)
const array_octet = 136;                // 1000_1000    (prefix)
const object_octet = 137;               // 1000_1001    (prefix)
const raw_blob_octet = 138;             // 1000_1010    (prefix)
const extension_blob_octet = 139;       // 1000_1011    (prefix)
const string_octet = 140;               // 1000_1100    (prefix)
const string_memo_octet = 141;          // 1000_1101    (prefix)
const memo_reference_octet = 142;       // 1000_1110    (prefix)
const null_octet = 143;                 // 1000_1111    null
const lowest_negative_octet = 144;      // 1001_0000    -112
                                        // ...          ...
                                        // 1111_1111    -1

function buffer(values = []) {

// This function constructs a Uint8Array from a mixed array of octets, arrays of
// octets and Uint8Arrays. For example,

//      buffer([
//          0,
//          1,
//          [2, 3],
//          new UintArray([4, 5])
//      ])

// returns

//      new Uint8Array([0, 1, 2, 3, 4, 5])

    let size = values.reduce(function (size, value) {
        return size + (
            typeof value === "number"
            ? 1
            : value.length
        );
    }, 0);
    let array = new Uint8Array(size);
    let position = 0;
    values.forEach(function (value) {
        if (typeof value === "number") {
            array[position] = value;
            position += 1;
        } else {
            array.set(value, position);
            position += value.length;
        }
    });
    return array;
}

function deconstruct(number) {

// This function comes from page 2.6 of Douglas Crockford's book "How JavaScript
// Works". It deconstructs a number, reducing it to its components: a sign, an
// integer coefficient, a base, and an exponent, such that

//      number = sign * coefficient * (base ** exponent)

    let sign = 1;
    let coefficient = number;
    let exponent = 0;

// Remove the sign from the coefficient.

    if (coefficient < 0) {
        coefficient = -coefficient;
        sign = -1;
    }
    if (Number.isFinite(number) && number !== 0) {

// Reduce the coefficient: We can obtain the exponent by dividing the number by
// two until it goes to zero. We add the number of divisions to -1128, which is
// the exponent of 'Number.MIN_VALUE' minus the number of bits in the
// significand minus the bonus bit.

        exponent = -1128;
        let reduction = coefficient;
        while (reduction !== 0) {

// This loop is guaranteed to reach zero. Each division will decrement the
// exponent of the reduction. When the exponent is so small that it can not
// be decremented, then the internal subnormal significand will be shifted
// right instead. Ultimately, all of the bits will be shifted out.

            exponent += 1;
            reduction = reduction / 2;
        }

// Reduce the exponent: When the exponent is zero, the number can be viewed
// as an integer. If the exponent is not zero, then adjust to correct the
// coefficient.

        reduction = exponent;
        while (reduction > 0) {
            coefficient = coefficient / 2;
            reduction -= 1;
        }
        while (reduction < 0) {
            coefficient *= 2;
            reduction += 1;
        }

// The number's coefficient may lie outside the safe integer range. This can
// cause it to behave badly when used in calculations, so we shift as much
// information as we can into the exponent. This step is not present in Douglas
// Crockford's original implementation.

        while (coefficient % 2 === 0) {
            coefficient = coefficient / 2;
            exponent += 1;
        }
    }

// Return an object containing the four components and the original number.

    return {
        sign,
        coefficient,
        base: 2,
        exponent,
        number
    };
}

function construct({sign, coefficient, base, exponent}) {

// This function is the inverse of the 'deconstruct' function. It constructs a
// number from its components.

    return sign * coefficient * (base ** exponent);
}

function pathify(key) {
    return (
        typeof key === "string"
        ? key
        : function unwrap_key() {
            return key;
        }
    );
}

// Encoding ////////////////////////////////////////////////////////////////////

function significant(integer) {

// Counts the significant bits in a non-negative integer. The 'integer'
// parameter may be a number or a Uint8Array.

    if (Number.isSafeInteger(integer)) {
        return Math.ceil(Math.log2(integer + 1));
    }

// We look a each octet, beginning with the most-significant. If it is zero,
// then it is padding. If it is not zero, it is the most-significant octet.
// Every bit that follows is significant.

    return integer.reduceRight(function (size, octet) {
        return (
            size === 0
            ? (
                octet === zero_octet
                ? 0                     // a padding octet
                : significant(octet)    // the most-significant octet
            )
            : size + 8                  // another significant octet
        );
    }, 0);
}

function encode_integer_fields(integer) {

// Encodes an integer's "size" and "natural" fields. These two fields terminate
// the integer, decimal and rational representations.

    let sign = 1;

// Make the integer positive, if it is not already.

    if (integer < 0) {
        sign = -1;
        integer = -integer;
    }

// Beginning with the least-significant octet, we extract the integer's bits one
// octet at a time until it is reduced to zero. Only the significant bits count
// toward the size.

    let size = significant(integer);
    let digits = [];
    while (integer > 0) {
        const digit = integer % radix;
        integer = Math.floor(integer / radix);
        digits.push(digit);
    }
    return {
        sign,
        natural: buffer(digits),
        size
    };
}

function encode_integer(integer) {
    if (integer >= -112 && integer <= 127) {

// The integer is small enough to be encoded in a single octet. Integers are
// encoded as themselves, though negative integers are first truncated.

        return buffer([integer]);
    }
    const {natural, size} = encode_integer_fields(integer);
    return buffer([
        (
            integer < 0
            ? negative_integer_octet
            : positive_integer_octet
        ),
        encode_integer(size),
        natural
    ]);
}

function encode_rational(number) {
    const {sign, coefficient, base, exponent} = deconstruct(number);
    const {natural, size} = encode_integer_fields(sign * coefficient);
    return buffer([
        (
            number < 0
            ? negative_rational_octet
            : positive_rational_octet
        ),
        encode_integer(base),
        encode_integer(exponent),
        encode_integer(size),
        natural
    ]);
}

function encode_string(string) {

// Array.from splits a string into code points.

    const length = Array.from(string).length;
    if (length === 0) {
        return buffer([string_octet, zero_octet]);
    }
    const octets = new TextEncoder().encode(string);
    return buffer([
        string_octet,
        encode_integer(length),
        encode_integer(octets.length),
        octets
    ]);
}

function encode_raw_blob(data) {
    return buffer([
        raw_blob_octet,
        encode_integer(data.length),
        data
    ]);
}

function pack_integer({sign, natural, size}) {
    if (sign !== 1 && sign !== -1) {
        throw new Error("Bad sign.");
    }
    if (size !== undefined) {
        if (!Number.isSafeInteger(size)) {
            throw new Error("Bad size.");
        }

// Ensure that the number of octets matches the size. This may involve padding
// or truncating the natural.

        const nr_octets = Math.ceil(size / 8);
        if (natural.length < nr_octets) {
            natural = buffer([
                natural,
                new Uint8Array(nr_octets - natural.length).fill(0b00000000)
            ]);
        } else {
            if (natural.length > nr_octets) {
                natural = natural.subarray(0, nr_octets);
            }

// If the size is not a whole number of octets, truncate the last octet by
// replacing its unused bits with padding.

            if (size % 8 > 0) {
                natural[natural.length - 1] &= (1 << (size % 8)) - 1;
            }
        }
    } else {
        size = significant(natural);

// Truncate if necessary.

        natural = natural.subarray(0, Math.ceil(size / 8));
    }
    return buffer([
        (
            sign < 0
            ? negative_integer_octet
            : positive_integer_octet
        ),
        encode_integer(size),
        natural
    ]);
}

function pack_float({coefficient, exponent, base}) {
    let {sign, natural, size} = (
        Number.isSafeInteger(coefficient)
        ? encode_integer_fields(coefficient)
        : coefficient
    );
    if (size === undefined) {
        size = significant(natural);
    }
    exponent = (
        Number.isSafeInteger(exponent)
        ? encode_integer(exponent)
        : pack_integer(exponent)
    );
    if (base !== undefined) {
        base = (
            Number.isSafeInteger(base)
            ? encode_integer(base)
            : pack_integer(base)
        );
    }

// If a base is specified, encode a rational. Otherwise encode a decimal. Both
// types subsume the size and natural fields of their coefficient.

    return (
        base !== undefined
        ? buffer([
            (
                sign < 0
                ? negative_rational_octet
                : positive_rational_octet
            ),
            base,
            exponent,
            encode_integer(size),
            natural
        ])
        : buffer([
            (
                sign < 0
                ? negative_decimal_octet
                : positive_decimal_octet
            ),
            exponent,
            encode_integer(size),
            natural
        ])
    );
}

function encode(value, pack) {
    let path = [];

    function encode_extension_blob(meta, data = buffer()) {
        path.push(false);
        const encoded = encode_value(meta) ?? null_octet;
        path.pop();
        return buffer([
            extension_blob_octet,
            encoded,
            encode_integer(data.length),
            data
        ]);
    }

    function encode_array(array) {
        if (array.length === 0) {
            return buffer([array_octet, zero_octet]);
        }

// Encode the elements. Unsupported elements become null.

        let size = 0;
        let elements = array.map(function (element, key) {
            path.push(key);
            const octets = encode_value(element) ?? buffer([null_octet]);
            path.pop();
            size += octets.length;
            return octets;
        });
        return buffer([
            array_octet,
            encode_integer(array.length),
            encode_integer(size),
            ...elements
        ]);
    }

    function encode_object(entries) {

// Encode an object from an array of properties.

        let size = 0;
        let keys_and_values = [];
        entries.forEach(function ([key, value]) {
            path.push(true);
            const key_octets = encode_value(key);
            path.pop();
            path.push(pathify(key));
            const value_octets = encode_value(value);
            path.pop();

// The property is omitted if its key or value is unsupported.

            if (value_octets !== undefined && key_octets !== undefined) {
                keys_and_values.push(key_octets, value_octets);
                size += key_octets.length + value_octets.length;
            }
        });
        return (
            keys_and_values.length === 0
            ? buffer([object_octet, zero_octet])
            : buffer([
                object_octet,
                encode_integer(keys_and_values.length / 2),
                encode_integer(size),
                ...keys_and_values
            ])
        );
    }

    function encode_value(value) {
        if (typeof pack === "function") {

// A 'pack' function has been provided. See what it makes of the value.

            const object = pack(value, path);
            if (object.sign !== undefined) {
                return pack_integer(object);
            }
            if (object.coefficient !== undefined) {
                return pack_float(object);
            }
            if (object.entries !== undefined) {
                return encode_object(object.entries);
            }
            if (object.meta !== undefined) {
                return encode_extension_blob(object.meta, object.data);
            }
            value = object.value;
        }

// Choose an appropriate encoding based on the value's type.

        if (value === null) {
            return buffer([null_octet]);
        }
        if (value === false) {
            return buffer([false_octet]);
        }
        if (value === true) {
            return buffer([true_octet]);
        }
        if (Number.isSafeInteger(value)) {
            return encode_integer(value);
        }
        if (Number.isFinite(value)) {
            return encode_rational(value);
        }
        if (typeof value === "string") {
            return encode_string(value);
        }
        if (value?.constructor === Uint8Array) {
            return encode_raw_blob(value);
        }
        if (Array.isArray(value)) {
            return encode_array(value);
        }
        if (typeof value === "object") {
            return encode_object(Object.entries(value));
        }
    }

    return encode_value(value);
}

// Decoding ////////////////////////////////////////////////////////////////////

function get_sign(number_prefix) {
    return (
        number_prefix & 0b00000001
        ? -1
        : 1
    );
}

function stringify(octets) {

// The 'stringify' function maps a Uint8Array to a string. Each octet
// corresponds to a single Unicode code point. The string can later be included
// in JSON, allowing us to represent binary data with reasonable efficiency.

    return Array.from(octets, function (octet) {
        return String.fromCodePoint(octet);
    }).join("");
}

function decode_integer_fields({sign, natural}) {

// This function is the inverse of 'encode_integer_fields'.

    let integer = 0;
    let multiplier = 1;
    natural.forEach(function (octet) {
        integer += multiplier * octet;
        multiplier *= radix;
    });
    if (sign < 0) {
        integer = -integer;
    }
    return integer;
}

function decode(octets, unpack, seek) {

// Unlike encoding, decoding is stateful. State is necessary to provide
// meaningful error messages for bad input. As we decode, the 'octets' array is
// consumed until it is empty. The 'position' variable indicates how many octets
// have been consumed, and the 'path' array describes where we are in the
// decoded value.

    let position = 0;
    let path = [];

    function mark() {

// It is sometimes necessary to retain some consumed octets for later use. The
// 'mark' function makes a note of the current position. It returns a function
// that returns all octets consumed since then.

        const where = position;
        return function recover() {
            return new Uint8Array(octets.buffer, where, position - where);
        };
    }

    function fail(at, message, a, b) {
        throw new Error(
            message.replace("{a}", a).replace("{b}", b)
            + " in OED at position "
            + at
            + (
                path.length > 0
                ? " within " + path.join(".")
                : ""
            )
        );
    }

    function unpack_any(object, canonical) {
        return (
            typeof unpack === "function"
            ? unpack(object, canonical, path)
            : canonical()
        );
    }

    function unpack_value(value) {
        return unpack_any({value}, function canonical() {
            return value;
        });
    }

    function consume(n) {

// Consumes 'n' octets, returning them as a Uint8Array.

        if (octets.length < n) {
            return fail(position + octets.length, "Unexpected end of input");
        }
        position += n;
        const consumed = octets.subarray(0, n);
        octets = octets.subarray(n);
        return consumed;
    }

    function consume_magnitude(name) {

// Consumes a named magnitude field (such as "size" or "length") returning it as
// a number. The number is guaranteed to be non-negative and in the safe integer
// range.

        let integer_position = position;
        let integer = consume_integer(name);
        if (typeof integer === "object") {
            integer = decode_integer_fields(integer);
        }
        if (!Number.isSafeInteger(integer) || integer < 0) {
            return fail(integer_position, "Invalid {a} {b}", name, integer);
        }
        return integer;
    }

    function consume_integer(name) {

// Consumes an integer value, returning it either as a number or an object like
// {sign, natural, size}. A 'name' should be provided if the integer is
// associated with a field. Integers associated with a field are not unpacked,
// as they are only used internally.

// prefix::Octet ...

        const prefix_position = position;
        const prefix = consume(1)[0];
        if (prefix <= highest_positive_octet) {
            return (
                name === undefined
                ? unpack_value(prefix)
                : prefix
            );
        }
        if (prefix >= lowest_negative_octet) {
            return (
                name === undefined
                ? unpack_value(prefix - radix)
                : prefix - radix
            );
        }
        if (
            prefix === positive_integer_octet
            || prefix === negative_integer_octet
        ) {

// size::Number natural::Octet*

            const sign = get_sign(prefix);
            const size = consume_magnitude("size");
            const natural = consume(Math.ceil(size / 8));
            const object = {sign, natural, size};
            return (
                name === undefined
                ? unpack_any(object, function canonical() {
                    return decode_integer_fields(object);
                })
                : object
            );
        }
        return fail(prefix_position, "Expected an integer {a}", name);
    }

    function consume_decimal() {

// prefix::Octet exp::Number size::Number natural::Octet*

        const prefix = consume(1)[0];
        const sign = get_sign(prefix);
        const exponent = consume_integer("exponent");
        const size = consume_magnitude("size");
        const natural = consume(Math.ceil(size / 8));
        const coefficient = {sign, natural, size};
        return unpack_any({coefficient, exponent}, function canonical() {
            return construct({
                sign,
                coefficient: Math.abs(decode_integer_fields(coefficient)),
                base: 10,
                exponent: (
                    typeof exponent === "object"
                    ? decode_integer_fields(exponent)
                    : exponent
                )
            });
        });
    }

    function consume_rational() {

// prefix::Octet base::Number exp::Number size::Number natural::Octet*

        const prefix = consume(1)[0];
        const sign = get_sign(prefix);
        const base = consume_integer("base");
        const exponent = consume_integer("exponent");
        const size = consume_magnitude("size");
        const natural = consume(Math.ceil(size / 8));
        const coefficient = {sign, natural, size};
        return unpack_any({coefficient, exponent, base}, function canonical() {
            return construct({
                sign,
                coefficient: Math.abs(decode_integer_fields(coefficient)),
                base: (
                    typeof base === "object"
                    ? decode_integer_fields(base)
                    : base
                ),
                exponent: (
                    typeof exponent === "object"
                    ? decode_integer_fields(exponent)
                    : exponent
                )
            });
        });
    }

    function consume_string() {

// prefix::Octet length::Number size::Number data::Octet*

        consume(1);
        const length_position = position;
        const length = consume_magnitude("length");
        if (length === 0) {
            return "";
        }
        const size = consume_magnitude("size");
        const data = consume(size);

// Interpret the string data as UTF-8. Fail if the data is malformed or if the
// length field is incorrect.

        const string = new TextDecoder(undefined, {fatal: true}).decode(data);
        if (Array.from(string).length !== length) {
            return fail(length_position, "String length mismatch");
        }
        return unpack_value(string);
    }

    function consume_raw_blob() {

// prefix::Octet size::Number data::Octet*

        consume(1);
        const size = consume_magnitude("size");
        const data = consume(size);
        return unpack_value(data);
    }

    function consume_extension_blob() {

// prefix::Octet meta::Value size::Number data::Octet*

        consume(1);
        path.push(false);
        const meta = consume_value();
        path.pop();
        const size = consume_magnitude("size");
        const data = consume(size);
        return unpack_any({meta, data}, function canonical() {

// If an Extension BLOB is not understood, how should it be presented to the
// application? There are several options:

//  string (of prefix + meta + data)
//      The canonical JSON representation of an Extension BLOB is a
//      stringification of its binary representation.

//      A string provides the clearest indication of decoding failure during
//      debugging, and is unlikely to confuse the application. However, it
//      imposes a performance cost (in stringification and memory footprint) on
//      applications that legitimately have no use for the value, and will
//      almost certainly ignore it anyway.

//  Uint8Array (of prefix + meta + data)
//      Like the previous approach, but without the the cost of stringification,
//      or the clarity of debugging.

//  Uint8Array (of data)
//      Has the advantage that a schema may "upgrade" a Raw BLOB to an Extension
//      BLOB without breaking existing applications. For example, a value that
//      is initially a Raw BLOB of JPEG might, in future versions of the
//      application, be enriched to hold the ID of the user that uploaded the
//      photo.

//  undefined
//      If the Extension BLOB appears as a property value, the property is
//      omitted. If it appears in an array, it becomes null. If it appears as
//      a property name, it is stringified.

//      This approach assumes that applications that do not understand the
//      format of the Extension BLOB will not try to make use of it. It does not
//      impose a stringification cost, take up any of the application's memory,
//      or permit half-decoded Extension BLOBs to be propagated and
//      misunderstood down the line.

//      Consider a scenario consisting of two communicating applications, each
//      at a different version. The newer application may safely send objects
//      containing properties that the older application is expected to ignore,
//      as is common practice with JSON.

//      Consider another scenario. Suppose the Extension BLOB encodes some kind
//      of capability, but the application does not anticipate it. If the
//      application receives the contents of the capability as a string or
//      Uint8Array, untrusted code within the application might take advantage
//      of this lapse to exfiltrate the capability's raw material. It is safer
//      to redact it.

//  null
//      Like the previous approach, except that properties are not omitted.
//      There is no obvious merit to this approach.

// We choose 'undefined' because it is fastest, safest and least surprising
// behavior.

            return;
        });
    }

    function consume_array() {

// prefix::Octet length::Number size::Number elements::Value*

        consume(1);
        let length = consume_magnitude("length");
        let elements = new Array(length);
        if (length > 0) {
            let size_position = position;
            let size = consume_magnitude("size");
            let elements_position = position;
            let element_nr = 0;
            while (element_nr < length) {
                path.push(element_nr);
                elements[element_nr] = consume_value();
                path.pop();
                element_nr += 1;
            }
            let actual_size = position - elements_position;
            if (actual_size !== size) {
                return fail(
                    size_position,
                    "Expected array size {a}, got {b}",
                    size,
                    actual_size
                );
            }
        }
        return unpack_value(elements);
    }

    function consume_object() {

// prefix::Octet length::Number size::Number members::(key::Value value::Value)*

        consume(1);
        let length = consume_magnitude("length");
        let entries = [];
        let raw_keys = [];
        if (length > 0) {
            let size_position = position;
            let size = consume_magnitude("size");
            let entries_position = position;
            while (length > 0) {
                let recover = mark();
                path.push(true);
                let key = consume_value();
                path.pop();
                raw_keys.push(recover());
                path.push(pathify(key));
                let value = consume_value();
                path.pop();
                entries.push([key, value]);
                length -= 1;
            }
            let actual = position - entries_position;
            if (actual !== size) {
                return fail(
                    size_position,
                    "Expected object size {a}, got {b}",
                    size,
                    actual
                );
            }
        }
        return unpack_any({entries}, function canonical() {
            let object = {};
            entries.forEach(function ([key, value], property_nr) {
                if (typeof key !== "string") {
                    key = stringify(raw_keys[property_nr]);
                }
                object[key] = value;
            });
            return object;
        });
    }

    function consume_value() {
        const prefix = octets[0];
        if (prefix === null_octet) {
            consume(1);
            return unpack_value(null);
        }
        if (prefix === false_octet) {
            consume(1);
            return unpack_value(false);
        }
        if (prefix === true_octet) {
            consume(1);
            return unpack_value(true);
        }
        if (
            prefix === positive_decimal_octet
            || prefix === negative_decimal_octet
        ) {
            return consume_decimal();
        }
        if (
            prefix === positive_rational_octet
            || prefix === negative_rational_octet
        ) {
            return consume_rational();
        }
        if (prefix === array_octet) {
            return consume_array();
        }
        if (prefix === object_octet) {
            return consume_object();
        }
        if (prefix === raw_blob_octet) {
            return consume_raw_blob();
        }
        if (prefix === extension_blob_octet) {
            return consume_extension_blob();
        }
        if (prefix === string_octet) {
            return consume_string();
        }
        if (prefix === string_memo_octet || prefix === memo_reference_octet) {
            return fail(position, "Memoization not supported");
        }

// The remaining prefixes all designate an integer.

        return consume_integer();
    }

// We expect that the 'octets' Uint8Array initially aligns with its underlying
// ArrayBuffer. Make a copy if necessary.

    if (octets.length !== octets.buffer.byteLength) {
        octets = octets.slice();
    }
    if (Number.isSafeInteger(seek) && seek >= 0) {
        consume(seek);
        return consume_value();
    }
    const value = consume_value();
    if (octets.length > 0) {
        return fail(
            position,
            "Unexpected octet 0b{a}",
            octets[0].toString(2).padStart(8, "0")
        );
    }
    return value;
}

export default Object.freeze({encode, decode});
