import { Compass, ArrowLeft } from "lucide-solid";
import { Link } from "../lib/router";
import { isAdmin } from "../store/auth";

export default function NotFound() {
  return (
    <div class="card grid justify-items-center gap-4 px-6 py-20 text-center">
      <span class="grid place-items-center w-16 h-16 rounded-2xl bg-plum-50 text-plum-700 dark:bg-lime-400/15 dark:text-lime-300">
        <Compass size={28} />
      </span>
      <p class="kicker">Error 404</p>
      <h1 class="text-[26px] font-semibold tracking-[-0.025em]">This page wandered off</h1>
      <p class="max-w-md text-muted">The link may be old, or the page may have moved. Let's get you back on track.</p>
      <Link href={isAdmin() ? "/admin" : "/dashboard"} class="btn btn-primary mt-2">
        <ArrowLeft size={15} /> Back to dashboard
      </Link>
    </div>
  );
}
