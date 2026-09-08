import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: {
            50: "#eef4fc",
            100: "#d6e6f7",
            200: "#adc9ef",
            300: "#7fa9e3",
            400: "#4d85d4",
            // primary NMS blue — placeholder, swap for the exact brand hex when available
            500: "#2c66bd",
            600: "#20509a",
            700: "#1a4079",
            800: "#173461",
            900: "#152c4f",
          },
          green: {
            // accent for OK / vyřešeno / potvrzující stavy
            50: "#eafaf1",
            100: "#cdf2dd",
            200: "#9be5bd",
            300: "#63d199",
            400: "#35bb7c",
            500: "#1fa066",
            600: "#178052",
            700: "#146543",
            800: "#125137",
            900: "#10432f",
          },
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 2px 12px 0 rgb(15 23 42 / 0.06)",
        softHover: "0 6px 20px 0 rgb(15 23 42 / 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
