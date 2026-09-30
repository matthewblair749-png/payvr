"use client";

/**
 * The Checkout Studio editor.
 *
 *  ┌ top bar: back · name · A/B · undo/redo · device · save status · versions · publish
 *  ├ left panel (tabs): Blocks | Theme | Product | Import
 *  └ canvas: live preview in a phone or desktop frame
 *
 * On small screens the panel and canvas become two tabs ("Edit" / "Preview").
 */
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { ArrowLeft, Check, CloudOff, FlaskConical, History, Loader2, Monitor, Plus, Redo2, Smartphone, Trash2, Undo2 } from "lucide-react";
import { addVariantAction, removeVariantAction, renamePageAction, saveDraftAction } from "@/app/studio/actions";
import { LogoMark } from "@/components/brand/logo";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { ScaledFrame } from "@/components/checkout/scaled-frame";
import { BlockList } from "@/components/editor/block-list";
import { Segmented } from "@/components/editor/controls";
import { ThemeControls } from "@/components/editor/theme-controls";
import { Button } from "@/components/ui/button";
import type { CheckoutConfig, CheckoutProduct } from "@/lib/checkout/schema";
import { cn } from "@/lib/utils";
import { AddBlockPalette, BlockInspector } from "./block-inspector";
import { ImportPanel } from "./import-panel";
import { ProductPanel } from "./product-panel";
import { PublishDialog } from "./publish-dialog";
import { useStudioState, type SaveStatus, type Target } from "./use-studio-state";
import { VersionsDialog, type VersionRow } from "./versions-dialog";

export type StudioInitial = {
  pageId: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedVersionId: string | null;
  configA: CheckoutConfig;
  configB: CheckoutConfig | null;
  experimentStatus: "DRAFT" | "RUNNING" | null;
  weightB: number;
  product: CheckoutProduct;
  versions: VersionRow[];
  appUrl: string;
};

type Tab = "blocks" | "theme" | "product" | "import";

