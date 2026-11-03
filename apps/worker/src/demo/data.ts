/**
 * The demo team's data: made-up clients, mail, releases and onboarding work,
 * shaped exactly like what the app and the worker write. `sql.ts` renders it.
 *
 * Times are relative (hours ago, days from now) so the demo looks current on
 * whatever day it's seeded. Domains use `.example`, so no address is real.
 */

import type { GenerationTask } from '@access/ai'

export type MemberKey = 'nora' | 'theo' | 'iris' | 'felix'
/** `presenter` is whoever already belongs to the demo team (the person demoing). */
export type OwnerKey = MemberKey | 'presenter'
export type Tier = 'L1' | 'L2' | 'L3'
export type EmailLabel = 'release_info' | 'client_update' | 'sales_handoff' | 'social' | 'auto_notification' | 'other'

export const MEMBERS: Record<MemberKey, { name: string; email: string }> = {
  nora: { name: 'Nora Bennett', email: 'nora@newswire.example' },
  theo: { name: 'Theo Grant', email: 'theo@newswire.example' },
  iris: { name: 'Iris Castillo', email: 'iris@newswire.example' },
  felix: { name: 'Felix Ward', email: 'felix@newswire.example' },
}

/** Owner of anything assigned to the presenter when the demo team has no one else yet. */
export const PRESENTER_FALLBACK: MemberKey = 'felix'

export const SHARED_INBOX = 'theagency@newswire.example'

export interface DemoClient {
  name: string
  website: string
  industry: string
  tier: Tier
  cadence: string
  owner: OwnerKey
  onboardedExternally: boolean
  addedDaysAgo: number
  about: string
  contact: { name: string; email: string; title: string }
}

export const CLIENTS = {
  northwind: {
    name: 'Northwind Analytics',
    website: 'northwind-analytics.example',
    industry: 'Retail analytics software',
    tier: 'L2',
    cadence: '1 / week',
    owner: 'presenter',
    onboardedExternally: true,
    addedDaysAgo: 210,
    about: 'Real-time analytics for retail data teams. Austin, Texas.',
    contact: { name: 'Priya Raman', email: 'priya@northwind-analytics.example', title: 'CEO' },
  },
  bluefin: {
    name: 'Bluefin Health',
    website: 'bluefinhealth.example',
    industry: 'Digital health',
    tier: 'L1',
    cadence: '2 / week',
    owner: 'presenter',
    onboardedExternally: true,
    addedDaysAgo: 160,
    about: 'Virtual primary care for rural communities. Houston, Texas.',
    contact: { name: 'Marcus Lee', email: 'marcus.lee@bluefinhealth.example', title: 'Head of Communications' },
  },
  copperline: {
    name: 'Copperline Mining',
    website: 'copperlinemining.example',
    industry: 'Mining',
    tier: 'L3',
    cadence: '1 / week',
    owner: 'presenter',
    onboardedExternally: true,
    addedDaysAgo: 300,
    about: 'Copper producer with operations in Arizona and Nevada.',
    contact: { name: 'Alan Pierce', email: 'apierce@copperlinemining.example', title: 'VP, Investor Relations' },
  },
  harborview: {
    name: 'Harborview Capital',
    website: 'harborviewcap.example',
    industry: 'Asset management',
    tier: 'L2',
    cadence: '1 / week',
    owner: 'nora',
    onboardedExternally: true,
    addedDaysAgo: 420,
    about: 'Independent asset manager focused on fixed income. Boston.',
    contact: { name: 'Rachel Kim', email: 'rkim@harborviewcap.example', title: 'Marketing Director' },
  },
  meridian: {
    name: 'Meridian Robotics',
    website: 'meridianrobotics.example',
    industry: 'Industrial robotics',
    tier: 'L3',
    cadence: '2 / month',
    owner: 'nora',
    onboardedExternally: true,
    addedDaysAgo: 250,
    about: 'Collaborative robots for mid-size manufacturers. Pittsburgh.',
    contact: { name: 'Tom Alvarez', email: 'tom@meridianrobotics.example', title: 'Director of Communications' },
  },
  tidewater: {
    name: 'Tidewater Foods',
    website: 'tidewaterfoods.example',
    industry: 'Consumer packaged food',
    tier: 'L1',
    cadence: '1 / week',
    owner: 'theo',
    onboardedExternally: true,
    addedDaysAgo: 120,
    about: 'Plant-based seafood brand sold in 3,000 grocery stores.',
    contact: { name: 'Hannah Brooks', email: 'hannah@tidewaterfoods.example', title: 'Brand Manager' },
  },
  sable: {
    name: 'Sable & Finch',
    website: 'sableandfinch.example',
    industry: 'Apparel retail',
    tier: 'L2',
    cadence: '2 / month',
    owner: 'theo',
    onboardedExternally: true,
    addedDaysAgo: 95,
    about: 'Direct-to-consumer outerwear brand. Portland, Oregon.',
    contact: { name: 'Jordan Wells', email: 'jordan@sableandfinch.example', title: 'Founder' },
  },
  lumen: {
    name: 'Lumen Solar',
    website: 'lumensolar.example',
    industry: 'Clean energy',
    tier: 'L3',
    cadence: '1 / week',
    owner: 'iris',
    onboardedExternally: true,
    addedDaysAgo: 180,
    about: 'Community solar developer in the Southwest.',
    contact: { name: 'Elena Ruiz', email: 'eruiz@lumensolar.example', title: 'Communications Lead' },
  },
  quarry: {
    name: 'Quarry Lane Software',
    website: 'quarrylane.example',
    industry: 'Developer tools',
    tier: 'L1',
    cadence: '1 / week',
    owner: 'iris',
    onboardedExternally: true,
    addedDaysAgo: 75,
    about: 'Testing tools for mobile app teams.',
    contact: { name: 'Sam Okafor', email: 'sam@quarrylane.example', title: 'Head of Marketing' },
  },
  vantage: {
    name: 'Vantage Freight',
    website: 'vantagefreight.example',
    industry: 'Logistics',
    tier: 'L1',
    cadence: '1 / week',
    owner: 'nora',
    onboardedExternally: false,
    addedDaysAgo: 45,
    about: 'Regional freight brokerage for the Gulf Coast.',
    contact: { name: 'Chris Dunn', email: 'cdunn@vantagefreight.example', title: 'COO' },
  },
  oakridge: {
    name: 'Oakridge Dental Group',
    website: 'oakridgedental.example',
    industry: 'Healthcare services',
    tier: 'L2',
    cadence: '2 / month',
    owner: 'felix',
    onboardedExternally: false,
    addedDaysAgo: 12,
    about: 'Group of 22 dental practices across Georgia.',
    contact: { name: 'Dr. Lisa Chen', email: 'lchen@oakridgedental.example', title: 'Chief Clinical Officer' },
  },
  pinecrest: {
    name: 'Pinecrest Outdoor',
    website: 'pinecrestoutdoor.example',
    industry: 'Outdoor gear',
    tier: 'L3',
    cadence: '1 / week',
    owner: 'felix',
    onboardedExternally: false,
    addedDaysAgo: 2,
    about: 'Camping and hiking gear, sold online and in 40 stores.',
    contact: { name: 'Nate Holloway', email: 'nate@pinecrestoutdoor.example', title: 'VP, Marketing' },
  },
} satisfies Record<string, DemoClient>

