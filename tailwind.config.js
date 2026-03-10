/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          100: '#FFB5B5',
          200: '#FF8A8A',
          300: '#FF6B6B',
        },
        menta: {
          100: '#A8D5C5',
          200: '#8BC9B5',
          300: '#6FBAA0',
        },
        azul: {
          100: '#B8E4F0',
          200: '#8AB8FF',
          300: '#5A9CFF',
        },
        crema: {
          100: '#FFF5DC',
          200: '#FFE8C0',
        },
        text: {
          primary: '#1F2937',
          secondary: '#374151',
          tertiary: '#6B7280',
        },
      },
      boxShadow: {
        'glow-coral': '0 4px 16px rgba(255, 138, 138, 0.3)',
        'glow-menta': '0 4px 16px rgba(168, 213, 197, 0.3)',
        'glow-azul': '0 4px 16px rgba(138, 184, 255, 0.3)',
      },
    },
  },
  plugins: [],
}