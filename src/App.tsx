import { Toolbar } from "@/components/Toolbar";
import { ScoreViewport } from "@/components/ScoreViewport";
import { NoteEditorSidebar } from "@/components/NoteEditorSidebar";
import { FpsMonitor } from "@/components/FpsMonitor";

export default function App() {
  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <NoteEditorSidebar />
        <ScoreViewport />
      </div>
      {import.meta.env.DEV && <FpsMonitor />}
    </div>
  );
}
