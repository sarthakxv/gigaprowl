/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0E0D",
        panel: "#111716",
        edge: "#1E2A27",
        mint: "#3DFFA2",
        mintdim: "#2BCB80",
        fog: "#9DB4AC",
        canvas: "#F7FAF8",
        surface: "#FFFFFF",
        raised: "#EEF4F1",
        copy: "#14201B",
        muted: "#495B54",
        line: "#7C8F87",
        soft: "#D6E0DB",
        brand: "#177D56",
        branddark: "#0D5B3C",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
