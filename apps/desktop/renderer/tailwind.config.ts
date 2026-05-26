import type { Config } from 'tailwindcss';

/** Theme only: Tailwind v4 scans via `@source` in `src/globals.css`, not this `content` array. */
const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        primary: ['Space Grotesk', 'system-ui', 'sans-serif'],
        secondary: ['Montserrat', 'system-ui', 'sans-serif'],
        brand: ['Poiret One', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
