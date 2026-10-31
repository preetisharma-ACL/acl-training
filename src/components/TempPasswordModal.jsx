// Shows a temporary password once, after an admin reset.
// issued: { name, email, password }

import { Modal } from "./ui";
import { toast } from "../store/toast";

export default function TempPasswordModal(props) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.issued.password);
      toast("Copied to the clipboard.");
    } catch {
      toast("Couldn't copy — select the password instead.", { tone: "error" });
    }
  };
  return (
    <Modal
      title="Temporary password"
      subtitle={`Share it with ${props.issued.name} directly. They'll create a new password when they sign in.`}
      labelledBy="temp-pw-title"
      size="sm"
      onClose={props.onClose}
      footer={
        <>
          <button class="btn btn-secondary" onClick={copy}>
            Copy
          </button>
          <button class="btn btn-primary" onClick={props.onClose}>
            Done
          </button>
        </>
      }
    >
      <p class="text-[13px] text-muted">{props.issued.email}</p>
      <p class="mt-2 px-4 py-3 rounded-xl bg-sunken border border-line font-mono text-[17px] font-semibold tracking-wide select-all break-all">{props.issued.password}</p>
      <p class="mt-3 text-[13px] text-muted">This is the only time it's shown. Their other sessions have been signed out.</p>
    </Modal>
  );
}
