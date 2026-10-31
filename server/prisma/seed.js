// Development seed: departments, designations (with levels), the admins,
// essentials guides, 3 assessments per department and their question banks.
// The 24 sample employees are only added with SEED_SAMPLE_EMPLOYEES=true.
//
//   npm run db:seed          (idempotent: upserts by id)
//
// Passwords come from SEED_SUPER_ADMIN_PASSWORD / SEED_ADMIN_PASSWORD (and
// SEED_EMPLOYEE_PASSWORD for sample employees) in .env.
// Refuses to run in production — create real admins with `npm run admin:create`.

import { env } from "../src/config/env.js";
import { prisma } from "../src/config/db.js";
import { hashPassword, PASSWORD_MIN } from "../src/utils/password.js";
import { LEVELS, levelPlural } from "../src/utils/levels.js";
import { DEPARTMENTS } from "./seed-data/trainingData.js";

if (env.isProd) {
  console.error("Refusing to seed sample data in production.");
  process.exit(1);
}

const SUPER_ADMIN_PW = process.env.SEED_SUPER_ADMIN_PASSWORD;
const ADMIN_PW = process.env.SEED_ADMIN_PASSWORD;
const EMPLOYEE_PW = process.env.SEED_EMPLOYEE_PASSWORD;
const SAMPLE_EMPLOYEES = process.env.SEED_SAMPLE_EMPLOYEES === "true";
const REQUIRED = [["SEED_SUPER_ADMIN_PASSWORD", SUPER_ADMIN_PW], ["SEED_ADMIN_PASSWORD", ADMIN_PW], ...(SAMPLE_EMPLOYEES ? [["SEED_EMPLOYEE_PASSWORD", EMPLOYEE_PW]] : [])];
for (const [k, v] of REQUIRED) {
  if (!v || v.length < PASSWORD_MIN) {
    console.error(`Set ${k} (at least ${PASSWORD_MIN} characters) in .env before seeding.`);
    process.exit(1);
  }
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

const DEPARTMENT_META = {
  account: { head: "Sandeep Malhotra", location: "Lucknow" },
  sales: { head: "Rohit Verma", location: "Noida" },
  coordination: { head: "Tarun Bhatia", location: "Lucknow" },
  content: { head: "Kavya Reddy", location: "" },
  seo: { head: "Nikhil Arora", location: "Noida" },
  operation: { head: "Aditya Menon", location: "Lucknow" },
  hr: { head: "Varun Desai", location: "Lucknow" },
  crm_dashboard: { head: "Divya Krishnan", location: "" },
};

const DESIGNATIONS = [
  ["acc-exec", "Accounts Executive", "account", "JUNIOR"],
  ["acc-sr", "Senior Accountant", "account", "SENIOR"],
  ["sales-exec", "Sales Executive", "sales", "JUNIOR"],
  ["sales-mgr", "Sales Manager", "sales", "TEAM_HEAD"],
  ["coord", "Client Coordinator", "coordination", "JUNIOR"],
  ["coord-lead", "Coordination Lead", "coordination", "TEAM_HEAD"],
  ["writer", "Content Writer", "content", "JUNIOR"],
  ["strategist", "Content Strategist", "content", "SENIOR"],
  ["seo-exec", "SEO Executive", "seo", "JUNIOR"],
  ["seo-analyst", "SEO Analyst", "seo", "SENIOR"],
  ["cm", "Campaign Manager", "operation", "JUNIOR"],
  ["scm", "Senior Campaign Manager", "operation", "SENIOR"],
  ["hr-exec", "HR Executive", "hr", "JUNIOR"],
  ["hr-mgr", "HR Manager", "hr", "TEAM_HEAD"],
  ["crm-exec", "CRM Executive", "crm_dashboard", "JUNIOR"],
  ["dash-analyst", "Dashboard Analyst", "crm_dashboard", "SENIOR"],
];

const LOCATIONS = ["Lucknow", "Noida", "Kolkata"];

// [name, designationId | null, status?]. Kabir has no designation: shows the
// "no training assigned" state.
const PEOPLE = [
  ["Neha Gupta", "acc-exec"],
  ["Sandeep Malhotra", "acc-sr"],
  ["Pooja Nair", "acc-exec"],
  ["Rohit Verma", "sales-mgr"],
  ["Aisha Khan", "sales-exec"],
  ["Manish Joshi", "sales-exec", "INACTIVE"],
  ["Simran Kaur", "coord"],
  ["Tarun Bhatia", "coord-lead"],
  ["Ritika Saxena", "coord"],
  ["Arjun Mehta", "writer"],
  ["Kavya Reddy", "strategist"],
  ["Ishaan Chawla", "writer"],
  ["Preeti Sharma", "seo-exec"],
  ["Nikhil Arora", "seo-analyst"],
  ["Sneha Pillai", "seo-exec"],
  ["Karan Singh", "cm"],
  ["Aditya Menon", "scm"],
  ["Zoya Qureshi", "cm"],
  ["Anjali Rao", "hr-exec"],
  ["Varun Desai", "hr-mgr"],
  ["Vikas Yadav", "crm-exec"],
  ["Divya Krishnan", "dash-analyst"],
  ["Harsh Vardhan", "crm-exec"],
  ["Kabir Anand", null],
];

const ADMINS = [
  ["a-1", "SUPER_ADMIN", "Super Admin", "Alok", "alok@aajneeti.social", "AJN-0001", "Lucknow", 1460],
  ["a-2", "ADMIN", "Training Admin", "Preeti", "preeti@aajneeti.social", "AJN-0002", "Lucknow", 980],
];

const PREFS = { emailReminders: true, resultEmails: true, weeklyDigest: false };
const emailOf = (name) => `${name.toLowerCase().replace(/\s+/g, ".")}@aajneeti.com`;
const PASS = { junior: null, senior: 75, head: 80 };

async function main() {
  const [superAdminHash, adminHash, employeeHash] = await Promise.all([hashPassword(SUPER_ADMIN_PW), hashPassword(ADMIN_PW), SAMPLE_EMPLOYEES ? hashPassword(EMPLOYEE_PW) : null]);

  // Office locations (only added if missing: admins may rename them)
  for (const name of LOCATIONS) {
    if (!(await prisma.location.findFirst({ where: { name: { equals: name, mode: "insensitive" } } }))) await prisma.location.create({ data: { name } });
  }

  // Departments
  for (const d of DEPARTMENTS) {
    const data = { name: d.name, description: d.description, head: DEPARTMENT_META[d.id]?.head ?? "", location: DEPARTMENT_META[d.id]?.location ?? "" };
    await prisma.department.upsert({ where: { id: d.id }, update: data, create: { id: d.id, ...data } });
  }

  // Designations
  for (const [id, title, departmentId, level] of DESIGNATIONS) {
    await prisma.designation.upsert({ where: { id }, update: { title, departmentId, level }, create: { id, title, departmentId, level } });
  }

  // Admins
  for (const [id, role, adminTitle, name, email, employeeCode, location, joined] of ADMINS) {
    const data = { role, adminTitle, name, email, employeeCode, location, phone: `+91 98390 1000${id.slice(-1)}` };
    await prisma.user.upsert({
      where: { id },
      update: data,
      create: { id, ...data, passwordHash: role === "SUPER_ADMIN" ? superAdminHash : adminHash, joinedAt: daysAgo(joined), preferences: PREFS },
    });
  }

  // Sample employees (opt-in)
  for (const [i, [name, designationId, status]] of (SAMPLE_EMPLOYEES ? PEOPLE : []).entries()) {
    const id = `e-${101 + i}`;
    const data = {
      name,
      email: emailOf(name),
      designationId,
      status: status ?? "ACTIVE",
      phone: `+91 98${410 + i * 7} ${20000 + i * 1373}`,
      employeeCode: `AJN-${1040 + i * 3}`,
      location: LOCATIONS[i % LOCATIONS.length],
    };
    await prisma.user.upsert({
      where: { id },
      update: data,
      create: { id, ...data, role: "EMPLOYEE", passwordHash: employeeHash, joinedAt: daysAgo(30 + ((i * 47) % 900)), preferences: PREFS },
    });
  }

  // Essentials guide per department (structured, required, all levels)
  for (const [i, d] of DEPARTMENTS.entries()) {
    const id = `guide-${d.id}`;
    const words = JSON.stringify(d.guide).split(/\s+/).length;
    const data = {
      title: `${d.name} essentials`,
      type: "STRUCTURED_GUIDE",
      departmentId: d.id,
      required: true,
      description: d.guide.intro,
      estMinutes: Math.max(6, Math.round(words / 200)),
      version: "2.1",
      author: "Department head",
      content: { intro: d.guide.intro, sections: d.guide.sections },
      createdById: "a-1",
    };
    const exists = await prisma.material.findUnique({ where: { id } });
    if (!exists) {
      await prisma.material.create({
        data: {
          id,
          ...data,
          createdAt: daysAgo(6 + i * 3),
          levels: { create: LEVELS.map((l) => ({ level: l.enum })) },
          versions: { create: { revision: 1, version: data.version, title: data.title, description: data.description, type: data.type, content: data.content, createdById: "a-1" } },
        },
      });
    }
  }

  // Three assessments per department, each with its own copy of the bank
  for (const d of DEPARTMENTS) {
    for (const lv of LEVELS) {
      const id = `asm-${d.id}-${lv.key}`;
      const settings = {
        title: `${d.name} · ${levelPlural(lv.enum)}`,
        durationSeconds: d.durationMinutes * 60,
        passPercent: PASS[lv.key] ?? d.passPercent,
        marksPerQuestion: d.marksPerQuestion,
        maxAttempts: 3,
        questionsPerAttempt: 5,
        shuffle: true,
        active: true,
      };
      await prisma.assessment.upsert({
        where: { id },
        update: {},
        create: { id, departmentId: d.id, level: lv.enum, ...settings },
      });
      for (const q of d.questions) {
        const qid = `${q.id}-${lv.key[0]}`;
        if (await prisma.question.findUnique({ where: { id: qid } })) continue;
        await prisma.question.create({
          data: {
            id: qid,
            assessmentId: id,
            text: q.text,
            options: { create: q.options.map((text, position) => ({ id: `${qid}-o${position}`, text, position, isCorrect: position === q.answer })) },
          },
        });
      }
    }
  }

  // Announcements
  const announcements = [
    ["an-1", "October training cycle is open", "Complete your module and assessment by 31 October. Scores feed into the H2 performance review.", "Preeti", "a-2", "lime", 3],
    ["an-2", "Updated Employee Handbook (v4.0)", "The data protection chapter has new rules on lead downloads. Please re-read it, even if you completed it before.", "HR", null, "plum", 9],
  ];
  for (const [id, title, body, authorName, authorId, tone, ago] of announcements) {
    await prisma.announcement.upsert({
      where: { id },
      update: {},
      create: { id, title, body, authorName, authorId, tone, published: true, publishedAt: daysAgo(ago), createdAt: daysAgo(ago) },
    });
  }

  const counts = await Promise.all([
    prisma.department.count(),
    prisma.designation.count(),
    prisma.user.count(),
    prisma.material.count(),
    prisma.assessment.count(),
    prisma.question.count(),
    prisma.questionOption.count(),
  ]);
  console.log("Seeded → departments %d, designations %d, users %d, materials %d, assessments %d, questions %d, options %d", ...counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
