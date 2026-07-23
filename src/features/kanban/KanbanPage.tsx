/**
 * Kanban board generated from the project's Planner buckets (swimlanes).
 * Cards are draggable between buckets via @dnd-kit; clicking a card opens its
 * details (including the Commentaires/notes). Moves live only in the session
 * store (no persistence).
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
import { PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn, formatDate, formatHours } from "@/lib/utils";
import { useActiveSnapshot, usePortfolioStore } from "@/store/portfolioStore";
import type { Task } from "@/types/project";

interface BoardTask extends Task {
  projectId: string;
  dndId: string;
}

const DONE_BUCKETS = ["completed", "done", "terminé", "terminée", "terminées"];
function cardProgress(task: BoardTask): number {
  if (DONE_BUCKETS.includes(task.bucket.trim().toLowerCase()) || task.endDate != null) return 100;
  return Math.max(0, Math.min(100, task.progressPct ?? 0));
}

function TaskCard({ task, overlay = false }: { task: BoardTask; overlay?: boolean }) {
  const overdue = !task.endDate && task.dueDate != null && task.dueDate < new Date();
  const progress = cardProgress(task);
  return (
    <div className={cn("rounded-md border bg-card p-2.5 text-sm shadow-sm", overlay && "rotate-2 shadow-lg")}>
      <div className="flex items-start justify-between gap-1">
        <span className="line-clamp-2 font-medium leading-snug">{task.title}</span>
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        {task.estimateHours != null && <Badge variant="muted" className="tnum">{formatHours(task.estimateHours)}</Badge>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Progress value={progress} className="h-1.5 flex-1" />
        <span className="tnum text-[10px] text-muted-foreground">{Math.round(progress)}%</span>
      </div>
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

function DraggableCard({ task, onOpen }: { task: BoardTask; onOpen: (t: BoardTask) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.dndId });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // A click (no drag — the sensor needs 6px of movement to start one) opens details.
      onClick={() => onOpen(task)}
      className={cn("cursor-pointer touch-none", isDragging && "opacity-40")}
    >
      <TaskCard task={task} />
    </div>
  );
}

function Column({ bucket, tasks, onOpen }: { bucket: string; tasks: BoardTask[]; onOpen: (t: BoardTask) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket });
  return (
    <div className="flex min-w-[15rem] flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold">{bucket}</span>
        <Badge variant="muted" className="tnum">{tasks.length}</Badge>
      </div>
      <div ref={setNodeRef} className={cn("flex min-h-40 flex-1 flex-col gap-2 rounded-lg bg-muted/50 p-2 transition-colors", isOver && "bg-accent ring-1 ring-primary/40")}>
        {tasks.map((task) => <DraggableCard key={task.dndId} task={task} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function TaskDetailDialog({ task, onOpenChange }: { task: BoardTask | null; onOpenChange: (open: boolean) => void }) {
  const progress = task ? cardProgress(task) : 0;
  const facts: Array<[string, string]> = task
    ? [
        ["Bucket", task.bucket],
        ["Assignee", task.assignee || "—"],
        ["Priority", task.priority || "—"],
        ["Estimate", formatHours(task.estimateHours)],
        ["Progress", `${Math.round(progress)}%`],
        ["Start", formatDate(task.startDate)],
        ["Due", formatDate(task.dueDate)],
        ["End", formatDate(task.endDate)],
      ]
    : [];
  return (
    <Dialog open={task != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {task && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 leading-snug">{task.title}</DialogTitle>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <StatusBadge status={task.bucket} />
                <PriorityBadge priority={task.priority} />
                {task.labels && <Badge variant="muted">{task.labels}</Badge>}
              </div>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b pb-1">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Details (Commentaires)</p>
              {task.notes ? (
                <p className="max-h-72 overflow-y-auto whitespace-pre-line rounded-md border bg-muted/40 p-3 text-sm leading-relaxed">
                  {task.notes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No details on this task.</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function KanbanPage() {
  const snapshot = useActiveSnapshot();
  const moveTask = usePortfolioStore((s) => s.moveTask);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [detailTask, setDetailTask] = useState<BoardTask | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { buckets, tasks } = useMemo(() => {
    if (!snapshot) return { buckets: [] as string[], tasks: [] as BoardTask[] };
    const tasks = snapshot.project.tasks.map((t) => ({ ...t, projectId: snapshot.project.id, dndId: `${snapshot.project.id}:${t.id}` }));
    return { buckets: snapshot.project.buckets, tasks };
  }, [snapshot]);

  if (!snapshot) return <EmptyState />;

  const onDragStart = (e: DragStartEvent) => setActiveTask(tasks.find((t) => t.dndId === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const task = tasks.find((t) => t.dndId === active.id);
    const bucket = String(over.id);
    if (task && buckets.includes(bucket) && task.bucket !== bucket) moveTask(task.projectId, task.id, bucket);
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Kanban board</h1>
        <p className="text-sm text-muted-foreground">
          Buckets from the Planner board · click a card for details, drag to move. Changes last for this session only.
        </p>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex flex-1 items-stretch gap-3 overflow-x-auto pb-4">
          {buckets.map((bucket) => (
            <Column key={bucket} bucket={bucket} tasks={tasks.filter((t) => t.bucket === bucket)} onOpen={setDetailTask} />
          ))}
        </div>
        <DragOverlay>{activeTask && <TaskCard task={activeTask} overlay />}</DragOverlay>
      </DndContext>

      <TaskDetailDialog task={detailTask} onOpenChange={(open) => !open && setDetailTask(null)} />
    </div>
  );
}
