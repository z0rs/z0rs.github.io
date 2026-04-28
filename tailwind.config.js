module.exports = {
  content: [
    './src/components/**/*.{js,jsx,ts,tsx}',
    './src/pages/**/*.{js,jsx,ts,tsx}',
    './src/templates/**/*.{js,jsx,ts,tsx}',
    './content/**/*.{md,mdx}'
  ],

  safelist: [
    '!mb-0',
    '!mt-0',
    'my-20',
    'grid',
    'md:grid-cols-1fr-1fr',
    'gap-8',
    'gap-32',
    'text-base',
    'text-sm',
    'text-xs',

    'text-violet-300',
    'text-violet-400',
    'text-violet-500',
    'rotate-90',

    'stroke-teal',
    'stroke-mouve',
    'stroke-salmon',
    'stroke-yellow',
    'stroke-bogey',
    'stroke-blood',
    'stroke-starfleet',
    'stroke-electric',

    'text-teal',
    'text-mouve',
    'text-salmon',
    'text-yellow',
    'text-bogey',
    'text-blood',
    'text-starfleet',
    'text-electric',

    'bg-teal',
    'bg-mouve',
    'bg-salmon',
    'bg-yellow',
    'bg-bogey',
    'bg-blood',
    'bg-starfleet',
    'bg-electric'
  ],

  theme: {
    extend: {
      colors: {
        text: '#e5e7eb',

        primary: '#f056c7',
        secondary: '#8b87ea',
        tertiary: '#58e6d9',
        muted: '#605c9d',

        salmon: '#ff6090',
        mouve: '#3f51b5',
        teal: '#00bcd4',
        bogey: '#8bc34a',
        yellow: '#ffc107',
        fuchsia: '#7B1FA2',
        blood: '#ff5722',
        starfleet: '#2990fa',
        electric: '#6933ff',

        background: '#131127',
        outline: '#232140',
        surface: '#18162c',
        guide: '#2d2a58'
      },

      keyframes: {
        bar: {
          '0%': { width: '100%' },
          '100%': { width: '0%' }
        }
      },

      animation: {
        'scaling-bar': 'bar 60s linear infinite'
      },

      fontFamily: {
        sans: ['Inconsolata', 'ui-sans-serif', 'system-ui'],
        mono: ['ui-monospace', 'monospace']
      },

      maxWidth: {
        '8xl': '90rem'
      },

      gridTemplateColumns: {
        'auto-auto': 'auto auto',
        'auto-1fr': 'auto 1fr',
        '1fr-auto': '1fr auto',
        '1fr-1fr': '1fr 1fr'
      },

      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.text'),

            '*': {
              wordBreak: 'break-word'
            },

            /* TABLE SUPPORT FOR MDX */

            table: {
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: theme('fontSize.sm')[0]
            },

            'thead th': {
              color: theme('colors.secondary'),
              borderBottomWidth: '2px',
              borderBottomColor: theme('colors.outline'),
              padding: '0.5rem 0.75rem',
              textAlign: 'left'
            },

            'tbody td': {
              borderBottomWidth: '1px',
              borderBottomColor: theme('colors.outline'),
              padding: '0.5rem 0.75rem',
              verticalAlign: 'top'
            },

            'tbody tr:last-child td': {
              borderBottomWidth: '0'
            },

            h1: {
              color: theme('colors.text'),
              fontWeight: theme('fontWeight.bold'),
              a: {
                color: theme('colors.text')
              }
            },

            h2: {
              color: theme('colors.salmon'),
              fontWeight: theme('fontWeight.bold'),
              a: {
                color: theme('colors.salmon')
              }
            },

            h3: {
              color: theme('colors.salmon'),
              fontWeight: theme('fontWeight.bold'),
              a: {
                color: theme('colors.salmon')
              }
            },

            h4: {
              color: theme('colors.salmon'),
              fontWeight: theme('fontWeight.bold'),
              a: {
                color: theme('colors.salmon')
              }
            },

            h5: {
              color: theme('colors.salmon'),
              fontWeight: theme('fontWeight.bold'),
              a: {
                color: theme('colors.salmon')
              }
            },

            h6: {
              color: theme('colors.salmon'),
              fontWeight: theme('fontWeight.bold'),
              a: {
                color: theme('colors.salmon')
              }
            },

            strong: {
              color: theme('colors.text')
            },

            a: {
              color: theme('colors.secondary'),
              fontWeight: theme('fontWeight.bold'),
              '&:hover': {
                color: theme('colors.muted'),
                transition: 'all 0.2s ease'
              },
              '> p': {
                margin: 0
              }
            },

            pre: {
              background: theme('colors.surface')
            },

            code: {
              color: theme('colors.tertiary'),

              '& .prism-code': {
                background: 'transparent'
              },

              '&::before': {
                content: '"" !important'
              },

              '&::after': {
                content: '"" !important'
              }
            },

            blockquote: {
              fontSize: '1rem !important',
              color: theme('colors.text')
            }
          }
        }
      })
    }
  },

  plugins: [require('@tailwindcss/typography')]
};
