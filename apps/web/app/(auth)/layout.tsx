import { Libre_Franklin, Playfair_Display } from 'next/font/google'
import styles from './auth.module.css'

// Franklin Gothic is the brand book's approved stand-in for Gentona.
const franklin = Libre_Franklin({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-franklin',
  display: 'swap',
})

// Stand-in for Ogg until the official wordmark file is added.
const display = Playfair_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-display',
  display: 'swap',
})

/**
 * Sign-in, sign-up and organization selection, in The Agency's Nerve look:
 * black ground, white type, and a few blurred, grainy colour forms kept to
 * the edges so they never sit behind the form.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${styles.page} ${franklin.variable} ${display.variable}`}>
      <div className={styles.forms} aria-hidden>
        <span className={`${styles.form} ${styles.formA}`} />
        <span className={`${styles.form} ${styles.formB}`} />
        <span className={`${styles.form} ${styles.formC}`} />
        <span className={`${styles.form} ${styles.formD}`} />
      </div>
      <div className={styles.grain} aria-hidden />

      <main className={styles.layout}>
        <section className={styles.brand}>
          <p className={styles.wordmark}>The Agency</p>
          <p className={styles.product}>ACCESS PR · Workflow assistant</p>
          <p className={styles.pitch}>Every client, from first email to final release. One place, zero re-typing.</p>
        </section>

        <section className={styles.panel}>{children}</section>
      </main>

      <footer className={styles.foot}>
        Internal tool. It drafts, organizes and exports. <strong>People send.</strong>
      </footer>
    </div>
  )
}
