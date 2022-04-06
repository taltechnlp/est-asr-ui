module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  daisyui: {
    themes: [
      {
        mytheme: {

          "primary": "#177E89",

          "secondary": "#6B4D57",

          "accent": "#EFF9F0",

          "neutral": "#70ACC7",

          "base-100": "#FFFFFF",

          "info": "#3ABFF8",

          "success": "#36D399",

          "warning": "#FBBD23",

          "error": "#F87272",
        },
      },
    ],
  },
  theme: {
    extend: {}
  },
  plugins: [require("@tailwindcss/typography"), require("daisyui"), require('@tailwindcss/forms')],
};