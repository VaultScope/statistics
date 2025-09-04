/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#000000',
        foreground: '#ffffff',
        card: '#0a0a0a',
        'card-foreground': '#ffffff',
        popover: '#0a0a0a',
        'popover-foreground': '#ffffff',
        primary: '#ffffff',
        'primary-foreground': '#000000',
        secondary: '#262626',
        'secondary-foreground': '#ffffff',
        muted: '#262626',
        'muted-foreground': '#a3a3a3',
        accent: '#262626',
        'accent-foreground': '#ffffff',
        destructive: '#ef4444',
        'destructive-foreground': '#ffffff',
        border: '#262626',
        input: '#262626',
        ring: '#a3a3a3',
      },
      borderRadius: {
        '25': '25px',
      }
    },
  },
  plugins: [],
}