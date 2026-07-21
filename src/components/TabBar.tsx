import { IconHome, IconStats, IconTarget, IconBook, IconGear } from "./icons";

export type Tab = "home" | "stats" | "plan" | "browse" | "settings";

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: "home", label: "Home", Icon: IconHome },
  { id: "stats", label: "Stats", Icon: IconStats },
  { id: "plan", label: "Plan", Icon: IconTarget },
  { id: "browse", label: "Browse", Icon: IconBook },
  { id: "settings", label: "Settings", Icon: IconGear },
];

export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" role="tablist">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={active === id}
          className={"tabbar__item" + (active === id ? " active" : "")}
          onClick={() => onChange(id)}
        >
          <Icon />
          <span className="tabbar__label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
