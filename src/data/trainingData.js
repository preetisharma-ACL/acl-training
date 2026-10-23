// ─── Training & Assessment — SAMPLE content ─────────────────────────────────
// Frontend-only until the backend team ships the training endpoints. Each
// department has a guide (sections of paragraphs + bullet points) and a
// question bank whose every question is answerable from that guide.
//
// This file stands in for the API: services/training.js is the only reader, so
// replacing the content (or the whole file) with real endpoints touches nothing
// else. The copy below is generic best-practice placeholder text — department
// heads should replace it with their own material.
//
// Shape (mirror this in the API so the UI needs no changes):
//   department: { id, name, description, durationMinutes, passPercent,
//                 marksPerQuestion, guide: { intro, sections[] }, questions[] }
//   section:    { id, title, body: string[], points?: string[], tip?: string }
//   question:   { id, text, options: [4 strings], answer: index 0-3 }

const ALL_DEPARTMENTS = [
  {
    id: "operation",
    name: "Operation (Campaign Management)",
    description: "Running and optimising Meta lead-generation campaigns for clients.",
    durationMinutes: 10,
    passPercent: 70,
    marksPerQuestion: 1,
    guide: {
      intro:
        "This guide covers how we structure, launch, monitor and report on Meta lead-generation campaigns. Read every section — the assessment is drawn from it.",
      sections: [
        {
          id: "structure",
          title: "Campaign structure",
          body: [
            "Every Meta campaign has three levels: the campaign (objective), the ad set (audience, budget, schedule, placements) and the ad (creative and copy).",
            "We name campaigns with the client nomen first, then the project and the date, so anyone on the team can find a campaign from the dashboard without opening Ads Manager.",
          ],
          points: [
            "Campaign level → objective (we use Leads for lead-gen clients).",
            "Ad set level → audience, budget, schedule and placements.",
            "Ad level → creative, primary text, headline and the lead form.",
          ],
        },
        {
          id: "budget",
          title: "Budgets and spend control",
          body: [
            "Daily budgets are set within the client's allowed budget. Raising a budget above the allowed limit needs approval — the Budget Guard pauses campaigns that cross it.",
            "Never raise a budget by more than 20% in a single change on a campaign that is performing well; large jumps send the ad set back into the learning phase.",
          ],
          tip: "Check the Allowed Budget screen before any budget change.",
        },
        {
          id: "metrics",
          title: "Key metrics",
          body: [
            "CPL (cost per lead) is spend divided by the number of leads. It is the primary metric our clients judge us on.",
            "CTR (click-through rate) is clicks divided by impressions. A falling CTR with stable reach is the earliest sign of creative fatigue.",
            "Frequency is the average number of times one person has seen the ad. When frequency climbs above 3 on a cold audience, rotate the creative.",
          ],
          points: [
            "CPL = Spend ÷ Leads",
            "CTR = Clicks ÷ Impressions",
            "Frequency > 3 on a cold audience → refresh creative",
          ],
        },
        {
          id: "learning",
          title: "The learning phase",
          body: [
            "A new or significantly edited ad set enters the learning phase while Meta's delivery system explores who converts. It needs roughly 50 optimisation events in 7 days to exit.",
            "Avoid editing ad sets during learning. Significant edits — budget, audience, creative or bid changes — restart it.",
          ],
        },
        {
          id: "reporting",
          title: "Daily reporting and alerts",
          body: [
            "Submit the Daily Report before end of day for every client you manage. It records spend, leads, CPL and any action you took.",
            "Act on dashboard alerts the same day. An unanswered alert on a suspended ad account or a payment failure can stop delivery for every campaign in that account.",
          ],
          tip: "If a client's CPL rises more than 30% day-on-day, note the reason in the Daily Report.",
        },
      ],
    },
    questions: [
      { id: "cm1", text: "At which level of a Meta campaign is the audience defined?", options: ["Campaign", "Ad set", "Ad", "Ad account"], answer: 1 },
      { id: "cm2", text: "How is CPL calculated?", options: ["Leads ÷ Spend", "Clicks ÷ Impressions", "Spend ÷ Leads", "Spend ÷ Clicks"], answer: 2 },
      { id: "cm3", text: "What is the maximum single budget increase recommended on a well-performing campaign?", options: ["10%", "20%", "50%", "100%"], answer: 1 },
      { id: "cm4", text: "What happens when a campaign crosses the client's allowed budget?", options: ["Nothing until month end", "The client is billed extra automatically", "Budget Guard pauses it", "Meta deletes the ad set"], answer: 2 },
      { id: "cm5", text: "Roughly how many optimisation events does an ad set need to exit the learning phase?", options: ["10 in 7 days", "50 in 7 days", "100 in 30 days", "500 in 14 days"], answer: 1 },
      { id: "cm6", text: "On a cold audience, frequency above which value suggests refreshing the creative?", options: ["1", "2", "3", "10"], answer: 2 },
      { id: "cm7", text: "Which of these is the earliest sign of creative fatigue?", options: ["Falling CTR with stable reach", "Rising budget", "More placements", "A new lead form"], answer: 0 },
      { id: "cm8", text: "Which change restarts the learning phase?", options: ["Renaming the campaign", "Downloading a report", "A significant audience change", "Viewing the ad preview"], answer: 2 },
      { id: "cm9", text: "When must the Daily Report be submitted?", options: ["Weekly on Monday", "Before end of day", "Only when CPL rises", "At month end"], answer: 1 },
      { id: "cm10", text: "What should come first in a campaign name?", options: ["The date", "The CM's name", "The client nomen", "The objective"], answer: 2 },
    ],
  },
  {
    id: "coordination",
    name: "Coordination",
    description: "Client communication, onboarding hand-offs and delivery follow-ups.",
    durationMinutes: 10,
    passPercent: 70,
    marksPerQuestion: 1,
    guide: {
      intro:
        "Coordination is the link between clients and the internal teams. This guide covers onboarding, follow-ups, escalation and record keeping.",
      sections: [
        {
          id: "onboarding",
          title: "Client onboarding",
          body: [
            "A client is onboarded through the Onboarding Wizard. The wizard captures the client's details, projects, billing model and the assigned campaign manager.",
            "A campaign should not go live until the onboarding record is complete and the advance payment is confirmed by Accounts.",
          ],
          points: [
            "Complete every step of the Onboarding Wizard.",
            "Confirm the assigned campaign manager.",
            "Wait for Accounts to confirm the advance payment before launch.",
          ],
        },
        {
          id: "followups",
          title: "Follow-ups",
          body: [
            "Every client gets a check-in at least once a week. Log the call or message in the Follow Up screen on the same day.",
            "When a client raises a lead-quality complaint, record it and share the lead IDs with the campaign manager within 24 hours.",
          ],
        },
        {
          id: "escalation",
          title: "Escalation",
          body: [
            "Escalate to the team lead when a client threatens to pause, when delivery has been stopped for more than 24 hours, or when a payment is overdue by more than 7 days.",
            "Always escalate with facts: the client, the issue, what was already tried and what you need.",
          ],
          tip: "An escalation without the client nomen and the issue in the first line will be sent back.",
        },
        {
          id: "records",
          title: "Record keeping",
          body: [
            "The dashboard is the single source of truth. Agreements made on calls or chat must be written into the client record the same day.",
            "Never share another client's data, leads or spend with a client.",
          ],
        },
      ],
    },
    questions: [
      { id: "co1", text: "Which tool is used to onboard a new client?", options: ["Daily Report", "Onboarding Wizard", "Activity Log", "Creative Library"], answer: 1 },
      { id: "co2", text: "Before a campaign goes live, who must confirm the advance payment?", options: ["Sales", "Creative", "Accounts", "The client's bank"], answer: 2 },
      { id: "co3", text: "How often should every client get a check-in at minimum?", options: ["Daily", "Once a week", "Once a month", "Only when they call"], answer: 1 },
      { id: "co4", text: "Within how long should lead IDs from a quality complaint reach the CM?", options: ["24 hours", "3 days", "1 week", "At month end"], answer: 0 },
      { id: "co5", text: "A payment overdue by more than how many days should be escalated?", options: ["1", "3", "7", "30"], answer: 2 },
      { id: "co6", text: "What is the single source of truth for client agreements?", options: ["Personal chat history", "The dashboard", "Email drafts", "Memory of the call"], answer: 1 },
      { id: "co7", text: "Which of these must appear in the first line of an escalation?", options: ["Your shift timing", "The client nomen and the issue", "A greeting", "The ad account ID only"], answer: 1 },
      { id: "co8", text: "Delivery stopped for more than how long requires escalation?", options: ["1 hour", "24 hours", "3 days", "1 week"], answer: 1 },
      { id: "co9", text: "Where is a client check-in logged?", options: ["Follow Up screen", "Budget Guard", "Payments Desk", "Creative Ranking"], answer: 0 },
      { id: "co10", text: "Is it acceptable to share another client's spend with a client?", options: ["Yes, if they ask", "Yes, for benchmarks", "Only with the team lead's approval", "Never"], answer: 3 },
    ],
  },
  {
    id: "account",
    name: "Account",
    description: "Payments, billing, ad-account funding and documentation.",
    durationMinutes: 10,
    passPercent: 70,
    marksPerQuestion: 1,
    guide: {
      intro:
        "Accounts keeps client money and ad-account funding correct and documented. This guide covers recording payments, documentation and funding.",
      sections: [
        {
          id: "recording",
          title: "Recording payments",
          body: [
            "Every payment received is recorded on the Payments Desk with the client, amount, date, mode and reference number.",
            "A payment has two separate states: its settlement status (has the money arrived?) and its documentation status (is the paperwork complete?). Update both independently.",
          ],
          points: [
            "Settlement status → has the money arrived?",
            "Documentation status → are invoice and proof attached?",
          ],
        },
        {
          id: "docs",
          title: "Documentation",
          body: [
            "Payments missing an invoice or proof appear in the Needs Docs queue. Clear the queue daily.",
            "Never mark documentation complete without the invoice and the payment proof both attached.",
          ],
        },
        {
          id: "funding",
          title: "Ad-account funding",
          body: [
            "Ad accounts are funded only against a confirmed client balance. Funding without balance creates a receivable we may never recover.",
            "Record every top-up in Funds Added on the day it is made, with the ad account and amount.",
          ],
          tip: "If an ad account is suspended for a payment failure, inform the campaign manager immediately.",
        },
        {
          id: "billing",
          title: "Billing models",
          body: [
            "Clients are billed either on spend plus a markup, or on a fixed CPL per billable lead. Billable leads are generated leads minus replaced and uncovered leads.",
          ],
          points: ["Billable leads = Generated − Replaced − Uncovered"],
        },
      ],
    },
    questions: [
      { id: "ac1", text: "Where is a received payment recorded?", options: ["Payments Desk", "Creative Library", "Daily Report", "Follow Up"], answer: 0 },
      { id: "ac2", text: "Settlement status answers which question?", options: ["Is the invoice attached?", "Has the money arrived?", "Was the client called?", "Is the ad live?"], answer: 1 },
      { id: "ac3", text: "Which queue shows payments missing an invoice or proof?", options: ["Budget Guard", "Needs Docs", "Alerts", "Activity Log"], answer: 1 },
      { id: "ac4", text: "How often should the Needs Docs queue be cleared?", options: ["Daily", "Weekly", "Monthly", "Quarterly"], answer: 0 },
      { id: "ac5", text: "Documentation can be marked complete when…", options: ["The invoice alone is attached", "The proof alone is attached", "Both invoice and proof are attached", "The client confirms by phone"], answer: 2 },
      { id: "ac6", text: "Ad accounts should be funded only against…", options: ["A verbal promise", "A confirmed client balance", "Last month's spend", "The CM's request alone"], answer: 1 },
      { id: "ac7", text: "When should a top-up be recorded in Funds Added?", options: ["The same day", "At week end", "At month end", "Only if asked"], answer: 0 },
      { id: "ac8", text: "How are billable leads calculated?", options: ["Generated + Replaced", "Generated − Replaced − Uncovered", "Generated × CPL", "Replaced − Uncovered"], answer: 1 },
      { id: "ac9", text: "Who must be informed when an ad account is suspended for payment failure?", options: ["The creative team", "The campaign manager", "Nobody", "Sales only"], answer: 1 },
      { id: "ac10", text: "Settlement and documentation statuses are…", options: ["The same field", "Updated together always", "Independent of each other", "Only for retainer clients"], answer: 2 },
    ],
  },
  {
    id: "sales",
    name: "Sales",
    description: "Prospecting, pitching and onboarding new clients.",
    durationMinutes: 10,
    passPercent: 70,
    marksPerQuestion: 1,
    guide: {
      intro:
        "Sales brings in clients who are a good fit for performance marketing. This guide covers qualification, pitching, commitments and hand-off.",
      sections: [
        {
          id: "qualify",
          title: "Qualifying a prospect",
          body: [
            "A qualified prospect has a clear product to sell, a monthly budget that meets our minimum, and someone who can approve spend.",
            "Ask about their past advertising: what worked, what did not, and what CPL they consider acceptable.",
          ],
          points: ["Clear product", "Budget at or above minimum", "A decision-maker in the conversation"],
        },
        {
          id: "pitch",
          title: "Pitching",
          body: [
            "Lead with outcomes the client cares about — qualified leads at a predictable cost — and support it with case studies from similar clients.",
            "Never promise a fixed number of leads or a guaranteed CPL. Share past ranges and explain what drives them.",
          ],
          tip: "Promises you can't keep become escalations for Coordination.",
        },
        {
          id: "handoff",
          title: "Hand-off",
          body: [
            "Once the client agrees, start the Onboarding Wizard and capture the billing model, projects and expectations exactly as agreed.",
            "Introduce the client to their coordinator within 2 working days of signing.",
          ],
        },
      ],
    },
    questions: [
      { id: "sa1", text: "Which is NOT a criterion for a qualified prospect?", options: ["A clear product", "Budget at or above minimum", "A decision-maker present", "An existing Meta page with 10k followers"], answer: 3 },
      { id: "sa2", text: "What should a pitch lead with?", options: ["Our team size", "Outcomes the client cares about", "Discounts", "Competitor flaws"], answer: 1 },
      { id: "sa3", text: "Is it acceptable to guarantee a fixed CPL?", options: ["Yes, always", "Only for large budgets", "No — share past ranges instead", "Yes, if the client insists"], answer: 2 },
      { id: "sa4", text: "What should you ask about a prospect's past advertising?", options: ["What worked and what didn't", "Their office address", "Their competitors' budgets", "Nothing"], answer: 0 },
      { id: "sa5", text: "Which tool starts the client hand-off?", options: ["Budget Guard", "Onboarding Wizard", "Creative Ranking", "Activity Log"], answer: 1 },
      { id: "sa6", text: "Within how long should a new client meet their coordinator?", options: ["Same day", "2 working days", "2 weeks", "At first invoice"], answer: 1 },
      { id: "sa7", text: "What best supports a pitch?", options: ["Case studies from similar clients", "Guaranteed lead numbers", "Long technical jargon", "Pricing pressure"], answer: 0 },
      { id: "sa8", text: "Unkept sales promises usually become…", options: ["Bonuses", "Escalations for Coordination", "New campaigns", "Creative briefs"], answer: 1 },
    ],
  },
  {
    id: "content",
    name: "Content",
    description: "Ad creatives, copy, content formats and the creative library.",
    durationMinutes: 8,
    passPercent: 70,
    marksPerQuestion: 1,
    guide: {
      intro:
        "Creative produces the ads our campaigns run. This guide covers formats, copy rules, policy and how we use performance data.",
      sections: [
        {
          id: "formats",
          title: "Formats and sizes",
          body: [
            "Deliver every creative in 1:1 (feed) and 9:16 (stories and reels). Keep key text inside the central safe zone so it is not covered by interface elements.",
          ],
          points: ["1:1 → Feed", "9:16 → Stories & Reels", "Key text in the safe zone"],
        },
        {
          id: "copy",
          title: "Copy",
          body: [
            "The first line of primary text must carry the hook — most users never tap 'See more'.",
            "Use one clear call to action per ad.",
          ],
        },
        {
          id: "policy",
          title: "Ad policy",
          body: [
            "Avoid claims that imply knowledge of the viewer's personal attributes (for example, 'Are you in debt?'). Meta rejects these.",
            "Do not use before/after imagery for health or weight-related offers.",
          ],
          tip: "A rejected ad delays the whole campaign — check policy before upload.",
        },
        {
          id: "library",
          title: "Creative Library and ranking",
          body: [
            "Upload every final creative to the Creative Library with the client and project tags so performance can be tracked.",
            "Use Creative Ranking to see which creatives deliver the lowest CPL, and brief new variations from the winners.",
          ],
        },
      ],
    },
    questions: [
      { id: "cr1", text: "Which aspect ratio is used for Stories and Reels?", options: ["1:1", "4:5", "16:9", "9:16"], answer: 3 },
      { id: "cr2", text: "Where should the hook appear in primary text?", options: ["The last line", "The first line", "In the hashtags", "Only in the image"], answer: 1 },
      { id: "cr3", text: "How many calls to action should an ad have?", options: ["One", "Two", "Three", "As many as possible"], answer: 0 },
      { id: "cr4", text: "Which copy is likely to be rejected by Meta?", options: ["'Book a site visit today'", "'Are you in debt?'", "'New launch in Pune'", "'Limited units available'"], answer: 1 },
      { id: "cr5", text: "Before/after imagery should be avoided for…", options: ["Real estate", "Health and weight offers", "Education", "Automobiles"], answer: 1 },
      { id: "cr6", text: "Why must creatives be tagged in the Creative Library?", options: ["For file backup only", "So performance can be tracked", "To reduce file size", "It is optional"], answer: 1 },
      { id: "cr7", text: "Which screen shows creatives with the lowest CPL?", options: ["Creative Ranking", "Payments Desk", "Follow Up", "Budget Guard"], answer: 0 },
      { id: "cr8", text: "Key text should be kept…", options: ["At the very top edge", "Inside the central safe zone", "At the bottom edge", "Outside the frame"], answer: 1 },
    ],
  },
  {
    id: "seo",
    name: "SEO",
    description: "Organic search: keywords, on-page optimisation, technical health and reporting.",
    durationMinutes: 10,
    passPercent: 70,
    marksPerQuestion: 1,
    guide: {
      intro:
        "SEO grows our clients' organic traffic and leads from search engines. This guide covers keyword research, on-page work, technical health, links and reporting.",
      sections: [
        {
          id: "keywords",
          title: "Keyword research",
          body: [
            "Start every project by mapping keywords to search intent: informational (learning), navigational (looking for a brand), commercial (comparing) and transactional (ready to act).",
            "For lead-generation clients, prioritise commercial and transactional keywords with local modifiers — for example '2 BHK flats in Pune' over 'what is a BHK'.",
          ],
          points: [
            "Informational → guides and blogs",
            "Commercial / transactional → service and project pages",
            "Add location modifiers for local businesses",
          ],
        },
        {
          id: "onpage",
          title: "On-page optimisation",
          body: [
            "Each page targets one primary keyword. Use it in the title tag, the H1, the URL and early in the body copy.",
            "Keep title tags under about 60 characters and meta descriptions under about 155 characters so they are not cut off in search results.",
            "Use exactly one H1 per page, and give every image descriptive alt text.",
          ],
          tip: "The meta description doesn't directly change ranking, but a good one improves click-through rate.",
        },
        {
          id: "technical",
          title: "Technical SEO",
          body: [
            "Search engines must be able to crawl and index a page before it can rank. Check robots.txt and noindex tags whenever a page is missing from results.",
            "Submit an XML sitemap in Google Search Console. Fix broken links (404s) and use 301 redirects when a URL changes permanently.",
            "Page speed and mobile usability matter: Core Web Vitals measure loading (LCP), interactivity (INP) and visual stability (CLS).",
          ],
        },
        {
          id: "links",
          title: "Links and local SEO",
          body: [
            "Earn backlinks from relevant, reputable sites. Never buy links or use link farms — they risk a penalty.",
            "For local businesses, keep the Google Business Profile complete and the business name, address and phone (NAP) identical everywhere online.",
          ],
        },
        {
          id: "reporting",
          title: "Reporting",
          body: [
            "Report monthly from Google Search Console and Google Analytics: impressions, clicks, average position, organic sessions and organic leads.",
            "Rankings move slowly — judge changes over weeks, not days.",
          ],
        },
      ],
    },
    questions: [
      { id: "se1", text: "A search for '2 BHK flats in Pune price' shows which intent?", options: ["Informational", "Navigational", "Commercial / transactional", "None"], answer: 2 },
      { id: "se2", text: "Where should a page's primary keyword appear?", options: ["Only in the footer", "Title tag, H1, URL and early body copy", "Only in image file names", "Nowhere — it's automatic"], answer: 1 },
      { id: "se3", text: "Roughly how long should a title tag be to avoid being cut off?", options: ["Under 20 characters", "Under 60 characters", "Under 200 characters", "Length doesn't matter"], answer: 1 },
      { id: "se4", text: "How many H1 tags should a page have?", options: ["None", "Exactly one", "At least three", "One per paragraph"], answer: 1 },
      { id: "se5", text: "Which redirect is used when a URL changes permanently?", options: ["302", "404", "301", "500"], answer: 2 },
      { id: "se6", text: "A page is missing from search results. What should you check first?", options: ["Its font size", "robots.txt and noindex tags", "The ad budget", "The logo"], answer: 1 },
      { id: "se7", text: "What does CLS in Core Web Vitals measure?", options: ["Loading speed", "Visual stability", "Number of backlinks", "Keyword density"], answer: 1 },
      { id: "se8", text: "Which link-building practice is acceptable?", options: ["Buying links", "Link farms", "Earning links from relevant, reputable sites", "Hidden links in footers"], answer: 2 },
      { id: "se9", text: "What does NAP stand for in local SEO?", options: ["Name, Address, Phone", "New Ad Placement", "Network Access Point", "Name And Price"], answer: 0 },
      { id: "se10", text: "Over what timeframe should ranking changes be judged?", options: ["Hours", "One day", "Weeks", "Never"], answer: 2 },
    ],
  },
  {
    id: "hr",
    name: "HR",
    description: "Hiring, onboarding, attendance, leave and workplace policies.",
    durationMinutes: 10,
    passPercent: 70,
    marksPerQuestion: 1,
    guide: {
      intro:
        "HR looks after our people from hiring to exit. This guide covers recruitment, onboarding, attendance and leave, conduct and exits.",
      sections: [
        {
          id: "hiring",
          title: "Recruitment",
          body: [
            "Every opening starts with an approved requisition from the department head that states the role, the experience needed and the budget.",
            "Screen candidates against the job description, shortlist with the hiring manager, and keep interview feedback in writing for every round.",
            "Make an offer only after the reference and document checks are complete.",
          ],
          points: ["Approved requisition", "Screen → shortlist → interviews", "Checks complete → offer"],
        },
        {
          id: "onboarding",
          title: "Onboarding",
          body: [
            "Collect identity, address, education and previous-employment documents on or before day one.",
            "On the first day, the new joiner gets their system logins, an introduction to their team and a buddy, and the policy handbook to read and acknowledge.",
          ],
          tip: "Access to client data is given only after the confidentiality agreement is signed.",
        },
        {
          id: "attendance",
          title: "Attendance and leave",
          body: [
            "Leave is applied for in advance and approved by the reporting manager. Unplanned leave must be informed to the manager before the start of the working day.",
            "Attendance and leave records are the basis for payroll, so they must be closed before the payroll cut-off each month.",
          ],
        },
        {
          id: "conduct",
          title: "Conduct and grievances",
          body: [
            "Treat every colleague with respect. Harassment of any kind is not tolerated and is handled under the POSH (Prevention of Sexual Harassment) policy through the Internal Committee.",
            "Grievances are raised with HR in writing and handled confidentially.",
          ],
        },
        {
          id: "exit",
          title: "Exit",
          body: [
            "When an employee resigns, confirm the notice period, plan the handover with the manager, and revoke all system access on the last working day.",
            "Conduct an exit interview to understand why people leave.",
          ],
        },
      ],
    },
    questions: [
      { id: "hr1", text: "What must exist before a job opening is advertised?", options: ["A candidate's CV", "An approved requisition", "An offer letter", "A payroll entry"], answer: 1 },
      { id: "hr2", text: "When can an offer be made?", options: ["After the first call", "After reference and document checks", "Before interviews", "When the candidate asks"], answer: 1 },
      { id: "hr3", text: "When should a new joiner's documents be collected?", options: ["On or before day one", "After 3 months", "At exit", "Only if asked"], answer: 0 },
      { id: "hr4", text: "Access to client data is given after…", options: ["The first salary", "The confidentiality agreement is signed", "Probation ends", "The exit interview"], answer: 1 },
      { id: "hr5", text: "Who approves leave?", options: ["A teammate", "The reporting manager", "The client", "Nobody"], answer: 1 },
      { id: "hr6", text: "Unplanned leave must be informed…", options: ["Before the start of the working day", "At month end", "The next week", "It doesn't need to be"], answer: 0 },
      { id: "hr7", text: "Why must attendance be closed before the payroll cut-off?", options: ["For appraisals only", "It is the basis for payroll", "For client billing", "It isn't required"], answer: 1 },
      { id: "hr8", text: "What does POSH stand for?", options: ["Policy on Staff Hours", "Prevention of Sexual Harassment", "Payroll Office Standard Handbook", "Performance Of Staff Hiring"], answer: 1 },
      { id: "hr9", text: "When should system access be revoked for a leaving employee?", options: ["One month later", "On the last working day", "Never", "When they ask"], answer: 1 },
      { id: "hr10", text: "What is the purpose of an exit interview?", options: ["To delay the exit", "To understand why people leave", "To recover the laptop", "To set the notice period"], answer: 1 },
    ],
  },
  {
    id: "crm_dashboard",
    name: "CRM / Dashboard",
    description: "This reporting dashboard: roles, clients, leads, data quality and issues.",
    durationMinutes: 10,
    passPercent: 70,
    marksPerQuestion: 1,
    guide: {
      intro:
        "The dashboard is where every team sees client spend, leads, payments and work. This guide covers how it is organised and the rules for using and maintaining it.",
      sections: [
        {
          id: "roles",
          title: "Roles and access",
          body: [
            "Every login has a role — admin, campaign manager, coordination, accounts, sales, creative or client — and the role decides which screens and actions are available.",
            "Clients see only their own data. Never share a staff login with a client or another employee.",
          ],
          points: ["Role decides screens and actions", "Clients see only their own data", "One login per person"],
        },
        {
          id: "clients",
          title: "Clients and projects",
          body: [
            "Each client has a unique nomen (short name) used across the dashboard, and one or more projects. Campaigns are mapped to projects so spend and leads roll up correctly.",
            "A campaign that isn't mapped to a project won't appear in the client's reports — check the mapping whenever numbers look low.",
          ],
          tip: "Most 'missing data' reports turn out to be an unmapped campaign.",
        },
        {
          id: "leads",
          title: "Leads",
          body: [
            "Leads arrive from Meta lead forms automatically. Leads can also be added manually as feeded batches, and invalid leads can be replaced or disqualified with a reason.",
            "Billable leads are generated leads minus replaced and uncovered leads.",
          ],
        },
        {
          id: "data",
          title: "Data quality",
          body: [
            "The dashboard is the single source of truth. Update client details, ownership and payments in the dashboard on the same day, not in personal sheets.",
            "Before quoting a number to a client, check the date range and the client selected on screen.",
          ],
        },
        {
          id: "issues",
          title: "Reporting issues",
          body: [
            "When something looks wrong, report it with the page, the client, the date range, what you expected and what you saw, plus a screenshot.",
            "Do not edit records in the Control Centre unless you are authorised; every change there is recorded in the audit log.",
          ],
        },
      ],
    },
    questions: [
      { id: "crm1", text: "What decides which screens a user can see?", options: ["Their browser", "Their role", "The time of day", "Their department name"], answer: 1 },
      { id: "crm2", text: "What can a client see on the dashboard?", options: ["All clients' data", "Only their own data", "Staff payroll", "Nothing"], answer: 1 },
      { id: "crm3", text: "What is a client's nomen?", options: ["Their invoice number", "A unique short name used across the dashboard", "Their ad account ID", "Their CM's name"], answer: 1 },
      { id: "crm4", text: "A campaign's spend is missing from a client report. What is the most likely cause?", options: ["The campaign isn't mapped to a project", "The client logged out", "Dark mode is on", "The CM is on leave"], answer: 0 },
      { id: "crm5", text: "How are billable leads calculated?", options: ["Generated + Replaced", "Generated − Replaced − Uncovered", "Replaced only", "Generated × 2"], answer: 1 },
      { id: "crm6", text: "Where should client detail changes be recorded?", options: ["A personal spreadsheet", "The dashboard, the same day", "WhatsApp", "At month end"], answer: 1 },
      { id: "crm7", text: "Before quoting a number to a client, check…", options: ["Your login time", "The date range and selected client", "The sidebar colour", "Nothing"], answer: 1 },
      { id: "crm8", text: "Is it okay to share a staff login?", options: ["Yes, with teammates", "Yes, with clients", "Never", "Only on weekends"], answer: 2 },
      { id: "crm9", text: "What should an issue report include?", options: ["Only 'it's broken'", "Page, client, date range, expected vs actual, screenshot", "Just a screenshot", "Your password"], answer: 1 },
      { id: "crm10", text: "Changes made in the Control Centre are…", options: ["Anonymous", "Recorded in the audit log", "Undone every night", "Visible to clients"], answer: 1 },
    ],
  },
];

// Display order on the department picker.
const ORDER = ["account", "sales", "coordination", "content", "seo", "operation", "hr", "crm_dashboard"];
export const DEPARTMENTS = ORDER.map((id) => ALL_DEPARTMENTS.find((d) => d.id === id));
