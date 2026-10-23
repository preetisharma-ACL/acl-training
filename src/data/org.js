// ─── Organisation — SAMPLE data ─────────────────────────────────────────────
// Seeds the mock database (services/mockDb.js). In production all of this
// comes from the backend; nothing in the UI imports this file directly.
//
// The key rule the backend owns: an employee's DEPARTMENT is derived from
// their DESIGNATION. Employees never pick it.

// Department heads and descriptions shown on dashboards. Assessment settings
// and guides live in trainingData.js.
export const DEPARTMENT_META = {
  account: { head: "Sandeep Malhotra", location: "Lucknow HQ" },
  sales: { head: "Rohit Verma", location: "Noida" },
  coordination: { head: "Tarun Bhatia", location: "Lucknow HQ" },
  content: { head: "Kavya Reddy", location: "Remote-first" },
  seo: { head: "Nikhil Arora", location: "Noida" },
  operation: { head: "Aditya Menon", location: "Lucknow HQ" },
  hr: { head: "Varun Desai", location: "Lucknow HQ" },
  crm_dashboard: { head: "Divya Krishnan", location: "Gurugram" },
};

export const DESIGNATIONS = [
  { id: "acc-exec", title: "Accounts Executive", departmentId: "account", level: "Junior" },
  { id: "acc-sr", title: "Senior Accountant", departmentId: "account", level: "Senior" },
  { id: "sales-exec", title: "Sales Executive", departmentId: "sales", level: "Junior" },
  { id: "sales-mgr", title: "Sales Manager", departmentId: "sales", level: "Team head" },
  { id: "coord", title: "Client Coordinator", departmentId: "coordination", level: "Junior" },
  { id: "coord-lead", title: "Coordination Lead", departmentId: "coordination", level: "Team head" },
  { id: "writer", title: "Content Writer", departmentId: "content", level: "Junior" },
  { id: "strategist", title: "Content Strategist", departmentId: "content", level: "Senior" },
  { id: "seo-exec", title: "SEO Executive", departmentId: "seo", level: "Junior" },
  { id: "seo-analyst", title: "SEO Analyst", departmentId: "seo", level: "Senior" },
  { id: "cm", title: "Campaign Manager", departmentId: "operation", level: "Junior" },
  { id: "scm", title: "Senior Campaign Manager", departmentId: "operation", level: "Senior" },
  { id: "hr-exec", title: "HR Executive", departmentId: "hr", level: "Junior" },
  { id: "hr-mgr", title: "HR Manager", departmentId: "hr", level: "Team head" },
  { id: "crm-exec", title: "CRM Executive", departmentId: "crm_dashboard", level: "Junior" },
  { id: "dash-analyst", title: "Dashboard Analyst", departmentId: "crm_dashboard", level: "Senior" },
  // Deliberately unmapped: shows the "no training assigned" state.
  { id: "intern", title: "Intern", departmentId: null, level: "Junior" },
];

const LOCATIONS = ["Lucknow HQ", "Noida", "Gurugram", "Delhi", "Remote"];

// [name, designationId, status?]
const PEOPLE = [
  ["Neha Gupta", "acc-exec"],
  ["Sandeep Malhotra", "acc-sr"],
  ["Pooja Nair", "acc-exec"],
  ["Rohit Verma", "sales-mgr"],
  ["Aisha Khan", "sales-exec"],
  ["Manish Joshi", "sales-exec", "inactive"],
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
  ["Kabir Anand", "intern"],
];

const email = (name) => `${name.toLowerCase().replace(/\s+/g, ".")}@aajneeti.com`;
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

export const MOCK_EMPLOYEE_PASSWORD = "Welcome@123";
export const MOCK_ADMIN_PASSWORD = "Admin@123";

export const SEED_USERS = [
  {
    id: "a-1",
    role: "admin",
    adminTitle: "Super Admin",
    name: "Alok",
    email: "alok@aajneeti.com",
    phone: "+91 98390 10001",
    designationId: null,
    code: "AJN-0001",
    location: "Lucknow HQ",
    joinedAt: daysAgo(1460),
    status: "active",
    lastActiveAt: daysAgo(0),
    password: MOCK_ADMIN_PASSWORD,
  },
  {
    id: "a-2",
    role: "admin",
    adminTitle: "HR & Training Admin",
    name: "Meera Iyer",
    email: "meera.iyer@aajneeti.com",
    phone: "+91 98390 10002",
    designationId: null,
    code: "AJN-0002",
    location: "Lucknow HQ",
    joinedAt: daysAgo(980),
    status: "active",
    lastActiveAt: daysAgo(1),
    password: MOCK_ADMIN_PASSWORD,
  },
  {
    id: "a-3",
    role: "admin",
    adminTitle: "Training Admin",
    name: "Devansh Kapoor",
    email: "devansh.kapoor@aajneeti.com",
    phone: "+91 98390 10003",
    designationId: null,
    code: "AJN-0003",
    location: "Noida",
    joinedAt: daysAgo(640),
    status: "active",
    lastActiveAt: daysAgo(3),
    password: MOCK_ADMIN_PASSWORD,
  },
  ...PEOPLE.map(([name, designationId, status], i) => ({
    id: `e-${101 + i}`,
    role: "employee",
    name,
    email: email(name),
    phone: `+91 98${410 + i * 7} ${20000 + i * 1373}`,
    designationId,
    code: `AJN-${String(1040 + i * 3)}`,
    location: LOCATIONS[i % LOCATIONS.length],
    joinedAt: daysAgo(30 + ((i * 47) % 900)),
    status: status || "active",
    lastActiveAt: daysAgo((i * 5) % 21),
    password: MOCK_EMPLOYEE_PASSWORD,
  })),
];

// Shown as one-click chips on the login screen (mock mode only).
export const DEMO_ACCOUNTS = [
  { email: "preeti.sharma@aajneeti.com", label: "Preeti Sharma", hint: "Employee · SEO Executive", role: "employee" },
  { email: "alok@aajneeti.com", label: "Alok", hint: "Admin · Super Admin", role: "admin" },
];