export type ClientKey = keyof typeof CLIENTS

export interface DemoEmail {
  client: ClientKey | null
  from: { name: string; address: string }
  subject: string
  body: string
  hoursAgo: number
  label: EmailLabel
  confidence: number
  status: 'routed' | 'unmatched' | 'handled' | 'muted'
  classifiedBy: 'rule' | 'model'
  suggestedAction: string | null
  extracted?: {
    company_name?: string | null
    contact_name?: string | null
    contact_email?: string | null
    release_topic?: string | null
    requested_date_in_days?: number | null
    tier_hint?: Tier | null
  }
}

const contactOf = (key: ClientKey) => {
  const { name, email } = CLIENTS[key].contact
  return { name, address: email }
}

const accessNotification = (client: ClientKey, title: string, hoursAgo: number): DemoEmail => ({
  client,
  from: { name: 'ACCESS Newswire', address: 'notifications@accessnewswire.example' },
  subject: `Distributed: ${title}`,
  body: `Your release "${title}" for ${CLIENTS[client].name} has been distributed.\n\nView the distribution report in your ACCESS dashboard.`,
  hoursAgo,
  label: 'auto_notification',
  confidence: 1,
  status: 'muted',
  classifiedBy: 'rule',
  suggestedAction: null,
})

export const EMAILS = {
  // Release info that already became a release (each is a release's source).
  northwindRelease: {
    client: 'northwind',
    from: contactOf('northwind'),
    subject: 'Draft release: Pulse launch',
    body: [
      'Hi team,',
      '',
      "Here's our draft for the Pulse launch. We'd like it out by the end of next week. Can you give it an edit?",
      '',
      'Northwind Analytics Launches Pulse, Real-Time Anomaly Alerts for Retail Data Teams',
      '',
      'AUSTIN, Texas — Northwind Analytics, the leading provider of best-in-class data solutions, today announced the launch of Pulse, a revolutionary new feature that utilizes cutting-edge AI to alert retail data teams to anomalies in real time.',
      '',
      'Pulse monitors sales, inventory and pricing feeds continuously and flags unusual changes within 90 seconds. In a pilot with 14 regional retailers, teams caught pricing errors an average of six hours sooner.',
      '',
      '"We are very excited to announce Pulse," said Priya Raman, CEO of Northwind Analytics. "This is a game-changer for the industry."',
      '',
      'Thanks,',
      'Priya',
    ].join('\n'),
    hoursAgo: 26,
    label: 'release_info',
    confidence: 0.96,
    status: 'handled',
    classifiedBy: 'model',
    suggestedAction: 'Client sent a full draft. Start an L2 edit.',
    extracted: {
      company_name: 'Northwind Analytics',
      contact_name: 'Priya Raman',
      contact_email: 'priya@northwind-analytics.example',
      release_topic: 'Northwind launches Pulse real-time anomaly alerts',
      requested_date_in_days: 9,
    },
  },
  bluefinRelease: {
    client: 'bluefin',
    from: contactOf('bluefin'),
    subject: 'Rural expansion announcement',
    body: [
      'Hi all,',
      '',
      "We're expanding same-day virtual care to 40 rural counties through partnerships with county health districts. That covers about 310,000 residents. Our CEO Dr. Angela Morris is available for a quote.",
      '',
      "Can you write this one up for next week? Key point: patients see a clinician within hours instead of waiting weeks for an appointment.",
      '',
      'Marcus',
    ].join('\n'),
    hoursAgo: 30,
    label: 'release_info',
    confidence: 0.93,
    status: 'handled',
    classifiedBy: 'model',
    suggestedAction: 'Release request with the key facts. Start a release.',
    extracted: {
      company_name: 'Bluefin Health',
      contact_name: 'Marcus Lee',
      contact_email: 'marcus.lee@bluefinhealth.example',
      release_topic: 'Bluefin Health expands same-day virtual care to rural Texas',
      requested_date_in_days: 7,
    },
  },
  copperlineRelease: {
    client: 'copperline',
    from: contactOf('copperline'),
    subject: 'Q3 recovery results release',
    body: "Hi,\n\nOur water-recycling retrofit at the Gila Bend site lifted copper recovery 18% in Q3. We'd like a release on it before our investor call. Numbers and a quote from our CEO are below.\n\nAlan",
    hoursAgo: 120,
    label: 'release_info',
    confidence: 0.95,
    status: 'handled',
    classifiedBy: 'model',
    suggestedAction: 'Release request with results attached. Start a release.',
    extracted: {
      company_name: 'Copperline Mining',
      contact_name: 'Alan Pierce',
      release_topic: 'Copperline reports higher copper recovery after water-recycling retrofit',
      requested_date_in_days: 2,
    },
  },
  harborviewRelease: {
    client: 'harborview',
    from: contactOf('harborview'),
    subject: 'New CIO announcement — draft attached',
    body: [
      'Hello,',
      '',
      "Our draft for Dana's appointment is below. Please edit and send back.",
      '',
      'Harborview Capital is thrilled to announce that Dana Whitfield has joined the firm as Chief Investment Officer, effective immediately. Dana brings over 20 years of world-class experience in fixed income.',
      '',
      'Rachel',
    ].join('\n'),
    hoursAgo: 72,
    label: 'release_info',
    confidence: 0.94,
    status: 'handled',
    classifiedBy: 'model',
    suggestedAction: 'Client draft attached. Start an L2 edit.',
    extracted: {
      company_name: 'Harborview Capital',
      contact_name: 'Rachel Kim',
      release_topic: 'Harborview Capital names Dana Whitfield Chief Investment Officer',
      requested_date_in_days: 4,
    },
  },
  meridianRelease: {
    client: 'meridian',
    from: contactOf('meridian'),
    subject: 'Pittsburgh plant opening',
    body: "Hi team,\n\nWe're opening our new assembly plant in Pittsburgh on the 18th: 120 new jobs, ribbon cutting with the mayor's office. Can you draft a release?\n\nTom",
    hoursAgo: 96,
    label: 'release_info',
    confidence: 0.92,
    status: 'handled',
    classifiedBy: 'model',
    suggestedAction: 'Release request for a plant opening. Start a release.',
    extracted: {
      company_name: 'Meridian Robotics',
      contact_name: 'Tom Alvarez',
      release_topic: 'Meridian Robotics opens Pittsburgh assembly plant',
      requested_date_in_days: 6,
    },
  },
  lumenRelease: {
    client: 'lumen',
    from: contactOf('lumen'),
    subject: 'Brightwater partnership — release request',
    body: "Hi Iris,\n\nWe've signed with Brightwater Utility for a 50 MW community solar program in New Mexico. Subscribers save about 10% on their bills. Can we get a release out next week?\n\nElena",
    hoursAgo: 20,
    label: 'release_info',
    confidence: 0.95,
    status: 'handled',
    classifiedBy: 'model',
    suggestedAction: 'Release request. Start a release.',
    extracted: {
      company_name: 'Lumen Solar',
      contact_name: 'Elena Ruiz',
      release_topic: 'Lumen Solar and Brightwater Utility partner on 50 MW community solar',
      requested_date_in_days: 8,
    },
  },

  // Open release info, ready for Start release.
  tidewaterRelease: {
    client: 'tidewater',
    from: contactOf('tidewater'),
    subject: 'New product line — release next week?',
    body: "Hi Theo,\n\nWe're launching three new plant-based seafood products (crab cakes, shrimp and smoked salmon) in Kroger and Publix stores on the 10th. Could you write a release? Happy to get you a quote from our founder.\n\nHannah",
    hoursAgo: 0.7,
    label: 'release_info',
    confidence: 0.91,
    status: 'routed',
    classifiedBy: 'model',
    suggestedAction: 'New release request. Start a release; due in about a week.',
    extracted: {
      company_name: 'Tidewater Foods',
      contact_name: 'Hannah Brooks',
      contact_email: 'hannah@tidewaterfoods.example',
      release_topic: 'Tidewater Foods launches three plant-based seafood products',
      requested_date_in_days: 6,
    },
  },
  sableRelease: {
    client: 'sable',
    from: contactOf('sable'),
    subject: 'Our draft: recycled down jacket launch',
    body: [
      'Hey team,',
      '',
      "Draft below for the Re/Down launch. We'd love your edits by Thursday.",
      '',
      'Sable & Finch Unveils Re/Down, the World’s Most Sustainable Winter Jacket',
      '',
      'PORTLAND, Ore. — Sable & Finch today unveiled Re/Down, an incredibly warm winter jacket made with 100% recycled down recovered from post-consumer bedding.',
      '',
      'Jordan',
    ].join('\n'),
    hoursAgo: 3,
    label: 'release_info',
    confidence: 0.88,
    status: 'routed',
    classifiedBy: 'model',
    suggestedAction: 'Client sent a draft. Start an L2 edit.',
    extracted: {
      company_name: 'Sable & Finch',
      contact_name: 'Jordan Wells',
      release_topic: 'Sable & Finch launches Re/Down recycled down jacket',
      requested_date_in_days: 4,
    },
  },
  bluefinNext: {
    client: 'bluefin',
    from: contactOf('bluefin'),
    subject: 'Next one: Lone Star Clinics partnership',
    body: "Hi,\n\nNext up after the rural release: we're partnering with Lone Star Clinics to offer after-hours virtual visits to their 60,000 patients. Target date is two weeks out.\n\nMarcus",
    hoursAgo: 1.5,
    label: 'release_info',
    confidence: 0.9,
    status: 'routed',
    classifiedBy: 'model',
    suggestedAction: 'Second release request this week. Start a release when the first is approved.',
    extracted: {
      company_name: 'Bluefin Health',
      contact_name: 'Marcus Lee',
      release_topic: 'Bluefin Health partners with Lone Star Clinics on after-hours virtual visits',
      requested_date_in_days: 14,
    },
  },

  // Client updates and social.
  copperlineQuote: {
    client: 'copperline',
    from: contactOf('copperline'),
    subject: 'Updated CEO quote',
    body: "Hi,\n\nOur CEO would like to swap in this quote for future releases: \"Recycling water isn't just good stewardship. It's how we produce more copper from the same ore.\"\n\nAlan",
    hoursAgo: 5,
    label: 'client_update',
    confidence: 0.89,
    status: 'routed',
    classifiedBy: 'model',
    suggestedAction: 'Update the spokesperson quote for future Copperline releases.',
  },
  northwindSpokesperson: {
    client: 'northwind',
    from: contactOf('northwind'),
    subject: 'New media contact',
    body: 'Hi,\n\nGoing forward, please list Owen Park (owen@northwind-analytics.example) as the media contact on our releases.\n\nPriya',
    hoursAgo: 8,
    label: 'client_update',
    confidence: 0.92,
    status: 'routed',
    classifiedBy: 'model',
    suggestedAction: 'Change the media contact on Northwind releases to Owen Park.',
    extracted: { contact_name: 'Owen Park', contact_email: 'owen@northwind-analytics.example' },
  },
  harborviewUpdate: {
    client: 'harborview',
    from: contactOf('harborview'),
    subject: 'Compliance review timing',
    body: 'Hi Nora,\n\nOur compliance team needs 48 hours to review any release before it goes out. Please build that into the schedule.\n\nRachel',
    hoursAgo: 28,
    label: 'client_update',
    confidence: 0.9,
    status: 'routed',
    classifiedBy: 'model',
    suggestedAction: 'Note the 48-hour compliance review for Harborview releases.',
  },
  meridianFeedback: {
    client: 'meridian',
    from: contactOf('meridian'),
    subject: 'Re: Pittsburgh plant draft',
    body: 'Thanks for the draft. Two things: the plant is 85,000 sq ft, not 80,000, and please mention our apprenticeship program with the Community College of Allegheny County.\n\nTom',
    hoursAgo: 22,
    label: 'client_update',
    confidence: 0.87,
    status: 'routed',
    classifiedBy: 'model',
    suggestedAction: 'Client feedback on the Pittsburgh draft. Fold it into the next version.',
  },
  vantageTopics: {
    client: 'vantage',
    from: contactOf('vantage'),
    subject: 'Ideas for our first release',
    body: "Hi Nora,\n\nNow that the strategy's approved, here are a few ideas for the first release: our new Houston cross-dock, the 98% on-time rate we hit in Q3, or our driver safety award. Your call on which leads.\n\nChris",
    hoursAgo: 46,
    label: 'client_update',
    confidence: 0.84,
    status: 'routed',
    classifiedBy: 'model',
    suggestedAction: 'Pick the first release topic with the client.',
  },
  oakridgeMeeting: {
    client: 'oakridge',
    from: contactOf('oakridge'),
    subject: 'Confirming our kickoff meeting',
    body: "Hi Felix,\n\nConfirming Thursday at 2pm for the onboarding meeting. I'll bring our practice growth numbers.\n\nLisa",
    hoursAgo: 18,
    label: 'client_update',
    confidence: 0.9,
    status: 'routed',
    classifiedBy: 'model',
    suggestedAction: 'Meeting 1 confirmed for Thursday at 2pm.',
  },
  meridianSocial: {
    client: 'meridian',
    from: contactOf('meridian'),
    subject: 'LinkedIn post for the plant opening',
    body: "Could you draft a LinkedIn post to go with the plant opening release? Something short with a photo slot.\n\nTom",
    hoursAgo: 21,
    label: 'social',
    confidence: 0.86,
    status: 'routed',
    classifiedBy: 'model',
    suggestedAction: 'Social request tied to the Pittsburgh release.',
  },

  // Unmatched: below the confidence threshold or no known sender.
  unknownRelease: {
    client: null,
    from: { name: 'J. Ortiz', address: 'j.ortiz@mailbox.example' },
    subject: 'Release for next Tuesday?',
    body: "Hello,\n\nCan we get our announcement out next Tuesday? Details to follow from our team.\n\nThanks,\nJ. Ortiz",
    hoursAgo: 2,
    label: 'release_info',
    confidence: 0.52,
    status: 'unmatched',
    classifiedBy: 'model',
    suggestedAction: "Looks like a release request, but the sender isn't a known contact. Find out which client this is.",
    extracted: { contact_name: 'J. Ortiz', contact_email: 'j.ortiz@mailbox.example', requested_date_in_days: 7 },
  },
  lumenNewDomain: {
    client: null,
    from: { name: 'Dev Patel', address: 'dev@lumen-energy.example' },
    subject: 'Partnership announcement draft',
    body: "Hi,\n\nI'm the new partnerships lead at Lumen. Attaching notes for a release about our school district solar program. Who should I send these to?\n\nDev",
    hoursAgo: 4,
    label: 'release_info',
    confidence: 0.61,
    status: 'unmatched',
    classifiedBy: 'model',
    suggestedAction: 'Probably Lumen Solar from a new address. Assign it and remember the sender.',
    extracted: { company_name: 'Lumen', contact_name: 'Dev Patel', contact_email: 'dev@lumen-energy.example' },
  },
  gridpointHandoff: {
    client: null,
    from: { name: 'Rafael', address: 'rafael@newswire.example' },
    subject: 'New client: Gridpoint Energy (L2)',
    body: [
      'Hi team,',
      '',
      'Just closed Gridpoint Energy on the L2 package. They make battery storage for commercial buildings, based in Denver. Main contact is Maya Torres, VP Marketing (maya@gridpoint.example). They want to start with one release a week.',
      '',
      'Rafael',
    ].join('\n'),
    hoursAgo: 6,
    label: 'sales_handoff',
    confidence: 0.97,
    status: 'unmatched',
    classifiedBy: 'model',
    suggestedAction: 'New L2 client from sales. Create the client and assign an owner.',
    extracted: {
      company_name: 'Gridpoint Energy',
      contact_name: 'Maya Torres',
      contact_email: 'maya@gridpoint.example',
      tier_hint: 'L2',
    },
  },
  influencer: {
    client: null,
    from: { name: 'Trail Talk Media', address: 'collabs@trailtalk.example' },
    subject: 'Collab opportunity',
    body: "Hi! We run a hiking channel with 400K followers and would love to feature one of your outdoor brands. Let us know who to talk to.",
    hoursAgo: 10,
    label: 'social',
    confidence: 0.7,
    status: 'unmatched',
    classifiedBy: 'model',
    suggestedAction: 'Possible fit for Pinecrest Outdoor. Check with the owner.',
  },
  invoice: {
    client: null,
    from: { name: 'Accounts', address: 'ap@vendor.example' },
    subject: 'Invoice 4471',
    body: 'Please find invoice 4471 for October services. Payment is due in 30 days.',
    hoursAgo: 12,
    label: 'other',
    confidence: 0.44,
    status: 'unmatched',
    classifiedBy: 'model',
    suggestedAction: 'Not client work. Forward to billing.',
  },

  // Handled earlier.
  pinecrestHandoff: {
    client: 'pinecrest',
    from: { name: 'Rafael', address: 'rafael@newswire.example' },
    subject: 'New client: Pinecrest Outdoor (L3)',
    body: 'Hi team,\n\nPinecrest Outdoor signed for L3. Contact is Nate Holloway, VP Marketing. Felix, they asked for you.\n\nRafael',
    hoursAgo: 50,
    label: 'sales_handoff',
    confidence: 0.98,
    status: 'handled',
    classifiedBy: 'model',
    suggestedAction: 'New L3 client. Create the client.',
    extracted: { company_name: 'Pinecrest Outdoor', contact_name: 'Nate Holloway', tier_hint: 'L3' },
  },

  // ACCESS distribution notices (muted by rule).
  noticeCopperline: accessNotification('copperline', 'Copperline Expands Nevada Exploration Program', 170),
  noticeHarborview: accessNotification('harborview', 'Harborview Capital Launches Short-Duration Bond Fund', 150),
  noticeLumen: accessNotification('lumen', 'Lumen Solar Completes 20 MW Arizona Project', 100),
  noticeBluefin: accessNotification('bluefin', 'Bluefin Health Adds Behavioral Health Visits', 55),
  noticeQuarry: accessNotification('quarry', 'Quarry Lane Releases Device Cloud 3.0', 34),
} satisfies Record<string, DemoEmail>

