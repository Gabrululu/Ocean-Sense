/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        paw: {
          bg:     "#0a0015",
          card:   "#1c0a35",
          border: "#3d2062",
          pink:   "#f472b6",
          purple: "#a855f7",
        },
      },
    },
  },
  plugins: [],
};
