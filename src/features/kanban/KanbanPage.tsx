/**
 * Kanban board generated from a Planner board's buckets (swimlanes).
 * Cards are draggable between buckets via @dnd-kit; moves live only in the
 * session store (no persistence).
 */

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarDays, GripVertical } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PriorityBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";
import { useFilteredSnapshots, usePortfolioStore } from "@/store/portfolioStore";
import type { Task } from "@/types/project";

interface BoardTask extends Task {
  projectId: string;
  dndId: string;
}

function TaskCard({ task, overlay = false }: { task: BoardTask; overlay?: boolean }) {
  const overdue = !task.endDate && task.dueDate != null && task.dueDate < new Date();
  return (
    <div className={cn("rounded-md border bg-card p-2.5 text-sm shadow-sm", overlay && "rotate-2 shadow-lg")}>
      <div className="flex items-start justify-between gap-1">
        <span className="line-clamp-2 font-medium leading-snug">{task.title}</span>
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5"><PriorityBadge priority={task.priority} /></div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{task.assignee || "Unassigned"}</span>
        {task.dueDate && (
          <span className={cn("tnum flex items-center gap-1", overdue && "font-medium text-red-700 dark:text-red-400")}>
            <CalendarDays className="h-3 w-3" />{formatDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}

function DraggableCard({ task }: { task: BoardTask }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.dndId });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("cursor-grab touch-none", isDragging && "opacity-40")}>
      <TaskCard task={task} />
    </div>
  );
}

function Column({ bucket, tasks }: { bucket: string; tasks: BoardTask[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket });
  return (
    <div className="flex w-64 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold">{bucket}</span>
        <Badge variant="muted" className="tnum">{tasks.length}</Badge>
      </div>
      <div ref={setNodeRef} className={cn("flex min-h-40 flex-1 flex-col gap-2 rounded-lg bg-muted/50 p-2 transition-colors", isOver && "bg-accent ring-1 ring-primary/40")}>
        {tasks.map((task) => <DraggableCard key={task.dndId} task={task} />)}
      </div>
    </div>
  );
}

export function KanbanPage() {
  const snapshots = useFilteredSnapshots();
  const hasProjects = usePortfolioStore((s) => s.projects.length > 0);
  const moveTask = usePortfolioStore((s) => s.moveTask);
  const [projectId, setProjectId] = useState<string>(snapshots[0]?.project.id ?? "all");
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const selected = snapshots.find((s) => s.project.id === projectId) ?? snapshots[0];

  const { buckets, tasks } = useMemo(() => {
    if (!selected) return { buckets: [] as string[], tasks: [] as BoardTask[] };
    const tasks = selected.project.tasks.map((t) => ({ ...t, projectId: selected.project.id, dndId: `${selected.project.id}:${t.id}` }));
    return { buckets: selected.project.buckets, tasks };
  }, [selected]);

  if (!hasProjects) return <EmptyState />;

  const onDragStart = (e: DragStartEvent) => setActiveTask(tasks.find((t) => t.dndId === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over || !selected) return;
    const task = tasks.find((t) => t.dndId === active.id);
    const bucket = String(over.id);
    if (task && buckets.includes(bucket) && task.bucket !== bucket) moveTask(task.projectId, task.id, bucket);
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Kanban board</h1>
          <p className="text-sm text-muted-foreground">Buckets from the Planner board. Drags last for this session only.</p>
        </div>
        <Select value={selected?.project.id ?? ""} onValueChange={setProjectId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select project" /></SelectTrigger>
          <SelectContent>
            {snapshots.map((s) => <SelectItem key={s.project.id} value={s.project.id}>{s.project.charter.projectName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
          {buckets.map((bucket) => <Column key={bucket} bucket={bucket} tasks={tasks.filter((t) => t.bucket === bucket)} />)}
        </div>
        <DragOverlay>{activeTask && <TaskCard task={activeTask} overlay />}</DragOverlay>
      </DndContext>
    </div>
  );
}