export type EmailKey = keyof typeof EMAILS

export interface DemoVersion {
  origin: 'ai' | 'human' | 'mixed'
  /** Who saved a human or mixed version. */
  by?: MemberKey
  content: Record<string, unknown>
}

export interface DemoReview {
  action: 'submitted' | 'approved' | 'changes_requested'
  by: MemberKey
  /** 1-based index into the artifact's versions. */
  version: number
  hoursAgo: number
  comment?: string
}

export interface DemoArtifact {
  status: 'draft' | 'in_review' | 'approved'
  versions: DemoVersion[]
  reviews?: DemoReview[]
  /** The task that wrote AI versions (also the job type). */
  task: GenerationTask
}

export interface DemoRelease extends DemoArtifact {
  client: ClientKey
  title: string
  mode: 'write' | 'edit'
  dueInDays: number
  createdHoursAgo: number
  sourceEmail: EmailKey
}

/** `{date}` in a dateline becomes the release's due date when seeded. */
export const RELEASES: DemoRelease[] = [
  {
    client: 'northwind',
    title: 'Northwind launches Pulse real-time anomaly alerts',
    mode: 'edit',
    dueInDays: 9,
    createdHoursAgo: 25,
    sourceEmail: 'northwindRelease',
    task: 'release.edit',
    status: 'draft',
    versions: [
      {
        origin: 'ai',
        content: {
          sections: [
            {
              id: 'headline',
              heading: 'Headline',
              body: 'Northwind Analytics Launches Pulse, Real-Time Anomaly Alerts for Retail Data Teams',
            },
            {
              id: 'lede',
              heading: 'Opening',
              body: 'AUSTIN, Texas — Northwind Analytics, the leading provider of best-in-class data solutions, today announced the launch of Pulse, a revolutionary new feature that utilizes cutting-edge AI to alert retail data teams to anomalies in real time.',
            },
            {
              id: 'details',
              heading: 'Details',
              body: 'Pulse monitors sales, inventory and pricing feeds continuously and flags unusual changes within 90 seconds. In a pilot with 14 regional retailers, teams caught pricing errors an average of six hours sooner.',
            },
            {
              id: 'quote',
              heading: 'Quote',
              body: '"We are very excited to announce Pulse," said Priya Raman, CEO of Northwind Analytics. "This is a game-changer for the industry."',
            },
          ],
          suggested_edits: [
            {
              section_id: 'lede',
              original: 'the leading provider of best-in-class data solutions',
              suggestion: 'a retail analytics company',
              reason: 'Unsupported superlatives get releases skipped; the pilot results make the case better.',
            },
            {
              section_id: 'lede',
              original: 'a revolutionary new feature that utilizes cutting-edge AI to alert',
              suggestion: 'a feature that alerts',
              reason: 'Shorter and plainer. The next paragraph explains how it works.',
            },
            {
              section_id: 'details',
              original: 'In a pilot with 14 regional retailers',
              suggestion: 'In a three-month pilot with 14 regional retailers',
              reason: 'The pilot length makes the result easier to judge. Confirm the duration with Priya.',
            },
            {
              section_id: 'quote',
              original: '"We are very excited to announce Pulse," said Priya Raman, CEO of Northwind Analytics. "This is a game-changer for the industry."',
              suggestion: '"Retail teams were finding pricing mistakes the morning after they cost money," said Priya Raman, CEO of Northwind Analytics. "Pulse tells them while there\'s still time to fix it."',
              reason: 'The original quote could sit in any release. A concrete problem gives reporters something to use. Confirm the wording with Priya.',
            },
          ],
        },
      },
    ],
  },
  {
    client: 'bluefin',
    title: 'Bluefin Health expands same-day virtual care to rural Texas',
    mode: 'write',
    dueInDays: 7,
    createdHoursAgo: 29,
    sourceEmail: 'bluefinRelease',
    task: 'release.draft',
    status: 'draft',
    versions: [
      {
        origin: 'ai',
        content: {
          headline: 'Bluefin Health Brings Same-Day Virtual Care to 40 Rural Texas Counties',
          subheadline: 'Partnerships with county health districts give 310,000 residents a clinician within hours, not weeks',
          dateline: 'HOUSTON, Texas — {date}',
          sections: [
            {
              id: 'lede',
              heading: 'Opening',
              body: 'Bluefin Health today announced partnerships with health districts in 40 rural Texas counties to offer same-day virtual primary care to about 310,000 residents, many of whom now wait weeks for an appointment.',
            },
            {
              id: 'how',
              heading: 'How it works',
              body: 'Residents can book a video visit by phone or online and see a licensed clinician the same day. County clinics host private telehealth rooms for patients without reliable internet, and prescriptions go to local pharmacies.',
            },
            {
              id: 'quote',
              heading: 'Quote',
              body: '"Distance shouldn\'t decide whether you see a doctor this week or next month," said Dr. Angela Morris, CEO of Bluefin Health. "Working with the counties lets us meet patients where they already go for care."',
            },
            {
              id: 'availability',
              heading: 'Availability',
              body: 'Service begins in the first 12 counties this month, with the remaining counties added by spring. A list of participating counties is available at bluefinhealth.example/rural.',
            },
          ],
          boilerplate: 'Bluefin Health provides virtual primary care to rural communities across Texas. Founded in 2021, the company is based in Houston.',
        },
      },
    ],
  },
  {
    client: 'copperline',
    title: 'Copperline reports higher copper recovery after water-recycling retrofit',
    mode: 'write',
    dueInDays: 2,
    createdHoursAgo: 118,
    sourceEmail: 'copperlineRelease',
    task: 'release.draft',
    status: 'approved',
    versions: [
      {
        origin: 'ai',
        content: {
          headline: 'Copperline Mining Lifts Copper Recovery 18% at Arizona Site After Water-Recycling Retrofit',
          subheadline: null,
          dateline: 'PHOENIX, Ariz. — {date}',
          sections: [
            {
              id: 'lede',
              heading: 'Opening',
              body: 'Copperline Mining today reported an 18% increase in copper recovery at its Gila Bend operation in the third quarter, following a retrofit that recycles process water.',
            },
            {
              id: 'quote',
              heading: 'Quote',
              body: '"This retrofit paid for itself faster than we planned," said Copperline CEO Robert Haines.',
            },
          ],
          boilerplate: 'Copperline Mining produces copper from operations in Arizona and Nevada.',
        },
      },
      {
        origin: 'mixed',
        by: 'nora',
        content: {
          headline: 'Copperline Mining Lifts Copper Recovery 18% at Arizona Site After Water-Recycling Retrofit',
          subheadline: 'Retrofit cuts fresh water use by a third while raising output from the same ore',
          dateline: 'PHOENIX, Ariz. — {date}',
          sections: [
            {
              id: 'lede',
              heading: 'Opening',
              body: 'Copperline Mining today reported an 18% increase in copper recovery at its Gila Bend operation in the third quarter, following a retrofit that recycles process water and reduced the site\'s fresh water use by a third.',
            },
            {
              id: 'quote',
              heading: 'Quote',
              body: '"Recycling water isn\'t just good stewardship. It\'s how we produce more copper from the same ore," said Copperline CEO Robert Haines.',
            },
            {
              id: 'next',
              heading: "What's next",
              body: 'Copperline plans to bring the same system to its Nevada operations in 2027.',
            },
          ],
          boilerplate: 'Copperline Mining produces copper from operations in Arizona and Nevada. The company is headquartered in Phoenix.',
        },
      },
    ],
    reviews: [
      { action: 'submitted', by: 'theo', version: 2, hoursAgo: 30 },
      { action: 'approved', by: 'nora', version: 2, hoursAgo: 26, comment: 'Client signed off on the new quote.' },
    ],
  },
  {
    client: 'harborview',
    title: 'Harborview Capital names Dana Whitfield Chief Investment Officer',
    mode: 'edit',
    dueInDays: 4,
    createdHoursAgo: 70,
    sourceEmail: 'harborviewRelease',
    task: 'release.edit',
    status: 'in_review',
    versions: [
      {
        origin: 'ai',
        content: {
          sections: [
            {
              id: 'lede',
              heading: 'Opening',
              body: 'Harborview Capital is thrilled to announce that Dana Whitfield has joined the firm as Chief Investment Officer, effective immediately. Dana brings over 20 years of world-class experience in fixed income.',
            },
          ],
          suggested_edits: [
            {
              section_id: 'lede',
              original: 'Harborview Capital is thrilled to announce that Dana Whitfield has joined the firm',
              suggestion: 'Harborview Capital today named Dana Whitfield',
              reason: 'Leads with the news instead of the company’s feelings about it.',
            },
            {
              section_id: 'lede',
              original: 'over 20 years of world-class experience in fixed income',
              suggestion: 'more than 20 years in fixed income, most recently as head of credit at a Boston pension fund',
              reason: 'A specific prior role is more credible than "world-class". Confirm her last title with Rachel.',
            },
          ],
        },
      },
    ],
    reviews: [{ action: 'submitted', by: 'nora', version: 1, hoursAgo: 20 }],
  },
  {
    client: 'meridian',
    title: 'Meridian Robotics opens Pittsburgh assembly plant',
    mode: 'write',
    dueInDays: 6,
    createdHoursAgo: 94,
    sourceEmail: 'meridianRelease',
    task: 'release.draft',
    status: 'in_review',
    versions: [
      {
        origin: 'ai',
        content: {
          headline: 'Meridian Robotics Opens Pittsburgh Assembly Plant, Adding 120 Jobs',
          subheadline: null,
          dateline: 'PITTSBURGH — {date}',
          sections: [
            {
              id: 'lede',
              heading: 'Opening',
              body: 'Meridian Robotics today opened an 80,000-square-foot assembly plant in Pittsburgh, adding 120 jobs.',
            },
          ],
          boilerplate: 'Meridian Robotics builds collaborative robots for mid-size manufacturers.',
        },
      },
      {
        origin: 'mixed',
        by: 'nora',
        content: {
          headline: 'Meridian Robotics Opens Pittsburgh Assembly Plant, Adding 120 Jobs',
          subheadline: 'New apprenticeship program with the Community College of Allegheny County will train local technicians',
          dateline: 'PITTSBURGH — {date}',
          sections: [
            {
              id: 'lede',
              heading: 'Opening',
              body: 'Meridian Robotics today opened an 85,000-square-foot assembly plant in Pittsburgh, adding 120 jobs and doubling its production capacity for collaborative robots.',
            },
            {
              id: 'apprenticeship',
              heading: 'Apprenticeships',
              body: 'The company is launching a paid apprenticeship program with the Community College of Allegheny County, which will train 30 robotics technicians a year.',
            },
            {
              id: 'quote',
              heading: 'Quote',
              body: '"Pittsburgh has the engineering talent we need, and this program grows more of it," said Meridian CEO Karen Liu.',
            },
          ],
          boilerplate: 'Meridian Robotics builds collaborative robots for mid-size manufacturers. The company is based in Pittsburgh.',
        },
      },
    ],
    reviews: [
      { action: 'submitted', by: 'nora', version: 1, hoursAgo: 60 },
      {
        action: 'changes_requested',
        by: 'iris',
        version: 1,
        hoursAgo: 40,
        comment: 'Square footage is wrong (85,000) and the apprenticeship program is missing.',
      },
      { action: 'submitted', by: 'nora', version: 2, hoursAgo: 19 },
    ],
  },
  {
    client: 'lumen',
    title: 'Lumen Solar and Brightwater Utility partner on 50 MW community solar',
    mode: 'write',
    dueInDays: 8,
    createdHoursAgo: 19,
    sourceEmail: 'lumenRelease',
    task: 'release.draft',
    status: 'draft',
    versions: [
      {
        origin: 'ai',
        content: {
          headline: 'Lumen Solar and Brightwater Utility Launch 50 MW Community Solar Program in New Mexico',
          subheadline: 'Subscribers can cut their electric bills by about 10% without installing panels',
          dateline: 'ALBUQUERQUE, N.M. — {date}',
          sections: [
            {
              id: 'lede',
              heading: 'Opening',
              body: 'Lumen Solar and Brightwater Utility today announced a 50-megawatt community solar program that lets New Mexico households and small businesses subscribe to solar power and save about 10% on their electric bills.',
            },
            {
              id: 'details',
              heading: 'Details',
              body: 'The program will be built across three sites near Albuquerque and Las Cruces, with 30% of capacity reserved for low-income households. Enrollment opens in the spring.',
            },
            {
              id: 'quote',
              heading: 'Quote',
              body: '"Most people can\'t put panels on their roof. Community solar gives them the savings anyway," said Elena Ruiz of Lumen Solar.',
            },
          ],
          boilerplate: 'Lumen Solar develops community solar projects across the Southwest.',
        },
      },
    ],
  },
]

