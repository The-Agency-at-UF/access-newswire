/**
 * Stand-in frameworks so every task can run end to end before the team's
 * real ones are loaded (decided 2026-10-20). Each is marked PLACEHOLDER and
 * seeded with frameworks.is_placeholder = true; an admin replaces it in
 * Settings with the team's own text. These are deliberately minimal — they
 * are not an attempt at the team's frameworks (AGENTS.md §10).
 */

import type { Database } from '@access/db'

export type FrameworkKind = Database['public']['Enums']['framework_kind']

const NOTE = 'PLACEHOLDER — replace with the team\'s framework in Settings.'

export const PLACEHOLDER_FRAMEWORKS: Record<FrameworkKind, { title: string; body: string }> = {
  research: {
    title: 'Preliminary research (placeholder)',
    body: `${NOTE}\n\nResearch the client for a PR onboarding: what the company does, its market, recent news and press coverage, competitors and how they get press, and story angles worth pursuing. Use web search. Separate what you found from what you infer, and list questions to ask the client in Meeting 1.`,
  },
  onboarding_deck: {
    title: 'Onboarding deck (placeholder)',
    body: `${NOTE}\n\nDraft the slides for the client onboarding deck from the approved research: who we are working with, what we learned, the opportunity, proposed story angles, how we will work together, and next steps. One section per slide, with speaker notes.`,
  },
  strategy: {
    title: 'Six-month strategy (placeholder)',
    body: `${NOTE}\n\nDraft a six-month PR strategy in a statement-of-work style: objectives, messaging pillars, phases with goals and tactics, a month-by-month roadmap of announcements, and a bank of story angles. Build on the approved deck and the Meeting 1 notes.`,
  },
  press_release_write: {
    title: 'Press release — we write (placeholder)',
    body: `${NOTE}\n\nWrite a press release in AP style: headline, optional subheadline, dateline, a lead paragraph answering who/what/when/where/why, supporting paragraphs, a quote placeholder marked [QUOTE: name, title] unless a real quote is provided, and the company boilerplate.`,
  },
  press_release_edit: {
    title: 'Press release — we edit (placeholder)',
    body: `${NOTE}\n\nThe client wrote this release. Keep their draft intact as sections and suggest edits: AP style, clarity, a stronger lead, and newsworthiness. Each suggestion quotes the exact original text and gives a reason.`,
  },
  media_list: {
    title: 'Media list ranking (placeholder)',
    body: `${NOTE}\n\nRank the candidate journalists for this release by how likely the story fits their beat and recent coverage. Give a one-sentence reason for each and mark whether to include them. Use only the candidates provided, by id.`,
  },
  pitch_set: {
    title: 'Pitches (placeholder)',
    body: `${NOTE}\n\nWrite a short base pitch for the approved release, then adapt it for each journalist on the approved media list: a subject line and a body under 150 words that connects the story to their beat. Use only the journalists provided, by id.`,
  },
  report: {
    title: 'Client report (placeholder)',
    body: `${NOTE}\n\nSummarize results for the client: releases sent, ACCESS stats, earned coverage, and what we recommend next.`,
  },
  email_classify: {
    title: 'Inbox classification (placeholder)',
    body: `${NOTE}\n\nClassify an email sent to the team's shared inbox. Labels: release_info (a client sending material for a release), client_update (news or changes from a client), sales_handoff (sales handing over a newly signed client), social (social media requests), auto_notification (automated notices, e.g. a release went out), other. Match it to a client from the list when the sender, company or content makes it clear; otherwise return null. Extract only what the email states.`,
  },
}
