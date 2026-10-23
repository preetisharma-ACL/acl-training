// Icons mapped from ids the API sends. Kept in the UI (not the data) because
// the backend sends ids, not components; unknown ids fall back gracefully.

import { Dynamic } from "solid-js/web";
import {
  BookOpen,
  Wallet,
  Handshake,
  Headset,
  PenTool,
  SearchCheck,
  Megaphone,
  UserRoundCheck,
  LayoutDashboard,
  FileText,
  ScrollText,
  Layers,
} from "lucide-solid";

const DEPT_ICONS = {
  account: Wallet,
  sales: Handshake,
  coordination: Headset,
  content: PenTool,
  seo: SearchCheck,
  operation: Megaphone,
  hr: UserRoundCheck,
  crm_dashboard: LayoutDashboard,
};

export const DeptIcon = (props) => <Dynamic component={DEPT_ICONS[props.id] || BookOpen} size={props.size ?? 18} class={props.class} />;

export const MATERIAL_TYPES = {
  pdf: { label: "PDF document", short: "PDF", icon: FileText, badge: "badge-danger" },
  manual: { label: "Written manual", short: "Manual", icon: ScrollText, badge: "badge-plum" },
  structured: { label: "Structured guide", short: "Guide", icon: Layers, badge: "badge-lime" },
};

export const TypeIcon = (props) => (
  <Dynamic component={MATERIAL_TYPES[props.type]?.icon || FileText} size={props.size ?? 18} class={props.class} />
);
