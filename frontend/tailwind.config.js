/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#161514",
        mist: "#f5f3ef",
        panel: "#fbfaf8",
        line: "#ddd8cd",
        accent: "#235347",
        sand: "#e9e3d6",
      },
      boxShadow: {
        panel: "0 14px 40px rgba(22, 21, 20, 0.08)",
      },
    },
  },
  plugins: [],
};
