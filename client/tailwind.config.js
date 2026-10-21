import daisyui from "daisyui";

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        smartfleet: {
          primary: "#0f766e",
          secondary: "#2563eb",
          accent: "#f59e0b",
          neutral: "#111827",
          "base-100": "#f8fafc",
          info: "#0891b2",
          success: "#16a34a",
          warning: "#d97706",
          error: "#dc2626"
        }
      }
    ]
  }
};
