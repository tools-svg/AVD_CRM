/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#EBE5E5',
        card: '#E8E4E4',
        surface: '#F5F3F4',
        border: '#E1DCDC',
        primary: {
          DEFAULT: '#0A0A0A',
          foreground: '#FFFFFF',
        },
        text: {
          primary: '#333333',
          secondary: '#888888',
        },
        status: {
          notStartedBg: '#E8E8E8',
          notStartedText: '#666666',
          inProgressBg: '#DCE4FA',
          inProgressText: '#5269A8',
          reviewBg: '#F4E9D2',
          reviewText: '#A78645',
          onHoldBg: '#F3E4D1',
          onHoldText: '#A87945',
          closedBg: '#D9EEE5',
          closedText: '#43866B',
          cancelledBg: '#F5DEDE',
          cancelledText: '#B65F65',
        },
        priority: {
          lowBg: '#E4E9E5',
          lowText: '#6B8674',
          mediumBg: '#F4E9D2',
          mediumText: '#A78645',
          highBg: '#F2DADA',
          highText: '#B65F65',
          urgentBg: '#F5D5D5',
          urgentText: '#A93232',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
        modal: '18px',
        btn: '10px',
        input: '10px',
        popover: '12px',
        preview: '14px',
      }
    },
  },
  plugins: [],
}