export interface DemoOnboarding extends DemoArtifact {
  client: ClientKey
  type: 'research' | 'onboarding_deck' | 'strategy'
  createdDaysAgo: number
}

const research = (name: string, site: string, competitors: [string, string][]) => ({
  sections: [
    {
      id: 'company',
      heading: 'Company',
      body: `${name} at a glance: products, customers, leadership and recent news, from its website and coverage over the last two years.`,
      source_urls: [`https://${site}/about`],
    },
    {
      id: 'coverage',
      heading: 'Coverage so far',
      body: 'Mostly trade press and local business journals; little national coverage. Product launches get picked up, executive news mostly does not.',
      source_urls: [`https://${site}/news`],
    },
  ],
  competitors: competitors.map(([competitor, gap]) => ({
    name: competitor,
    what: 'Direct competitor in the same market.',
    press: 'Regular trade coverage and occasional national pieces.',
    gap,
  })),
  open_questions: [
    'Which announcements are coming in the next six months?',
    'Who can speak to reporters, and on what topics?',
    'Which outlets matter most to your customers?',
  ],
})

const deck = (name: string) => ({
  sections: [
    { id: 'slide-1', heading: `${name} × ACCESS PR`, body: 'Onboarding overview', speaker_notes: 'Introductions and agenda.' },
    { id: 'slide-2', heading: 'What we found', body: 'Strengths, gaps and openings from the research.', speaker_notes: 'Walk through the research highlights.' },
    { id: 'slide-3', heading: 'How we work', body: 'Release cadence, review steps and reporting.', speaker_notes: 'Set expectations on turnaround and approvals.' },
  ],
})

