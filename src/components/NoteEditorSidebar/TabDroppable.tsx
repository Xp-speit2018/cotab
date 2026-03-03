import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

/**
 * A droppable container for a tab's content. When a section is dragged over
 * this area, it becomes a valid drop target even if the tab is empty.
 */
export function TabDroppable({
  tabId,
  children,
}: {
  tabId: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: tabId });
  return (
    <div
      ref={setNodeRef}
      className={cn("min-h-[32px]", isOver && "bg-accent/20")}
    >
      {children}
    </div>
  );
}