export function StudioEditor({ initial }: { initial: StudioInitial }) {
  const save = useCallback(
    async (target: Target, config: CheckoutConfig) => {
      const res = await saveDraftAction({ pageId: initial.pageId, target, config });
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    [initial.pageId],
  );
  const studio = useStudioState({ A: initial.configA, B: initial.configB ?? undefined }, save);
  const { config, target, edit, dispatch } = studio;

  const [tab, setTab] = useState<Tab>("blocks");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [product, setProduct] = useState(initial.product);
  const [name, setName] = useState(initial.name);
  const [versions, setVersions] = useState(initial.versions);
  const [published, setPublished] = useState({ id: initial.publishedVersionId, slug: initial.slug, status: initial.status });
  const [experiment, setExperiment] = useState({ status: initial.experimentStatus, weightB: initial.weightB });
  const [dialog, setDialog] = useState<"versions" | "publish" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const selected = config.blocks.find((b) => b.id === selectedId) ?? null;

  // Keyboard: ⌘/Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo. Text fields keep native undo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 2500);
  }

  function addVariant() {
    start(async () => {
      // B starts as a copy of A's *saved* draft, so save first.
      if (!(await studio.flush())) return flash("Couldn't save your latest changes. Try again.");
      const res = await addVariantAction({ pageId: initial.pageId });
      if (!res.ok) return flash(res.error);
      studio.markPersisted("B", studio.configs.A);
      dispatch({ type: "setB", config: studio.configs.A });
      setExperiment({ status: "DRAFT", weightB: res.data.weightB });
      flash("Variant B created. Change anything to test it against A.");
    });
  }

  function removeVariant() {
    if (!confirm("Stop the A/B test and delete variant B?")) return;
    start(async () => {
      const res = await removeVariantAction({ pageId: initial.pageId });
      if (!res.ok) return flash(res.error);
      studio.markPersisted("B", undefined);
      dispatch({ type: "setB", config: undefined });
      setExperiment({ status: null, weightB: 50 });
    });
  }

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initial.name) return;
    start(async () => {
      const res = await renamePageAction({ pageId: initial.pageId, name: trimmed });
      if (!res.ok) flash(res.error);
    });
  }

  const preview = (
    <CheckoutView
      config={config}
      product={product}
      mode="preview"
      selectedBlockId={selectedId}
      onSelectBlock={(id) => {
        setSelectedId(id);
        setTab("blocks");
      }}
    />
  );

  return (
    <div className="flex h-dvh flex-col bg-surface">
      {/* ------------------------------------------------ Top bar */}
      <header className="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-black/8 bg-white px-3 sm:px-4">
        <Link href="/studio" aria-label="Back to all checkouts" className="flex items-center gap-1 rounded-xl p-1.5 hover:bg-surface">
          <ArrowLeft size={18} aria-hidden="true" />
          <LogoMark size={28} title="" />
        </Link>
        <label htmlFor="page-name" className="sr-only">
          Checkout name
        </label>
        <input
          id="page-name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-32 min-w-0 truncate rounded-lg px-2 py-1 font-display font-bold tracking-[-0.02em] hover:bg-surface focus:bg-surface focus:outline-none sm:w-52"
        />

        <VariantTabs
          target={target}
          hasB={!!studio.configs.B}
          running={experiment.status === "RUNNING"}
          onTarget={(t) => dispatch({ type: "setTarget", target: t })}
          onAdd={addVariant}
          onRemove={removeVariant}
          busy={pending}
        />

        <div className="ml-auto flex items-center gap-1">
          <div className="hidden items-center md:flex">
            <Button variant="ghost" size="icon" aria-label="Undo" title="Undo (⌘Z)" disabled={!studio.canUndo} onClick={() => dispatch({ type: "undo" })}>
              <Undo2 size={18} aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!studio.canRedo} onClick={() => dispatch({ type: "redo" })}>
              <Redo2 size={18} aria-hidden="true" />
            </Button>
          </div>
          <SaveIndicator status={studio.status} error={studio.saveError} />
          <Button variant="ghost" size="icon" aria-label="Versions" title="Versions" onClick={() => setDialog("versions")}>
            <History size={18} aria-hidden="true" />
          </Button>
          <Button variant="primary" size="sm" className="sm:h-10 sm:px-5" onClick={() => setDialog("publish")}>
            {published.status === "PUBLISHED" ? "Update" : "Publish"}
          </Button>
        </div>
      </header>

      {/* Mobile: switch between editing and previewing */}
      <div className="border-b border-black/8 bg-white px-3 py-2 lg:hidden">
        <Segmented
          label="View"
          className="[&_legend]:sr-only"
          value={mobileView}
          onChange={setMobileView}
          options={[
            { value: "edit", label: "Edit" },
            { value: "preview", label: "Preview" },
          ]}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ------------------------------------------------ Side panel */}
        <aside
          aria-label="Editor"
          className={cn(
            "flex w-full shrink-0 flex-col border-r border-black/8 bg-white lg:flex lg:w-[380px]",
            mobileView === "edit" ? "flex" : "hidden",
          )}
        >
          <div role="tablist" aria-label="Editor sections" className="flex gap-1 border-b border-black/8 px-3 pt-2">
            {(
              [
                ["blocks", "Blocks"],
                ["theme", "Theme"],
                ["product", "Product"],
                ["import", "Import"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                id={`tab-${key}`}
                role="tab"
                type="button"
                aria-selected={tab === key}
                aria-controls={`panel-${key}`}
                onClick={() => setTab(key)}
                className="relative px-3 py-2.5 text-sm font-semibold text-muted-strong aria-selected:text-ink"
              >
                {label}
                {tab === key && <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-orange" />}
              </button>
            ))}
          </div>

          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {target === "B" && (
              <p className="mb-4 rounded-xl bg-spark/60 px-3 py-2 text-xs font-semibold">
                Editing variant B. Changes here only affect visitors assigned to B.
              </p>
            )}
            {tab === "blocks" && (
              <div className="space-y-5">
                {selected && (
                  <BlockInspector
                    block={selected}
                    onChange={(props) => edit({ type: "updateBlock", id: selected.id, props })}
                    onClose={() => setSelectedId(null)}
                  />
                )}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                    Layers <span className="font-normal normal-case tracking-normal">· drag to reorder, click to edit</span>
                  </p>
                  <BlockList
                    blocks={config.blocks}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onReorder={(from, to) => edit({ type: "reorder", from, to })}
                    onToggle={(id) => edit({ type: "toggle", id })}
                    onRemove={(id) => {
                      edit({ type: "remove", id });
                      if (id === selectedId) setSelectedId(null);
                    }}
                  />
                </div>
                <AddBlockPalette onAdd={(blockType) => edit({ type: "add", blockType })} />
              </div>
            )}
            {tab === "theme" && (
              <div className="space-y-6">
                <ThemeControls config={config} dispatch={edit} />
                <LogoField value={config.brand.logoUrl} onChange={(logoUrl) => edit({ type: "brand", patch: { logoUrl } })} />
              </div>
            )}
            {tab === "product" && <ProductPanel pageId={initial.pageId} product={product} onChange={setProduct} />}
            {tab === "import" && (
              <ImportPanel
                onApply={(r) =>
                  dispatch({
                    type: "replace",
                    target,
                    config: {
                      ...config,
                      brand: { name: r.brandName, ...(r.logoUrl ? { logoUrl: r.logoUrl } : {}) },
                      theme: { ...config.theme, ...r.theme },
                    },
                  })
                }
                onUndo={() => dispatch({ type: "undo" })}
              />
            )}
          </div>
        </aside>

        {/* ------------------------------------------------ Canvas */}
        <main
          id="main"
          aria-label="Preview"
          className={cn("min-w-0 flex-1 flex-col overflow-y-auto lg:flex", mobileView === "preview" ? "flex" : "hidden")}
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-8">
            <p className="text-sm text-muted-strong">
              {target === "B" ? "Previewing variant B" : "Previewing your checkout"} · click a block to edit it
            </p>
            <Segmented
              label="Preview device"
              className="[&_legend]:sr-only"
              value={device}
              onChange={setDevice}
              options={[
                { value: "phone", label: <Smartphone size={16} className="mx-auto" />, srLabel: "Phone" },
                { value: "desktop", label: <Monitor size={16} className="mx-auto" />, srLabel: "Desktop" },
              ]}
            />
          </div>
          <div className="flex-1 p-4 sm:p-8">
            {device === "phone" ? (
              <div className="mx-auto max-w-[402px] rounded-[48px] bg-ink p-2.5 shadow-lift">
                <ScaledFrame width={382} height={760} label="Checkout preview, phone" className="rounded-[38px]">
                  <div className="h-full overflow-y-auto overscroll-contain">{preview}</div>
                </ScaledFrame>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[20px] bg-ink shadow-lift">
                <div className="flex items-center gap-1.5 px-4 py-3" aria-hidden="true">
                  <span className="h-3 w-3 rounded-full bg-white/25" />
                  <span className="h-3 w-3 rounded-full bg-white/25" />
                  <span className="h-3 w-3 rounded-full bg-white/25" />
                  <span className="ml-3 flex-1 truncate rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                    {initial.appUrl.replace(/^https?:\/\//, "")}/pay/{published.slug}
                  </span>
                </div>
                <ScaledFrame width={1280} height={820} label="Checkout preview, desktop">
                  <div className="h-full overflow-y-auto overscroll-contain">{preview}</div>
                </ScaledFrame>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Toast */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {notice && <p className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-lift">{notice}</p>}
      </div>

      <VersionsDialog
        open={dialog === "versions"}
        onClose={() => setDialog(null)}
        pageId={initial.pageId}
        versions={versions}
        publishedVersionId={published.id}
        onSaved={(v) => {
          setVersions((vs) => [v, ...vs]);
          flash(`Saved v${v.number}`);
        }}
        onRestored={(restored) => {
          studio.markPersisted("A", restored);
          dispatch({ type: "setTarget", target: "A" });
          dispatch({ type: "replace", target: "A", config: restored });
          flash("Version restored. Undo if you change your mind.");
        }}
      />
      <PublishDialog
        open={dialog === "publish"}
        onClose={() => setDialog(null)}
        pageId={initial.pageId}
        slug={published.slug}
        appUrl={initial.appUrl}
        hasVariant={!!studio.configs.B}
        weightB={experiment.weightB}
        onSplitChange={(weightB) => setExperiment((e) => ({ ...e, weightB }))}
        flushSave={studio.flush}
        onPublished={({ slug, version }) => {
          setPublished({ id: version.id, slug, status: "PUBLISHED" });
          setVersions((vs) => [version, ...vs]);
          if (studio.configs.B) setExperiment((e) => ({ ...e, status: "RUNNING" }));
        }}
      />
    </div>
  );
}

function VariantTabs({
  target,
  hasB,
  running,
  onTarget,
  onAdd,
  onRemove,
  busy,
}: {
  target: Target;
  hasB: boolean;
  running: boolean;
  onTarget: (t: Target) => void;
  onAdd: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  if (!hasB) {
    return (
      <Button variant="soft" size="sm" onClick={onAdd} disabled={busy} aria-label="Add an A/B test variant">
        <FlaskConical size={15} aria-hidden="true" />
        <span className="hidden sm:inline">A/B test</span>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <div role="group" aria-label="Variant being edited" className="flex rounded-full bg-surface p-1">
        {(["A", "B"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={target === t}
            onClick={() => onTarget(t)}
            className="rounded-full px-3 py-1 text-sm font-bold text-muted-strong aria-pressed:bg-white aria-pressed:text-ink aria-pressed:shadow-soft"
          >
            {t}
          </button>
        ))}
      </div>
      {running && (
        <span className="hidden items-center gap-1 rounded-full bg-spark px-2.5 py-1 text-xs font-bold sm:inline-flex">
          <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-deep" /> Live test
        </span>
      )}
      <Button variant="ghost" size="icon" aria-label="Stop A/B test and delete variant B" title="Delete variant B" onClick={onRemove} disabled={busy}>
        <Trash2 size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}

function SaveIndicator({ status, error }: { status: SaveStatus; error: string | null }) {
  const map = {
    saved: { icon: <Check size={14} aria-hidden="true" />, text: "Saved" },
    saving: { icon: <Loader2 size={14} aria-hidden="true" className="animate-spin" />, text: "Saving…" },
    unsaved: { icon: <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber" />, text: "Editing" },
    error: { icon: <CloudOff size={14} aria-hidden="true" />, text: "Not saved" },
  }[status];
  return (
    <span role="status" title={error ?? undefined} className={cn("hidden items-center gap-1.5 px-2 text-xs font-medium sm:flex", status === "error" ? "text-orange-deep" : "text-muted-strong")}>
      {map.icon}
      {map.text}
    </span>
  );
}

function LogoField({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor="logo-url" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
        Logo URL
      </label>
      <div className="flex gap-2">
        <input
          id="logo-url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://…/logo.png"
          inputMode="url"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "logo-err" : undefined}
          className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <Button
          variant="outline"
          size="md"
          onClick={() => {
            const v = draft.trim();
            if (!v) {
              setError(null);
              return onChange(undefined);
            }
            if (!/^https:\/\/\S+$/.test(v) || v.length > 500) return setError("Use an https:// image link");
            setError(null);
            onChange(v);
          }}
        >
          <Plus size={14} aria-hidden="true" /> Set
        </Button>
      </div>
      {error && (
        <p id="logo-err" role="alert" className="mt-1 text-xs text-orange-deep">
          {error}
        </p>
      )}
    </div>
  );
}