export const ONBOARDING: DemoOnboarding[] = [
  {
    client: 'pinecrest',
    type: 'research',
    createdDaysAgo: 2,
    task: 'research.run',
    status: 'draft',
    versions: [
      {
        origin: 'ai',
        content: research('Pinecrest Outdoor', 'pinecrestoutdoor.example', [
          ['Summit Supply Co.', 'No sustainability story in the press.'],
          ['Ridgeway Gear', 'Little regional or local coverage.'],
        ]),
      },
    ],
  },
  {
    client: 'oakridge',
    type: 'research',
    createdDaysAgo: 11,
    task: 'research.run',
    status: 'approved',
    versions: [
      {
        origin: 'ai',
        content: research('Oakridge Dental Group', 'oakridgedental.example', [
          ['Peachtree Smiles', 'No patient-access angle in coverage.'],
        ]),
      },
    ],
    reviews: [{ action: 'approved', by: 'felix', version: 1, hoursAgo: 220 }],
  },
  {
    client: 'oakridge',
    type: 'onboarding_deck',
    createdDaysAgo: 8,
    task: 'onboarding.generate',
    status: 'in_review',
    versions: [{ origin: 'ai', content: deck('Oakridge Dental Group') }],
    reviews: [{ action: 'submitted', by: 'felix', version: 1, hoursAgo: 30 }],
  },
  {
    client: 'vantage',
    type: 'research',
    createdDaysAgo: 44,
    task: 'research.run',
    status: 'approved',
    versions: [
      {
        origin: 'ai',
        content: research('Vantage Freight', 'vantagefreight.example', [['Gulfline Logistics', 'No safety record in the press.']]),
      },
    ],
    reviews: [{ action: 'approved', by: 'nora', version: 1, hoursAgo: 1000 }],
  },
  {
    client: 'vantage',
    type: 'onboarding_deck',
    createdDaysAgo: 40,
    task: 'onboarding.generate',
    status: 'approved',
    versions: [{ origin: 'ai', content: deck('Vantage Freight') }],
    reviews: [{ action: 'approved', by: 'nora', version: 1, hoursAgo: 900 }],
  },
  {
    client: 'vantage',
    type: 'strategy',
    createdDaysAgo: 25,
    task: 'strategy.phase',
    status: 'approved',
    versions: [
      {
        origin: 'ai',
        content: {
          sections: [
            {
              id: 'summary',
              heading: 'Summary',
              body: 'Six months to make Vantage the name Gulf Coast shippers know for on-time freight, starting with trade press and regional business media.',
            },
          ],
          phases: [
            {
              name: 'Establish',
              months: 'Months 1–2',
              goals: ['First coverage in regional business press'],
              tactics: ['Houston cross-dock opening release', 'Q3 on-time results'],
            },
            {
              name: 'Expand',
              months: 'Months 3–6',
              goals: ['Trade press features', 'COO as a quoted source'],
              tactics: ['Driver safety program story', 'Hurricane-season readiness piece'],
            },
          ],
          roadmap: [
            { month: 'Month 1', item: 'Houston cross-dock opening', pillar: 'Growth' },
            { month: 'Month 2', item: 'Q3 on-time performance', pillar: 'Reliability' },
            { month: 'Month 3', item: 'Driver safety award', pillar: 'Safety' },
          ],
          angle_bank: [
            { angle: 'On-time freight in hurricane season', hook: 'Storm-season planning', pillar: 'Reliability' },
            { angle: 'Hiring drivers in a tight market', hook: 'Labor shortage coverage', pillar: 'Growth' },
          ],
        },
      },
      {
        origin: 'mixed',
        by: 'nora',
        content: {
          sections: [
            {
              id: 'summary',
              heading: 'Summary',
              body: 'Six months to make Vantage the name Gulf Coast shippers know for on-time freight. We start with trade press and regional business media, then build Chris Dunn up as a source on hurricane-season logistics.',
            },
          ],
          phases: [
            {
              name: 'Establish',
              months: 'Months 1–2',
              goals: ['First coverage in regional business press'],
              tactics: ['Houston cross-dock opening release', 'Q3 on-time results'],
            },
            {
              name: 'Expand',
              months: 'Months 3–6',
              goals: ['Trade press features', 'COO as a quoted source'],
              tactics: ['Driver safety program story', 'Hurricane-season readiness piece'],
            },
          ],
          roadmap: [
            { month: 'Month 1', item: 'Houston cross-dock opening', pillar: 'Growth' },
            { month: 'Month 2', item: 'Q3 on-time performance', pillar: 'Reliability' },
            { month: 'Month 3', item: 'Driver safety award', pillar: 'Safety' },
          ],
          angle_bank: [
            { angle: 'On-time freight in hurricane season', hook: 'Storm-season planning', pillar: 'Reliability' },
            { angle: 'Hiring drivers in a tight market', hook: 'Labor shortage coverage', pillar: 'Growth' },
          ],
        },
      },
    ],
    reviews: [
      { action: 'submitted', by: 'nora', version: 2, hoursAgo: 300 },
      { action: 'approved', by: 'theo', version: 2, hoursAgo: 250, comment: 'Approved after Meeting 2.' },
    ],
  },
]

