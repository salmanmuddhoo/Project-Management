/**
 * Jira-style Kanban board generated from the Product Backlog sheet(s).
 *
 * Cards are draggable between the eight standard columns via @dnd-kit.
 * Moves live only in the session store (kanbanOverrides) — nothing is
 * persisted, matching the app's no-storage guarantee.
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clamp, cn, formatDate } from "@/lib/utils";
import {
  useFilteredSnapshots,
  usePortfolioStore,
} from "@/store/portfolioStore";
import {
  KANBAN_COLUMNS,
  type BacklogItem,
  type KanbanColumn,
} from "@/types/project";

interface BoardTask extends BacklogItem {
  projectId: string;
  projectCode: string;
  /** dnd id: `${projectId}:${taskId}` */
  dndId: string;
}

function taskProgress(task: BoardTask): number | null {
  if (task.status === "Done") return 100;
  if (task.estimatedHours != null && task.estimatedHours > 0 && task.remainingHours != null) {
    return clamp(
      ((task.estimatedHours - task.remainingHours) / task.estimatedHours) * 100,
      0,
      100,
    );
  }
  return null;
}

function TaskCard({
  task,
  overlay = false,
}: {
  task: BoardTask;
  overlay?: boolean;
}) {
  const progress = taskProgress(task);
  const overdue =
    task.dueDate != null && task.dueDate < new Date() && task.status !== "Done";
  return (
    <div
      className={cn(
        "rounded-md border bg-card p-2.5 text-sm shadow-sm",
        overlay && "rotate-2 shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-mono text-[10px] text-muted-foreground">
          {task.taskId}
        </span>
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      </div>
      <p className="mt-0.5 line-clamp-2 font-medium leading-snug">
        {task.taskTitle}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        {task.storyPoints != null && (
          <Badge variant="muted" className="tnum">{task.storyPoints} pts</Badge>
        )}
        {task.estimatedHours != null && (
          <Badge variant="muted" className="tnum">
            {task.remainingHours ?? task.estimatedHours}h / {task.estimatedHours}h
          </Badge>
        )}
      </div>
      {progress != null && <Progress value={progress} className="mt-2" />}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{task.assignee || "Unassigned"}</span>
        {task.dueDate && (
          <span
            className={cn(
              "tnum flex items-center gap-1",
              overdue && "font-medium text-red-700 dark:text-red-400",
            )}
          >
            <CalendarDays className="h-3 w-3" />
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}

function DraggableCard({ task }: { task: BoardTask }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.dndId,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("cursor-grab touch-none", isDragging && "opacity-40")}
    >
      <TaskCard task={task} />
    </div>
  );
}

function Column({
  column,
  tasks,
}: {
  column: KanbanColumn;
  tasks: BoardTask[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  return (
    <div className="flex w-64 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold">{column}</span>
        <Badge variant="muted" className="tnum">{tasks.length}</Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-40 flex-1 flex-col gap-2 rounded-lg bg-muted/50 p-2 transition-colors",
          isOver && "bg-accent ring-1 ring-primary/40",
        )}
      >
        {tasks.map((task) => (
          <DraggableCard key={task.dndId} task={task} />
        ))}
      </div>
    </div>
  );
}

export function KanbanPage() {
  const snapshots = useFilteredSnapshots();
  const hasProjects = usePortfolioStore((s) => s.projects.length > 0);
  const moveTask = usePortfolioStore((s) => s.moveTask);
  const [projectId, setProjectId] = useState<string>("all");
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const tasks: BoardTask[] = useMemo(
    () =>
      snapshots
        .filter((s) => projectId === "all" || s.project.id === projectId)
        .flatMap((s) =>
          s.project.backlog.map((t) => ({
            ...t,
            projectId: s.project.id,
            projectCode: s.project.charter.projectCode,
            dndId: `${s.project.id}:${t.taskId}`,
          })),
        ),
    [snapshots, projectId],
  );

  if (!hasProjects) return <EmptyState />;

  const onDragStart = (event: DragStartEvent) => {
    setActiveTask(tasks.find((t) => t.dndId === event.active.id) ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const task = tasks.find((t) => t.dndId === active.id);
    const column = over.id as KanbanColumn;
    if (task && KANBAN_COLUMNS.includes(column) && task.status !== column) {
      moveTask(task.projectId, task.taskId, column);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Kanban board</h1>
          <p className="text-sm text-muted-foreground">
            Generated from the Product Backlog sheets. Drags last for this
            session only — the workbook remains the source of truth.
          </p>
        </div>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {snapshots.map((s) => (
              <SelectItem key={s.project.id} value={s.project.id}>
                {s.project.charter.projectName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((column) => (
            <Column
              key={column}
              column={column}
              tasks={tasks.filter((t) => t.status === column)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} overlay />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
