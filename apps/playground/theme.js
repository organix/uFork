// The default playground theme.

const programma_url = import.meta.resolve("./programma.woff2");

export default Object.freeze({
    red: "#F92672",
    orange: "#FD971F",
    silver: "#BFBFBF",
    gray: "#484848",
    black: "#222222",
    blue: "#60B8EF",
    green: "#28C846",
    purple: "#CE80FF",
    yellow: "#E6DB74",
    monospace_font_family: "Programma",
    monospace_font_css: `
        @font-face {
            font-family: "Programma";
            font-style: normal;
            src: url(${programma_url}) format("woff2");
        }
    `
});