export interface DemoMeeting {
  client: ClientKey
  kind: 'meeting_1' | 'meeting_2'
  /** Scheduled meetings that haven't happened. */
  scheduledInDays?: number
  heldDaysAgo?: number
  notes?: string
}

export const MEETINGS: DemoMeeting[] = [
  { client: 'oakridge', kind: 'meeting_1', scheduledInDays: 3 },
  { client: 'vantage', kind: 'meeting_1', heldDaysAgo: 35, notes: 'Liked the safety angle; wants the cross-dock opening first.' },
  { client: 'vantage', kind: 'meeting_2', heldDaysAgo: 11, notes: 'Strategy approved with the hurricane-season angle added.' },
]

export interface DemoDocument {
  client: ClientKey
  title: string
  filename: string
  mime: string
  sizeBytes: number
  daysAgo: number
  /** Indexed text, one chunk per entry. Failed documents have none. */
  chunks: string[]
  error?: string
}

const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export const DOCUMENTS: DemoDocument[] = [
  {
    client: 'northwind',
    title: 'Northwind brand and messaging guide',
    filename: 'northwind-messaging-2026.pdf',
    mime: PDF,
    sizeBytes: 1_240_000,
    daysAgo: 200,
    chunks: [
      'Northwind Analytics messaging: we help retail data teams catch problems while there is still time to fix them. Avoid "AI-powered" in headlines; lead with the outcome for the retailer.',
      'Spokespeople: Priya Raman, CEO (product vision, retail trends). Owen Park, media contact. Boilerplate: Northwind Analytics helps retail teams turn operational data into decisions.',
    ],
  },
  {
    client: 'northwind',
    title: 'Pulse pilot results',
    filename: 'pulse-pilot-results.docx',
    mime: DOCX,
    sizeBytes: 86_000,
    daysAgo: 3,
    chunks: [
      'Pulse pilot: 14 regional retailers over three months. Median time to detect pricing errors fell from 7.5 hours to 1.5 hours. Two retailers caught inventory feed outages within minutes.',
    ],
  },
  {
    client: 'bluefin',
    title: 'Rural care program fact sheet',
    filename: 'bluefin-rural-fact-sheet.pdf',
    mime: PDF,
    sizeBytes: 410_000,
    daysAgo: 6,
    chunks: [
      'Bluefin rural program: 40 counties, about 310,000 residents. Same-day video visits; county clinics provide private telehealth rooms. First 12 counties launch this month, the rest by spring.',
    ],
  },
  {
    client: 'copperline',
    title: 'Copperline six-month strategy (2026)',
    filename: 'copperline-strategy-2026.docx',
    mime: DOCX,
    sizeBytes: 220_000,
    daysAgo: 280,
    chunks: [
      'Copperline strategy pillars: operational efficiency, water stewardship, Nevada growth. Target outlets: mining trade press, Arizona business journals, financial wires ahead of investor calls.',
    ],
  },
  {
    client: 'meridian',
    title: 'Pittsburgh plant fact sheet',
    filename: 'meridian-pittsburgh-plant.pdf',
    mime: PDF,
    sizeBytes: 530_000,
    daysAgo: 4,
    chunks: [
      'Pittsburgh plant: 85,000 square feet, 120 jobs, doubles collaborative robot production. Apprenticeship program with the Community College of Allegheny County trains 30 technicians a year.',
    ],
  },
  {
    client: 'lumen',
    title: 'Brightwater term sheet (scanned)',
    filename: 'brightwater-term-sheet-scan.pdf',
    mime: PDF,
    sizeBytes: 3_900_000,
    daysAgo: 1,
    chunks: [],
    error: 'No text found: this PDF looks like a scanned image.',
  },
  {
    client: 'vantage',
    title: 'Vantage Freight six-month strategy',
    filename: 'vantage-strategy.docx',
    mime: DOCX,
    sizeBytes: 140_000,
    daysAgo: 24,
    chunks: [
      'Vantage strategy: establish regional business press coverage in months 1–2 with the Houston cross-dock opening and Q3 on-time results, then build the COO as a source on hurricane-season logistics.',
    ],
  },
]
