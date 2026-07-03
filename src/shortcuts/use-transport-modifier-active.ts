import { useEffect, useState } from "react";
import { useShortcutStore } from "./shortcut-store";
import { eventMatchesTransportModifier } from "./transport-modifier";

export function useTransportModifierActive(): boolean {
  const transportModifier = useShortcutStore((state) => state.transportModifier);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const updateFromEvent = (event: KeyboardEvent) => {
      setActive(eventMatchesTransportModifier(event, transportModifier));
    };
    const clear = () => setActive(false);

    document.addEventListener("keydown", updateFromEvent, { capture: true });
    document.addEventListener("keyup", updateFromEvent, { capture: true });
    window.addEventListener("blur", clear);

    return () => {
      document.removeEventListener("keydown", updateFromEvent, { capture: true });
      document.removeEventListener("keyup", updateFromEvent, { capture: true });
      window.removeEventListener("blur", clear);
    };
  }, [transportModifier]);

  return active;
}
