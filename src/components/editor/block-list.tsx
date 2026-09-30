"use client";

/**
 * Drag-and-drop layers list for checkout blocks.
 *
 * Built on dnd-kit because it supports keyboard dragging out of the box:
 * focus a handle, press Space to pick up, arrows to move, Space to drop.
 * We also provide screen-reader announcements with human block names.
 */
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Lock, Trash2 } from "lucide-react";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { BLOCK_META } from "@/lib/checkout/meta";
import type { Block } from "@/lib/checkout/schema";
import { cn } from "@/lib/utils";

export function BlockList({
  blocks,
  onReorder,
  onToggle,
  onRemove,
  onSelect,
  selectedId,
}: {
  blocks: Block[];
  onReorder: (from: number, to: number) => void;
  onToggle: (id: string) => void;
  /** Omit to hide delete buttons (landing demo). */
  onRemove?: (id: string) => void;
  /** Omit to disable selection (landing demo). */
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (id: string | number) => {
    const b = blocks.find((x) => x.id === id);
    return b ? BLOCK_META[b.type].label : "block";
  };
  const posOf = (id: string | number) => blocks.findIndex((x) => x.id === id) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}. Position ${posOf(active.id)} of ${blocks.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} moved to position ${posOf(over.id)} of ${blocks.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `Dropped ${nameOf(active.id)} at position ${posOf(over.id)}.` : `Dropped ${nameOf(active.id)}.`,
    onDragCancel: ({ active }) => `Cancelled. ${nameOf(active.id)} returned to its place.`,
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onReorder(posOf(active.id) - 1, posOf(over.id) - 1);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "To reorder, press Space to pick up the block, use the arrow keys to move it, and Space again to drop.",
        },
      }}
    >
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ul className="relative space-y-1.5">
          {blocks.map((b) => (
            <SortableRow
              key={b.id}
              block={b}
              onToggle={onToggle}
              onRemove={onRemove}
              onSelect={onSelect}
              selected={selectedId === b.id}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  block,
  onToggle,
  onRemove,
  onSelect,
  selected,
}: {
  block: Block;
  onToggle: (id: string) => void;
  onRemove?: (id: string) => void;
  onSelect?: (id: string) => void;
  selected: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const meta = BLOCK_META[block.type];
  const isPayment = block.type === "payment";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-1 rounded-2xl border bg-white py-1.5 pl-1 pr-1.5 transition-shadow",
        isDragging ? "z-10 border-ink shadow-lift" : "border-black/8 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        selected && "border-ink ring-1 ring-ink",
        block.hidden && "bg-surface/60",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${meta.label}`}
        className="grid h-9 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-muted hover:bg-surface hover:text-ink active:cursor-grabbing"
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>

      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(block.id)}
          aria-pressed={selected}
          className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left"
        >
          <RowLabel label={meta.label} hint={meta.hint} hidden={block.hidden} />
        </button>
      ) : (
        <div className="min-w-0 flex-1 px-1">
          <RowLabel label={meta.label} hint={meta.hint} hidden={block.hidden} />
        </div>
      )}

      {isPayment ? (
        <span className="grid h-9 w-9 place-items-center text-muted" title="Always shown">
          <Lock size={16} aria-hidden="true" />
          <span className="sr-only">Payment block is always shown</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onToggle(block.id)}
          aria-pressed={!block.hidden}
          aria-label={`${block.hidden ? "Show" : "Hide"} ${meta.label}`}
          className="grid h-9 w-9 place-items-center rounded-xl text-muted-strong hover:bg-surface hover:text-ink"
        >
          {block.hidden ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      )}

      {onRemove && meta.removable && (
        <button
          type="button"
          onClick={() => onRemove(block.id)}
          aria-label={`Remove ${meta.label}`}
          className="grid h-9 w-9 place-items-center rounded-xl text-muted-strong hover:bg-surface hover:text-orange-deep"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

function RowLabel({ label, hint, hidden }: { label: string; hint: string; hidden: boolean }) {
  return (
    <span className={cn("block leading-tight", hidden && "opacity-50")}>
      <span className="block text-sm font-semibold">{label}</span>
      <span className="block truncate text-xs text-muted">{hint}</span>
    </span>
  );
}
