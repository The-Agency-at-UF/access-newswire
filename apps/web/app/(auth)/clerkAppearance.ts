import type { SignIn } from '@clerk/nextjs'
import type { ComponentProps } from 'react'

type Appearance = NonNullable<ComponentProps<typeof SignIn>['appearance']>

/**
 * Clerk components in The Agency's Nerve palette: black ground, white type,
 * light purple as the action colour, the pink-red for errors.
 * Franklin Gothic stands in for Gentona, per the brand book.
 */
export const agencyAppearance: Appearance = {
  variables: {
    colorPrimary: '#ab9bff',
    colorPrimaryForeground: '#000000',
    colorDanger: '#ff4d56',
    colorSuccess: '#9fd7ae',
    colorWarning: '#ffb23e',
    colorNeutral: '#ffffff',
    colorForeground: '#ffffff',
    colorMutedForeground: '#b7b0cf',
    colorBackground: '#0c0b10',
    colorInput: '#17151f',
    colorInputForeground: '#ffffff',
    colorBorder: 'rgba(255, 255, 255, 0.14)',
    colorRing: '#ab9bff',
    colorShadow: '#000000',
    borderRadius: '10px',
    fontFamily: 'var(--font-franklin), "Franklin Gothic", system-ui, sans-serif',
    fontFamilyButtons: 'var(--font-franklin), "Franklin Gothic", system-ui, sans-serif',
  },
  options: {
    logoPlacement: 'none',
    socialButtonsVariant: 'blockButton',
  },
  elements: {
    cardBox: {
      width: '100%',
      maxWidth: '400px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 30px 90px -20px rgba(83, 2, 216, 0.55)',
    },
    headerTitle: {
      textTransform: 'uppercase',
      fontWeight: 800,
      letterSpacing: '0.02em',
      fontSize: '20px',
    },
    formButtonPrimary: {
      textTransform: 'uppercase',
      fontWeight: 700,
      letterSpacing: '0.06em',
    },
  },
}
