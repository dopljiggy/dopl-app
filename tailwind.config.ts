import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dopl: {
          deep: "#0D261F",
          sage: "#2D4A3E",
          lime: "#C5D634",
          cream: "#F3EFE8",
          glass: "rgba(45, 74, 62, 0.4)",
          "glass-light": "rgba(45, 74, 62, 0.2)",
          "glass-border": "rgba(197, 214, 52, 0.15)",
        },
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backdropBlur: {
        glass: "20px",
      },
    },
  },
  plugins: [],
};
export default config;
