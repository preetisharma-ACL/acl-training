// ─── Profile settings ───────────────────────────────────────────────────────
// Every signed-in user (employee or admin): view their details, update
// mobile number, location, bio and notifications, and change their password.
// Name, email, code, designation and department stay admin-managed.

import { Show } from "solid-js";
import { KeyRound, UserRound } from "lucide-solid";
import { user, updateUser } from "../store/auth";
import { PageHeader, Avatar } from "../components/ui";
import { ProfileDetails, PasswordForm } from "../components/account";

export default function Profile() {
  const me = () => user();
  return (
    <div class="grid gap-6">
      <PageHeader kicker="Account" title="Profile settings" subtitle="Keep your contact details up to date and change your password." />

      <div class="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6 items-start">
        <section class="card p-5 sm:p-7">
          <div class="flex items-center gap-4 mb-6">
            <Avatar name={me()?.name} size={56} />
            <div class="min-w-0">
              <h2 class="text-[19px] font-semibold truncate">{me()?.name}</h2>
              <p class="text-[14px] text-muted truncate">
                <Show when={me()?.role === "admin"} fallback={[me()?.designation?.title, me()?.department?.name].filter(Boolean).join(" · ") || "Employee"}>
                  {me()?.adminTitle ?? "Admin"}
                </Show>
              </p>
            </div>
          </div>
          <h3 class="flex items-center gap-2 text-[15px] font-semibold mb-4">
            <UserRound size={17} class="text-plum-700 dark:text-lime-400" /> Your details
          </h3>
          <ProfileDetails />
        </section>

        <section class="card p-5 sm:p-7">
          <h3 class="flex items-center gap-2 text-[15px] font-semibold">
            <KeyRound size={17} class="text-plum-700 dark:text-lime-400" /> Change password
          </h3>
          <p class="mt-1 mb-5 text-[14px] text-muted">Changing it signs you out on your other devices.</p>
          <PasswordForm onDone={(updated) => updated && updateUser(updated)} />
        </section>
      </div>
    </div>
  );
}
