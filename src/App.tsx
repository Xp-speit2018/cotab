import { Toolbar } from "@/components/Toolbar";
import { ScoreViewport } from "@/components/ScoreViewport";
import { NoteEditorSidebar } from "@/components/NoteEditorSidebar";

export default function App() {
  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <NoteEditorSidebar />
        <ScoreViewport />
      </div>
    </div>
  );
}
