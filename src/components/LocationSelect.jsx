// Office location dropdown. The list is admin-managed (Admin → Locations);
// `load` is the service call that returns [{ name }].
// A saved value that's no longer on the list stays visible until changed.

import { createResource, For, Show } from "solid-js";

export default function LocationSelect(props) {
  const [list] = createResource(props.load);
  const names = () => (list() ?? []).map((l) => l.name);
  const stale = () => props.value && list() && !names().includes(props.value);
  return (
    <select id={props.id} class="input" value={props.value ?? ""} onChange={(e) => props.onChange(e.currentTarget.value)} disabled={props.disabled}>
      <option value="">Not set</option>
      <Show when={stale()}>
        <option value={props.value}>{props.value} (removed)</option>
      </Show>
      <For each={names()}>{(n) => <option value={n}>{n}</option>}</For>
    </select>
  );
}
