import { redirect } from 'next/navigation'

/** The shared inbox is where the team's day starts. */
export default function Home() {
  redirect('/inbox')
}
