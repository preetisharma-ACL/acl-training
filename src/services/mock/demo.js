// Mock mode: one-click sample accounts on the login screen.

import { DEMO_ACCOUNTS, MOCK_EMPLOYEE_PASSWORD, MOCK_ADMIN_PASSWORD } from "../../data/org";

export const DEMO_MODE = true;
export { DEMO_ACCOUNTS };
export const demoPassword = (acc) => (acc.role === "admin" ? MOCK_ADMIN_PASSWORD : MOCK_EMPLOYEE_PASSWORD);
