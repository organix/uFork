// A very simple pseudo-random number generator. Not cryptographically secure.
// https://en.wikipedia.org/wiki/Lehmer_random_number_generator

/*jslint browser, global */

function prng(seed) {
    const n = 2 ** 31 - 1;  // a Mersenne prime
    const g = 7 ** 5;       // a primitive root modulo
    seed %= n;
    if (seed <= 0) {
        seed += n;
    }
    return function random(min = 0, max = 1) {
        seed *= g;
        seed %= n;
        const float = (seed - 1) / (n - 1);
        return float * (max - min) + min;
    };
}

if (import.meta.main) {

// The demo fills the viewport with pixels that are pseudorandomly white or
// black. The pseudorandomness is seeded with a static value.
// Compare the result with true randomness at https://www.random.org/bitmaps/.

    document.documentElement.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    const seed = 42;
    const random = prng(seed);
    new ResizeObserver(function draw_random_pixels() {
        const width = globalThis.innerWidth;
        const height = globalThis.innerHeight;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        const image = ctx.createImageData(width, height);
        let byte_nr = 0;
        while (byte_nr < image.data.length) {
            image.data[byte_nr] = 0;        // red
            image.data[byte_nr + 1] = 0;    // green
            image.data[byte_nr + 2] = 0;    // blue
            image.data[byte_nr + 3] = (     // alpha
                random() < 0.5
                ? 0
                : 255
            );
            byte_nr += 4;
        }
        ctx.putImageData(image, 0, 0);
    }).observe(document.body);
    document.body.append(canvas);
}

export default Object.freeze(prng);
