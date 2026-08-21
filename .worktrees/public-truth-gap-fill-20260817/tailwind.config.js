module.exports = {
  // Matches our data-theme attribute (see src/lib/theme.ts), not raw OS
  // preference — Tailwind's default 'media' strategy would ignore the
  // user's explicit light/dark/system choice entirely. No existing file
  // used the `dark:` variant before this, so this has zero effect on any
  // page outside the admin dashboard, which is the first consumer of it.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "#111827",
        surface2: "#1E293B",
        border: "#334155",
        accent: "#2563EB",
        success: "#059669",
        warning: "#D97706",
        danger: "#DC2626",
        muted: "#94A3B8"
      }
    }
  },
  plugins: []
};
