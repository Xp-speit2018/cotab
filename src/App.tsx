import { Toolbar } from "@/components/Toolbar";
import { ScoreViewport } from "@/components/ScoreViewport";

export default function App() {
  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <ScoreViewport />
    </div>
  );
}
