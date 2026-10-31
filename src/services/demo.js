// Demo mode is off against the real API: no sample accounts, no demo
// passwords and no "reset demo data" in the bundle.
// Mock mode (VITE_USE_MOCK=true) swaps this file for services/mock/demo.js.

export const DEMO_MODE = false;
export const DEMO_ACCOUNTS = [];
export const demoPassword = () => "";
