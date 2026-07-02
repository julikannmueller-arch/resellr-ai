import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0A",
        surface: "#181818",
        green: "#1ED760",
        "text-primary": "#FFFFFF",
        "text-secondary": "#B3B3B3",
        "text-muted": "#535353",
      },
      borderRadius: {
        card: "12px",
        input: "8px",
        pill: "9999px",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "sans-serif"],
      },
      boxShadow: {
        "glow-green": "0 0 24px rgba(30,215,96,0.3)",
      },
    },
  },
  plugins: [],
};
export default config;
