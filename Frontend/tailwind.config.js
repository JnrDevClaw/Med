/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Premium Medical Teal/Emerald Theme - Based on #14B8A6
				'med-teal': {
					50: '#f0fdfa',
					100: '#ccfbf1',
					200: '#99f6e4',
					300: '#5eead4',
					400: '#2dd4bf',
					500: '#14b8a6', // Primary teal - user specified color
					600: '#0d9488',
					700: '#0f766e',
					800: '#115e59',
					900: '#134e4a',
					950: '#042f2e',
				},
				'med-emerald': {
					50: '#ecfdf5',
					100: '#d1fae5',
					200: '#a7f3d0',
					300: '#6ee7b7',
					400: '#34d399',
					500: '#10b981',
					600: '#059669',
					700: '#047857',
					800: '#065f46',
					900: '#064e3b',
					950: '#022c22',
				},
				'med-cyan': {
					50: '#ecfeff',
					100: '#cffafe',
					200: '#a5f3fc',
					300: '#67e8f9',
					400: '#22d3ee',
					500: '#06b6d4',
					600: '#0891b2',
					700: '#0e7490',
					800: '#155e75',
					900: '#164e63',
					950: '#083344',
				},
				'med-slate': {
					50: '#f8fafc',
					100: '#f1f5f9',
					200: '#e2e8f0',
					300: '#cbd5e1',
					400: '#94a3b8',
					500: '#64748b',
					600: '#475569',
					700: '#334155',
					800: '#1e293b',
					900: '#0f172a',
					950: '#020617',
				},
				'med-neutral': {
					50: '#fafafa',
					100: '#f5f5f5',
					200: '#e5e5e5',
					300: '#d4d4d4',
					400: '#a3a3a3',
					500: '#737373',
					600: '#525252',
					700: '#404040',
					800: '#262626',
					900: '#171717',
					950: '#0a0a0a',
				},
				// Premium Medical Status Colors
				'med-success': {
					50: '#f0fdf4',
					100: '#dcfce7',
					200: '#bbf7d0',
					300: '#86efac',
					400: '#4ade80',
					500: '#22c55e',
					600: '#16a34a',
					700: '#15803d',
					800: '#166534',
					900: '#14532d',
					950: '#052e16',
				},
				'med-warning': {
					50: '#fffbeb',
					100: '#fef3c7',
					200: '#fde68a',
					300: '#fcd34d',
					400: '#fbbf24',
					500: '#f59e0b',
					600: '#d97706',
					700: '#b45309',
					800: '#92400e',
					900: '#78350f',
					950: '#451a03',
				},
				'med-error': {
					50: '#fef2f2',
					100: '#fee2e2',
					200: '#fecaca',
					300: '#fca5a5',
					400: '#f87171',
					500: '#ef4444',
					600: '#dc2626',
					700: '#b91c1c',
					800: '#991b1b',
					900: '#7f1d1d',
					950: '#450a0a',
				},
				// Component Aliases - Teal Primary System
				primary: {
					50: '#f0fdfa',
					100: '#ccfbf1',
					200: '#99f6e4',
					300: '#5eead4',
					400: '#2dd4bf',
					500: '#14b8a6', // Main brand color
					600: '#0d9488',
					700: '#0f766e',
					800: '#115e59',
					900: '#134e4a',
					950: '#042f2e',
				},
				secondary: {
					50: '#ecfdf5',
					100: '#d1fae5',
					200: '#a7f3d0',
					300: '#6ee7b7',
					400: '#34d399',
					500: '#10b981',
					600: '#059669',
					700: '#047857',
					800: '#065f46',
					900: '#064e3b',
					950: '#022c22',
				},
				accent: {
					50: '#ecfeff',
					100: '#cffafe',
					200: '#a5f3fc',
					300: '#67e8f9',
					400: '#22d3ee',
					500: '#06b6d4',
					600: '#0891b2',
					700: '#0e7490',
					800: '#155e75',
					900: '#164e63',
					950: '#083344',
				},
				neutral: {
					50: '#f8fafc',
					100: '#f1f5f9',
					200: '#e2e8f0',
					300: '#cbd5e1',
					400: '#94a3b8',
					500: '#64748b',
					600: '#475569',
					700: '#334155',
					800: '#1e293b',
					900: '#0f172a',
					950: '#020617',
				},
				// Status Aliases
				success: {
					50: '#f0fdf4',
					100: '#dcfce7',
					200: '#bbf7d0',
					300: '#86efac',
					400: '#4ade80',
					500: '#22c55e',
					600: '#16a34a',
					700: '#15803d',
					800: '#166534',
					900: '#14532d',
					950: '#052e16',
				},
				warning: {
					50: '#fffbeb',
					100: '#fef3c7',
					200: '#fde68a',
					300: '#fcd34d',
					400: '#fbbf24',
					500: '#f59e0b',
					600: '#d97706',
					700: '#b45309',
					800: '#92400e',
					900: '#78350f',
					950: '#451a03',
				},
				error: {
					50: '#fef2f2',
					100: '#fee2e2',
					200: '#fecaca',
					300: '#fca5a5',
					400: '#f87171',
					500: '#ef4444',
					600: '#dc2626',
					700: '#b91c1c',
					800: '#991b1b',
					900: '#7f1d1d',
					950: '#450a0a',
				},
				info: {
					50: '#ecfeff',
					100: '#cffafe',
					200: '#a5f3fc',
					300: '#67e8f9',
					400: '#22d3ee',
					500: '#06b6d4',
					600: '#0891b2',
					700: '#0e7490',
					800: '#155e75',
					900: '#164e63',
					950: '#083344',
				}
			},
			// Glassmorphism & Premium Medical Shadows
			backdropBlur: {
				'xs': '2px',
				'sm': '4px',
				'md': '8px',
				'lg': '16px',
				'xl': '24px',
				'2xl': '32px',
				'3xl': '48px',
			},
			boxShadow: {
				'glass': '0 8px 32px 0 rgba(20, 184, 166, 0.08)',
				'glass-lg': '0 16px 64px 0 rgba(20, 184, 166, 0.12)',
				'glass-xl': '0 24px 96px 0 rgba(20, 184, 166, 0.16)',
				'medical': '0 4px 16px 0 rgba(20, 184, 166, 0.10)',
				'medical-lg': '0 8px 32px 0 rgba(20, 184, 166, 0.15)',
				'soft': '0 2px 16px 0 rgba(100, 116, 139, 0.08)',
				'soft-lg': '0 4px 32px 0 rgba(100, 116, 139, 0.12)',
				'glow': '0 0 20px rgba(20, 184, 166, 0.15)',
				'glow-lg': '0 0 40px rgba(20, 184, 166, 0.20)',
				'inner-glass': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
				'border-glass': '0 0 0 1px rgba(255, 255, 255, 0.1)',
			},
			// Premium Medical Typography
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				display: ['Inter', 'system-ui', 'sans-serif'], // For headings
				body: ['Inter', 'system-ui', 'sans-serif'], // For body text
				mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'], // For code/data
				medical: ['Inter', 'system-ui', 'sans-serif'], // Professional medical interface
			},
			fontSize: {
				'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.025em' }],
				'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.025em' }],
				'base': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0.025em' }],
				'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '0.025em' }],
				'xl': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '0.025em' }],
				'2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '0.025em' }],
				'3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '0.025em' }],
				'4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '0.025em' }],
				'5xl': ['3rem', { lineHeight: '1', letterSpacing: '0.025em' }],
				'6xl': ['3.75rem', { lineHeight: '1', letterSpacing: '0.025em' }],
				'7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '0.025em' }],
				'8xl': ['6rem', { lineHeight: '1', letterSpacing: '0.025em' }],
				'9xl': ['8rem', { lineHeight: '1', letterSpacing: '0.025em' }],
				// Medical Data Display
				'data-xs': ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.05em', fontWeight: '500' }],
				'data-sm': ['0.8125rem', { lineHeight: '1rem', letterSpacing: '0.05em', fontWeight: '500' }],
				'data-base': ['0.9375rem', { lineHeight: '1.25rem', letterSpacing: '0.05em', fontWeight: '500' }],
				'data-lg': ['1.0625rem', { lineHeight: '1.5rem', letterSpacing: '0.05em', fontWeight: '500' }],
				'metric-sm': ['1.5rem', { lineHeight: '2rem', letterSpacing: '0.025em', fontWeight: '600' }],
				'metric-md': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '0.025em', fontWeight: '600' }],
				'metric-lg': ['3rem', { lineHeight: '1', letterSpacing: '0.025em', fontWeight: '600' }],
			},
			// Premium Medical Animations
			animation: {
				// Existing animations
				'fade-in': 'fadeIn 0.5s ease-in-out',
				'slide-up': 'slideUp 0.3s ease-out',
				'slide-down': 'slideDown 0.3s ease-out',
				'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
				// New premium medical animations
				'shimmer': 'shimmer 2s linear infinite',
				'bounce-subtle': 'bounceSubtle 0.5s ease-out',
				'fade-in-up': 'fadeInUp 0.6s ease-out',
				'fade-in-down': 'fadeInDown 0.6s ease-out',
				'scale-in': 'scaleIn 0.3s ease-out',
				'slide-in-right': 'slideInRight 0.4s ease-out',
				'slide-in-left': 'slideInLeft 0.4s ease-out',
				'glow-pulse': 'glowPulse 2s ease-in-out infinite',
				'float': 'float 3s ease-in-out infinite',
				'rotate-slow': 'rotate 8s linear infinite',
				// Stagger animations
				'stagger-1': 'fadeInUp 0.6s ease-out 0.1s both',
				'stagger-2': 'fadeInUp 0.6s ease-out 0.2s both',
				'stagger-3': 'fadeInUp 0.6s ease-out 0.3s both',
				'stagger-4': 'fadeInUp 0.6s ease-out 0.4s both',
				'stagger-5': 'fadeInUp 0.6s ease-out 0.5s both',
				// Loading states
				'skeleton': 'skeleton 1.5s ease-in-out infinite',
				'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
				'spin-slow': 'spin 2s linear infinite',
			},
			keyframes: {
				// Existing keyframes
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				slideUp: {
					'0%': { transform: 'translateY(10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				slideDown: {
					'0%': { transform: 'translateY(-10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				// New premium medical keyframes
				shimmer: {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(100%)' }
				},
				bounceSubtle: {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-4px)' }
				},
				fadeInUp: {
					'0%': { opacity: '0', transform: 'translateY(20px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				fadeInDown: {
					'0%': { opacity: '0', transform: 'translateY(-20px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				scaleIn: {
					'0%': { opacity: '0', transform: 'scale(0.9)' },
					'100%': { opacity: '1', transform: 'scale(1)' }
				},
				slideInRight: {
					'0%': { opacity: '0', transform: 'translateX(20px)' },
					'100%': { opacity: '1', transform: 'translateX(0)' }
				},
				slideInLeft: {
					'0%': { opacity: '0', transform: 'translateX(-20px)' },
					'100%': { opacity: '1', transform: 'translateX(0)' }
				},
				glowPulse: {
					'0%, 100%': { boxShadow: '0 0 20px rgba(20, 184, 166, 0.1)' },
					'50%': { boxShadow: '0 0 40px rgba(20, 184, 166, 0.2)' }
				},
				float: {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-6px)' }
				},
				skeleton: {
					'0%, 100%': { opacity: '0.2' },
					'50%': { opacity: '0.4' }
				},
				heartbeat: {
					'0%, 50%, 100%': { transform: 'scale(1)' },
					'25%, 75%': { transform: 'scale(1.05)' }
				}
			},
			// Premium Spacing System
			spacing: {
				'18': '4.5rem',
				'88': '22rem',
				'92': '23rem',
				'96': '24rem',
				'128': '32rem',
			},
			// Medical Interface Borders
			borderRadius: {
				'4xl': '2rem',
				'5xl': '2.5rem',
				'6xl': '3rem',
			},
			// Premium Transitions
			transitionTimingFunction: {
				'bounce-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
				'ease-spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
				'ease-medical': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
			},
			// Glassmorphism Backdrop Filters
			backdropSaturate: {
				'150': '1.5',
				'200': '2',
			}
		}
	},
	plugins: [
		require('@tailwindcss/forms'),
		require('@tailwindcss/typography')
	]
};
