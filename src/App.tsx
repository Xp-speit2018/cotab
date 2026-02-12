import { Toolbar } from "@/components/Toolbar";
import { ScoreViewport } from "@/components/ScoreViewport";
import { FpsMonitor } from "@/components/FpsMonitor";

export default function App() {
  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <ScoreViewport />
      {import.meta.env.DEV && <FpsMonitor />}
    </div>
  );
}
