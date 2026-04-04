import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Maximize, Minimize, Pencil, Plus, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import BingoModal from "../../components/bingoals/BingoModal";
import type { MediaItem, Objective, Subobjective } from "../../lib/bingoals/db";
import {
  addImage,
  addLink,
  addManualTimeDelta,
  addQuote,
  addTimeSession,
  createSubobjective,
  deleteMediaItem,
  deleteSubobjective,
  getObjective,
  getTimeStatsForSubobjectives,
  listMediaForSubobjectives,
  listSubobjectives,
  setSubobjectiveTotalTime,
  updateObjective,
  updateSubobjective
} from "../../lib/bingoals/db";
import { clamp01, daysAgo } from "../../lib/bingoals/format";
import { fileToCompressedDataUrl } from "../../lib/bingoals/image";
import { computeObjectivePercent } from "../../lib/bingoals/progress";
import { useTranslation } from "../../lib/i18n";
import { playSFX, SFX } from "../../lib/sounds";

function computeAutoDone(s: Subobjective) {
  const hasTarget = (s.target_total ?? 0) > 0;
  const autoDone = hasTarget
    ? (s.progress_current ?? 0) >= (s.target_total ?? 0)
    : !!s.is_done;
  return { hasTarget, autoDone };
}

function formatDaysAgo(d: number | null, t: (k: string) => string) {
  if (d === null) return "—";
  if (d <= 0) return t('bingoals.today');
  if (d === 1) return t('bingoals.yesterday');
  return t('bingoals.days_ago').replace('{n}', String(d));
}

export default function BingoObjectivePage() {
  const { id } = useParams<{ id: string }>();
  const objectiveId = id!;
  const { t } = useTranslation();

  const [obj, setObj] = useState<Objective | null>(null);
  const [subs, setSubs] = useState<Subobjective[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [timeMap, setTimeMap] = useState<Map<string, { total_ms: number; last_end: number | null }>>(new Map());
  const [playingSubId, setPlayingSubId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [running, setRunning] = useState<{ subId: string; startedAt: number } | null>(null);

  async function reload() {
    const o = await getObjective(objectiveId);
    const s = await listSubobjectives(objectiveId);
    const ids = s.map((x) => x.id);
    const tStats = await getTimeStatsForSubobjectives(ids);
    const m = await listMediaForSubobjectives(ids);
    setObj(o);
    setSubs(s);
    setTimeMap(tStats);
    setMedia(m);
    setPlayingSubId((prev) => (prev && s.some((x) => x.id === prev) ? prev : null));
  }

  useEffect(() => { void reload(); }, [objectiveId]);

  async function stopTimerIfRunning() {
    if (!running) return;
    const endedAt = Date.now();
    await addTimeSession(running.subId, running.startedAt, endedAt);
    setRunning(null);
    await reload();
  }

  useEffect(() => {
    return () => { void stopTimerIfRunning(); };
  }, [running?.subId]);

  const percent = useMemo(() => {
    if (!obj) return null;
    return computeObjectivePercent(obj, subs);
  }, [obj, subs]);

  const percentText = percent === null ? "—" : `${Math.round(percent * 100)}%`;

  const mediaBySub = useMemo(() => {
    const map = new Map<string, MediaItem[]>();
    for (const item of media) {
      const arr = map.get(item.subobjective_id) ?? [];
      arr.push(item);
      map.set(item.subobjective_id, arr);
    }
    return map;
  }, [media]);

  if (!obj) {
    return (
      <div className="bingoals-root fade-in">
        <div className="page-header">
          <div className="page-title-group">
            <Link to="/bingoals" className="btn btn-icon" aria-label={t('bingoals.back')}>
              <ArrowLeft size={20} />
            </Link>
            <h1 className="page-header-title">{t('bingoals.page_title')}</h1>
          </div>
        </div>
        <div className="muted">{t('bingoals.loading')}</div>
      </div>
    );
  }

  return (
    <div className="bingoals-root fade-in">
      <div className="page-header">
          <div className="page-title-group">
            <Link to="/bingoals" className="btn btn-icon" aria-label={t('bingoals.back')}>
              <ArrowLeft size={20} />
            </Link>
            <h1 className="page-header-title">{obj.title}</h1>
          </div>
          <button className="btn btn-primary" onMouseEnter={() => playSFX(SFX.HOVER)} onClick={() => setAddOpen(true)}>{t('bingoals.add_subobjective')}</button>
        </div>

        <div className="panel">
          <div className="row bingo-panel-header-row">
            <div className="muted">{t('bingoals.goal_prefix')} {obj.goal_target ?? "—"} {obj.goal_unit ?? ""}</div>
            <div className="pill">{percentText}</div>
          </div>

          {(obj.goal_kind === "metric" || obj.goal_kind === "amount" || obj.goal_kind === "manual") && (
            <div className="form bingo-form-mt">
              <label htmlFor="obj-current">{t('bingoals.current_value_label')}</label>
              <input
                id="obj-current"
                type="number"
                value={obj.current_value ?? 0}
                onChange={async (e) => {
                  const v = Number(e.target.value);
                  setObj({ ...obj, current_value: v });
                  await updateObjective(obj.id, { current_value: v });
                }}
              />
            </div>
          )}

          <div className="bar bingo-bar-mt">
            <div className="barFill" style={{ width: `${(percent ?? 0) * 100}%` }} />
          </div>
        </div>

        <div className="list">
          {subs.map((s) => {
            const timeStats = timeMap.get(s.id) ?? { total_ms: 0, last_end: null };
            const subMedia = mediaBySub.get(s.id) ?? [];
            return (
              <SubobjectivePanel
                key={s.id}
                s={s}
                timeStats={timeStats}
                subs={subs}
                setSubs={setSubs}
                running={running}
                playingSubId={playingSubId}
                setPlayingSubId={setPlayingSubId}
                subMedia={subMedia}
                reload={reload}
                stopTimerIfRunning={stopTimerIfRunning}
                setRunning={setRunning}
              />
            );
          })}
        </div>

        <button className="btn bingo-add-sub-bottom" onMouseEnter={() => playSFX(SFX.HOVER)} onClick={() => setAddOpen(true)}>
          {t('bingoals.add_subobjective')}
        </button>

        <AddSubobjectiveModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          objective={obj}
          onAdded={async () => { setAddOpen(false); await reload(); }}
        />
    </div>
  );
}

function AddSubobjectiveModal(props: {
  open: boolean;
  onClose: () => void;
  objective: Objective;
  onAdded: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
  const [total, setTotal] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (props.open) { setTitle(""); setUnit(props.objective.goal_unit ?? ""); setTotal(1); }
  }, [props.open, props.objective.goal_unit]);

  return (
    <BingoModal open={props.open} title={t('bingoals.add_sub_modal_title')} onClose={props.onClose}>
      <div className="form">
        <label htmlFor="bingo-sub-title">{t('bingoals.title_label')}</label>
        <input id="bingo-sub-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Book: The Stranger" />

        <label htmlFor="bingo-sub-total">{t('bingoals.sub_total_label')}</label>
        <input id="bingo-sub-total" type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} />

        <label htmlFor="bingo-sub-unit">{t('bingoals.unit_label')}</label>
        <input id="bingo-sub-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="chapters / lessons / etc." />

        <div className="row">
          <button className="btn" onClick={props.onClose}>{t('bingoals.cancel')}</button>
          <button
            className="btn btn-primary"
            disabled={busy || title.trim().length === 0}
            onClick={async () => {
              setBusy(true);
              try {
                await createSubobjective(props.objective.id, title.trim(), unit.trim() || null, total || null);
                playSFX(SFX.BINGO_ADD);
                props.onAdded();
              } finally { setBusy(false); }
            }}
          >
            {busy ? t('bingoals.adding') : t('bingoals.add')}
          </button>
        </div>
      </div>
    </BingoModal>
  );
}

function AddQuoteModal(props: { open: boolean; onClose: () => void; onAdd: (quote: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  useEffect(() => { if (props.open) setText(""); }, [props.open]);
  return (
    <BingoModal open={props.open} title={t('bingoals.add_quote_modal_title')} onClose={props.onClose}>
      <div className="form">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('bingoals.quote_placeholder')}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) props.onAdd(text.trim()); }}
          autoFocus
        />
        <div className="row">
          <button className="btn" onClick={props.onClose}>{t('bingoals.cancel')}</button>
          <button className="btn btn-primary" disabled={!text.trim()} onClick={() => props.onAdd(text.trim())}>
            {t('bingoals.add')}
          </button>
        </div>
      </div>
    </BingoModal>
  );
}

function AddLinkModal(props: { open: boolean; onClose: () => void; onAdd: (url: string, label: string) => void }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  useEffect(() => { if (props.open) { setUrl(""); setLabel(""); } }, [props.open]);
  const canAdd = url.trim().length > 0;
  return (
    <BingoModal open={props.open} title={t('bingoals.add_link_modal_title')} onClose={props.onClose}>
      <div className="form">
        <label>{t('bingoals.link_url_label')}</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('bingoals.link_url_placeholder')}
          type="url"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && canAdd) props.onAdd(url.trim(), label.trim()); }}
        />
        <label>{t('bingoals.link_label_label')}</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('bingoals.link_label_placeholder')}
          onKeyDown={(e) => { if (e.key === "Enter" && canAdd) props.onAdd(url.trim(), label.trim()); }}
        />
        <div className="row">
          <button className="btn" onClick={props.onClose}>{t('bingoals.cancel')}</button>
          <button className="btn btn-primary" disabled={!canAdd} onClick={() => props.onAdd(url.trim(), label.trim())}>
            {t('bingoals.add')}
          </button>
        </div>
      </div>
    </BingoModal>
  );
}

const SubobjectivePanel = memo(function SubobjectivePanel(props: {
  s: Subobjective;
  timeStats: { total_ms: number; last_end: number | null };
  subs: Subobjective[];
  setSubs: React.Dispatch<React.SetStateAction<Subobjective[]>>;
  running: { subId: string; startedAt: number } | null;
  playingSubId: string | null;
  setPlayingSubId: React.Dispatch<React.SetStateAction<string | null>>;
  subMedia: MediaItem[];
  reload: () => Promise<void>;
  stopTimerIfRunning: () => Promise<void>;
  setRunning: React.Dispatch<React.SetStateAction<{ subId: string; startedAt: number } | null>>;
}) {
  const { s, timeStats, subs, setSubs, running, playingSubId, setPlayingSubId, subMedia, reload, stopTimerIfRunning, setRunning } = props;
  const { t } = useTranslation();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [timeEditOpen, setTimeEditOpen] = useState(false);
  const [timeEditMs, setTimeEditMs] = useState(0);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isEditingCount, setIsEditingCount] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const last = Math.max(timeStats.last_end ?? 0, s.updated_at ?? 0) || null;
  const d = daysAgo(last);
  const initRunningExtra = running?.subId === s.id ? Math.max(0, Date.now() - running.startedAt) : 0;
  const initialTotalMs = (timeStats.total_ms ?? 0) + initRunningExtra;
  const { hasTarget, autoDone } = computeAutoDone(s);
  const ratio = hasTarget && (s.target_total ?? 0) > 0
    ? clamp01((s.progress_current ?? 0) / (s.target_total ?? 0))
    : autoDone ? 1 : 0;
  const isPlaying = playingSubId === s.id;
  const isRunning = running?.subId === s.id;

  // Compute adaptive tick count: find smallest "nice" step giving ≤ 20 ticks
  const tickCount = (() => {
    const target = s.target_total ?? 0;
    if (target <= 0) return 10;
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 250, 500, 1000];
    for (const step of steps) {
      const ticks = Math.ceil(target / step);
      if (ticks <= 20) return ticks;
    }
    return Math.ceil(target / 20);
  })();

  return (
    <div className={`panel ${autoDone ? "panelDone" : ""} ${isRunning ? "panelRecording" : ""}`}>
      <div className="row bingo-panel-header-row">
        {isEditingTitle ? (
          <input
            className="titleInput"
            aria-label={t('bingoals.sub_title_aria')}
            value={s.title}
            autoFocus
            onChange={(e) => setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
            onBlur={async () => {
              setIsEditingTitle(false);
              const fresh = subs.find((x) => x.id === s.id);
              if (fresh) await updateSubobjective(s.id, { title: fresh.title });
              await reload();
            }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
          />
        ) : (
          <div
            className="titleDisplay"
            onClick={() => setIsEditingTitle(true)}
            role="button"
            tabIndex={0}
            aria-label={t('bingoals.sub_title_aria')}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsEditingTitle(true); }}
          >
            {s.title}
          </div>
        )}
        <div className="pill">{Math.round(ratio * 100)}%</div>
      </div>

      <div className="bingo-panel-body">
      <div className="bingo-panel-left">
        {/* Instrument face: big timer display */}
        <div className="bingo-instrument-face">
          <TimerDisplay
            totalMs={initialTotalMs}
            isRunning={isRunning}
            startedAt={isRunning ? running!.startedAt : null}
            className="bingo-instrument-timer"
          />
          <button
            className="btn btn-icon bingo-instrument-edit"
            onMouseEnter={() => playSFX(SFX.HOVER)}
            onClick={async (e) => {
              e.stopPropagation();
              await stopTimerIfRunning();
              const ms = (timeStats.total_ms ?? 0) + (running?.subId === s.id ? Math.max(0, Date.now() - running.startedAt) : 0);
              setTimeEditMs(ms);
              setTimeEditOpen(true);
            }}
            title={t('bingoals.time_edit_title')}
            aria-label={t('bingoals.time_edit_title')}
          >
            <Pencil size={12} />
          </button>
          <button
            className="btn btn-icon bingo-instrument-quick-add"
            onMouseEnter={() => playSFX(SFX.HOVER)}
            onClick={(e) => { e.stopPropagation(); setQuickAddOpen(true); }}
            title={t('bingoals.quick_add_title')}
            aria-label={t('bingoals.quick_add_title')}
          >
            <Plus size={12} />
          </button>
        </div>

        {/* START / STOP — physical button */}
        {isRunning ? (
          <button className="btn btn-danger bingo-start-btn" onClick={() => { playSFX(SFX.CANCEL); stopTimerIfRunning(); }} onMouseEnter={() => playSFX(SFX.HOVER)} title={t('bingoals.stop')}>
            <span className="bingo-stop-square" aria-hidden="true" />
            {t('bingoals.stop')}
          </button>
        ) : (
          <button className="btn btn-primary bingo-start-btn" onClick={async () => { playSFX(SFX.SESSION_START); await stopTimerIfRunning(); setRunning({ subId: s.id, startedAt: Date.now() }); }} onMouseEnter={() => playSFX(SFX.HOVER)}>
            <span className="bingo-rec-dot" aria-hidden="true" />
            {t('bingoals.start')}
          </button>
        )}

        {/* Count display: large number + target/unit caption */}
        <div className="bingo-count-block">
          {isEditingCount ? (
            <input
              className="numInput bingo-count-input"
              type="number"
              autoFocus
              aria-label={t('bingoals.aria_current')}
              value={s.progress_current ?? 0}
              onChange={(e) => { const v = Number(e.target.value); setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, progress_current: v } : x))); }}
              onBlur={async () => {
                setIsEditingCount(false);
                const fresh = subs.find((x) => x.id === s.id);
                if (!fresh) return;
                const { hasTarget, autoDone } = computeAutoDone(fresh);
                await updateSubobjective(s.id, { progress_current: fresh.progress_current, is_done: hasTarget ? (autoDone ? 1 : 0) : fresh.is_done });
                await reload();
              }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
            />
          ) : (
            <div
              className="bingo-count-value"
              onClick={() => setIsEditingCount(true)}
              role="button"
              tabIndex={0}
              aria-label={t('bingoals.aria_current')}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsEditingCount(true); }}
            >
              {s.progress_current ?? 0}
            </div>
          )}
          <div className="bingo-count-caption">
            <span>/</span>
            <input
              className="numInput bingo-target-caption"
              type="number"
              aria-label={t('bingoals.aria_target')}
              value={s.target_total ?? 0}
              onChange={(e) => { const v = Number(e.target.value); setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, target_total: v } : x))); }}
              onBlur={async () => {
                const fresh = subs.find((x) => x.id === s.id);
                if (!fresh) return;
                const { hasTarget, autoDone } = computeAutoDone(fresh);
                await updateSubobjective(s.id, { target_total: fresh.target_total, is_done: hasTarget ? (autoDone ? 1 : 0) : fresh.is_done });
                await reload();
              }}
            />
            <input
              className="unitInput bingo-unit-caption"
              aria-label={t('bingoals.unit_label')}
              value={s.unit ?? ""}
              placeholder={t('bingoals.unit_placeholder')}
              onChange={(e) => setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, unit: e.target.value } : x)))}
              onBlur={async () => {
                const fresh = subs.find((x) => x.id === s.id);
                if (fresh) await updateSubobjective(s.id, { unit: fresh.unit?.trim() || null });
                await reload();
              }}
            />
          </div>
        </div>

        {/* Wide [−] [+] tap buttons */}
        <div className="bingo-tap-strip">
          <button
            className="bingo-tap-btn"
            aria-label={t('bingoals.decrement')}
            onMouseEnter={() => playSFX(SFX.HOVER)}
            onClick={async () => {
              const fresh = subs.find((x) => x.id === s.id);
              if (!fresh) return;
              const next = Math.max(0, (fresh.progress_current ?? 0) - 1);
              playSFX(SFX.CANCEL);
              setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, progress_current: next } : x)));
              const { hasTarget: ht, autoDone: ad } = computeAutoDone({ ...fresh, progress_current: next });
              await updateSubobjective(s.id, { progress_current: next, is_done: ht ? (ad ? 1 : 0) : fresh.is_done });
              await reload();
            }}
          >−</button>
          <button
            className="bingo-tap-btn"
            aria-label={t('bingoals.increment')}
            onMouseEnter={() => playSFX(SFX.HOVER)}
            onClick={async () => {
              const fresh = subs.find((x) => x.id === s.id);
              if (!fresh) return;
              const next = (fresh.progress_current ?? 0) + 1;
              const { hasTarget: ht, autoDone: ad } = computeAutoDone({ ...fresh, progress_current: next });
              playSFX(ad ? SFX.BINGO_COMPLETE : SFX.BINGO_CHECK);
              setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, progress_current: next } : x)));
              await updateSubobjective(s.id, { progress_current: next, is_done: ht ? (ad ? 1 : 0) : fresh.is_done });
              await reload();
            }}
          >+</button>
        </div>

        {/* Tick-mark progress bar — tick count adapts to target */}
        <div className="bingo-tick-bar" style={{ '--bingo-ticks': tickCount } as React.CSSProperties}>
          <div className="bingo-tick-fill" style={{ '--bingo-fill': `${ratio * 100}%` } as React.CSSProperties} />
        </div>

        {/* Footer: last practiced + done + delete */}
        <div className="bingo-instrument-footer">
          <span className="muted">{formatDaysAgo(d, t)}</span>
          <div className="row bingo-sub-actions">
            <button className="btn bingo-mark-done-btn" onMouseEnter={() => playSFX(SFX.HOVER)} onClick={async () => {
              if (hasTarget) {
                const next = autoDone ? Math.max(0, (s.target_total ?? 1) - 1) : (s.target_total ?? 1);
                const { autoDone: ad } = computeAutoDone({ ...s, progress_current: next });
                playSFX(ad ? SFX.BINGO_COMPLETE : SFX.BINGO_CHECK);
                setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, progress_current: next } : x)));
                await updateSubobjective(s.id, { progress_current: next, is_done: ad ? 1 : 0 });
              } else {
                playSFX(s.is_done ? SFX.CANCEL : SFX.BINGO_COMPLETE);
                await updateSubobjective(s.id, { is_done: s.is_done ? 0 : 1 });
              }
              await reload();
            }}>
              {(autoDone || (!hasTarget && s.is_done)) ? t('bingoals.undone') : t('bingoals.done')}
            </button>
            {deleteConfirm ? (
              <>
                <button className="btn btn-danger" onClick={async () => {
                  if (running?.subId === s.id) await stopTimerIfRunning();
                  if (playingSubId === s.id) setPlayingSubId(null);
                  await deleteSubobjective(s.id);
                  await reload();
                }}>{t('bingoals.yes_delete')}</button>
                <button className="btn" onClick={() => setDeleteConfirm(false)}>{t('bingoals.cancel')}</button>
              </>
            ) : (
              <button className="btn-icon bingo-delete-btn" onMouseEnter={() => playSFX(SFX.HOVER)} onClick={() => setDeleteConfirm(true)} aria-label={t('bingoals.delete')}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="bingo-panel-right">
      <div className="memories">
        <div className="row bingo-panel-header-row">
          <div className="muted bingo-section-label">{t('bingoals.memories_label')}</div>
          <div className="memories-actions">
            <button className="btn bingo-memory-action-btn" onMouseEnter={() => playSFX(SFX.HOVER)} onClick={() => setQuoteOpen(true)}>{t('bingoals.add_quote')}</button>
            <button className="btn bingo-memory-action-btn" onMouseEnter={() => playSFX(SFX.HOVER)} onClick={() => setLinkOpen(true)}>{t('bingoals.add_link')}</button>

            <label className="btn bingo-memory-action-btn" onMouseEnter={() => playSFX(SFX.HOVER)}>
              {t('bingoals.add_images')}
              <input
                type="file"
                accept="image/*"
                multiple
                className="bingo-file-input"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length === 0) return;
                  await stopTimerIfRunning();
                  for (const file of files) {
                    const dataUrl = await fileToCompressedDataUrl(file);
                    await addImage(s.id, dataUrl);
                    await new Promise((r) => setTimeout(r, 0));
                  }
                  e.currentTarget.value = "";
                  await reload();
                }}
              />
            </label>

            {(() => {
              const slideCount = subMedia.filter(m => m.kind !== "link").length;
              return (
                <button
                  className="btn bingo-memories-play"
                  disabled={slideCount < 2}
                  title={slideCount < 2 ? t('bingoals.play_requires_two') : undefined}
                  onMouseEnter={() => playSFX(SFX.HOVER)}
                  onClick={() => setPlayingSubId((prev) => (prev === s.id ? null : s.id))}
                >
                  {isPlaying ? t('bingoals.pause') : t('bingoals.play')}
                </button>
              );
            })()}
          </div>
        </div>

        {(() => {
          const linkItems = subMedia.filter(m => m.kind === "link");
          const slideItems = subMedia.filter(m => m.kind !== "link");
          return (
            <>
              {linkItems.length > 0 && (
                <div className="bingo-links-row">
                  {linkItems.map(item => {
                    const parsed = (() => { try { return JSON.parse(item.data); } catch { return { url: item.data, label: "" }; } })();
                    return (
                      <div key={item.id} className="bingo-link-pill">
                        <button
                          className="bingo-link-pill-btn"
                          onClick={() => openExternal(parsed.url)}
                          title={parsed.url}
                        >
                          <ExternalLink size={12} />
                          {parsed.label || parsed.url}
                        </button>
                        <button
                          className="bingo-link-pill-delete"
                          onClick={async () => { await deleteMediaItem(item.id); await reload(); }}
                          aria-label={t('bingoals.delete')}
                        >×</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <Slideshow
                items={slideItems}
                playing={isPlaying}
                onRequestStop={() => setPlayingSubId(null)}
                onDelete={async (mediaId) => { await deleteMediaItem(mediaId); await reload(); }}
              />
            </>
          );
        })()}
      </div>
      </div>
      </div>

      <AddQuoteModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        onAdd={async (quote) => {
          setQuoteOpen(false);
          await addQuote(s.id, quote);
          await reload();
        }}
      />

      <AddLinkModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        onAdd={async (url, label) => {
          setLinkOpen(false);
          await addLink(s.id, url, label);
          await reload();
        }}
      />

      <TimeEditModal
        open={timeEditOpen}
        initialMs={timeEditMs}
        onSave={async (ms) => { setTimeEditOpen(false); await setSubobjectiveTotalTime(s.id, ms); await reload(); }}
        onClose={() => setTimeEditOpen(false)}
      />

      <QuickAddTimeModal
        open={quickAddOpen}
        onSave={async (deltaMs) => { setQuickAddOpen(false); if (deltaMs > 0) { await addManualTimeDelta(s.id, deltaMs); await reload(); } }}
        onClose={() => setQuickAddOpen(false)}
      />
    </div>
  );
}, (prev, next) => {
  return prev.s === next.s && prev.timeStats === next.timeStats && prev.running === next.running &&
    prev.playingSubId === next.playingSubId && prev.subMedia === next.subMedia;
});

function Slideshow(props: {
  items: MediaItem[];
  playing: boolean;
  onRequestStop: () => void;
  onDelete: (mediaId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const [deleteMediaId, setDeleteMediaId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const slideRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    setI((prev) => Math.min(prev, Math.max(0, props.items.length - 1)));
  }, [props.items.length]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !("IntersectionObserver" in window)) { setInView(true); return; }
    const obs = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35, rootMargin: "200px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!props.playing || !inView || props.items.length < 2) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % props.items.length), 2000);
    return () => window.clearInterval(id);
  }, [props.playing, inView, props.items.length]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (props.items.length === 0) {
    return <div className="muted bingo-mt-sm">{t('bingoals.no_memories')}</div>;
  }

  const safeIndex = Math.max(0, Math.min(i, props.items.length - 1));
  const item = props.items[safeIndex];

  return (
    <div className="slideshow" ref={rootRef}>
      <div className="slide" ref={slideRef}>
        <button
          className="mediaTrashBtn"
          title={t('bingoals.delete')}
          onClick={() => { props.onRequestStop(); setDeleteMediaId(item.id); }}
        ><Trash2 size={16} /></button>
        <button
          className="mediaFullscreenBtn"
          title={isFullscreen ? t('bingoals.fullscreen_exit') : t('bingoals.fullscreen')}
          aria-label={isFullscreen ? t('bingoals.fullscreen_exit') : t('bingoals.fullscreen')}
          onClick={async () => {
            if (document.fullscreenElement) {
              await document.exitFullscreen();
            } else {
              await slideRef.current?.requestFullscreen();
            }
          }}
        >{isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}</button>

        <div key={item.id} className="mediaFade">
          {item.kind === "image" ? (
            <img className="slideImg" src={item.data} alt="memory" />
          ) : item.kind === "link" ? (
            (() => {
              const parsed = (() => { try { return JSON.parse(item.data); } catch { return { url: item.data, label: "" }; } })();
              return (
                <div className="bingo-link-card">
                  <div className="bingo-link-label">{parsed.label || parsed.url}</div>
                  {parsed.label && <div className="bingo-link-url">{parsed.url}</div>}
                  <button className="btn btn-primary bingo-link-open-btn" onClick={() => openExternal(parsed.url)}>
                    <ExternalLink size={16} />
                    {t('bingoals.open_link')}
                  </button>
                </div>
              );
            })()
          ) : (
            <div className="quote">"{item.data}"</div>
          )}
        </div>
      </div>

      <div className="row bingo-slideshow-nav">
        <button className="btn" onClick={() => { props.onRequestStop(); setI((x) => (x - 1 + props.items.length) % props.items.length); }}>{t('bingoals.prev')}</button>
        <div className="muted">{safeIndex + 1} / {props.items.length}{props.playing && inView ? ` • ${t('bingoals.playing')}` : ""}</div>
        <button className="btn" onClick={() => { props.onRequestStop(); setI((x) => (x + 1) % props.items.length); }}>{t('bingoals.next')}</button>
      </div>

      <BingoModal open={deleteMediaId !== null} title={t('bingoals.delete')} onClose={() => setDeleteMediaId(null)}>
        <div className="form">
          <div>{t('bingoals.delete_media_confirm')}</div>
          <div className="row">
            <button className="btn" onClick={() => setDeleteMediaId(null)}>{t('bingoals.cancel')}</button>
            <button className="btn btn-danger" onClick={async () => {
              const id = deleteMediaId!;
              setDeleteMediaId(null);
              await props.onDelete(id);
            }}>{t('bingoals.yes_delete')}</button>
          </div>
        </div>
      </BingoModal>
    </div>
  );
}

function TimerDisplay(props: { totalMs: number; isRunning: boolean; startedAt: number | null; className?: string }) {
  const [displayMs, setDisplayMs] = useState(props.totalMs);

  useEffect(() => {
    if (!props.isRunning || !props.startedAt) { setDisplayMs(props.totalMs); return; }
    const id = window.setInterval(() => setDisplayMs(props.totalMs + Math.max(0, Date.now() - props.startedAt!)), 500);
    setDisplayMs(props.totalMs + Math.max(0, Date.now() - props.startedAt!));
    return () => window.clearInterval(id);
  }, [props.isRunning, props.startedAt, props.totalMs]);

  return <div className={props.className}>{msToHHMMSS(displayMs)}</div>;
}

function msToHHMMSS(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function TimeEditModal(props: { open: boolean; initialMs: number; onSave: (ms: number) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [s, setS] = useState("");
  const hRef = useRef<HTMLInputElement>(null);
  const mRef = useRef<HTMLInputElement>(null);
  const sRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!props.open) return;
    const totalSec = Math.floor(props.initialMs / 1000);
    setH(String(Math.floor(totalSec / 3600)).padStart(2, "0"));
    setM(String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0"));
    setS(String(totalSec % 60).padStart(2, "0"));
    setTimeout(() => hRef.current?.select(), 50);
  }, [props.open, props.initialMs]);

  function save() {
    const hh = parseInt(h || "0", 10);
    const mm = parseInt(m || "0", 10);
    const ss = parseInt(s || "0", 10);
    if (isNaN(hh) || isNaN(mm) || isNaN(ss) || mm > 59 || ss > 59) return;
    props.onSave(((hh * 60 + mm) * 60 + ss) * 1000);
  }

  return (
    <BingoModal open={props.open} title={t('bingoals.time_edit_title')} onClose={props.onClose}>
      <div className="bingo-time-edit-body">
        <div className="bingo-time-edit-fields">
          <div className="bingo-time-edit-col">
            <input ref={hRef} type="text" inputMode="numeric" value={h} className="bingo-time-field" onFocus={(e) => e.target.select()}
              onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 3); setH(val); if (val.length === 3) mRef.current?.select(); }}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") props.onClose(); }} />
            <span className="muted">HH</span>
          </div>
          <span className="bingo-time-sep">:</span>
          <div className="bingo-time-edit-col">
            <input ref={mRef} type="text" inputMode="numeric" value={m} className="bingo-time-field" onFocus={(e) => e.target.select()}
              onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 2); setM(val); if (val.length === 2) sRef.current?.select(); }}
              onKeyDown={(e) => { if (e.key === "Backspace" && m === "") hRef.current?.select(); if (e.key === "Enter") save(); if (e.key === "Escape") props.onClose(); }} />
            <span className="muted">MM</span>
          </div>
          <span className="bingo-time-sep">:</span>
          <div className="bingo-time-edit-col">
            <input ref={sRef} type="text" inputMode="numeric" value={s} className="bingo-time-field" onFocus={(e) => e.target.select()}
              onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 2); setS(val); }}
              onKeyDown={(e) => { if (e.key === "Backspace" && s === "") mRef.current?.select(); if (e.key === "Enter") save(); if (e.key === "Escape") props.onClose(); }} />
            <span className="muted">SS</span>
          </div>
        </div>
        <div className="row bingo-row-end">
          <button className="btn" onClick={props.onClose}>{t('bingoals.cancel')}</button>
          <button className="btn btn-primary" onClick={save}>{t('bingoals.save')}</button>
        </div>
      </div>
    </BingoModal>
  );
}

function QuickAddTimeModal(props: { open: boolean; onSave: (deltaMs: number) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [s, setS] = useState("");
  const hRef = useRef<HTMLInputElement>(null);
  const mRef = useRef<HTMLInputElement>(null);
  const sRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!props.open) return;
    setH(""); setM(""); setS("");
    setTimeout(() => mRef.current?.focus(), 50);
  }, [props.open]);

  function save() {
    const hh = parseInt(h || "0", 10);
    const mm = parseInt(m || "0", 10);
    const ss = parseInt(s || "0", 10);
    if (isNaN(hh) || isNaN(mm) || isNaN(ss) || mm > 59 || ss > 59) return;
    props.onSave(((hh * 60 + mm) * 60 + ss) * 1000);
  }

  return (
    <BingoModal open={props.open} title={t('bingoals.quick_add_title')} onClose={props.onClose}>
      <div className="bingo-time-edit-body">
        <div className="bingo-time-edit-fields">
          <div className="bingo-time-edit-col">
            <input ref={hRef} type="text" inputMode="numeric" value={h} className="bingo-time-field" placeholder="0" onFocus={(e) => e.target.select()}
              onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 3); setH(val); if (val.length === 3) mRef.current?.select(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") props.onClose(); }} />
            <span className="muted">HH</span>
          </div>
          <span className="bingo-time-sep">:</span>
          <div className="bingo-time-edit-col">
            <input ref={mRef} type="text" inputMode="numeric" value={m} className="bingo-time-field" placeholder="0" onFocus={(e) => e.target.select()}
              onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 2); setM(val); if (val.length === 2) sRef.current?.select(); }}
              onKeyDown={(e) => { if (e.key === "Backspace" && m === "") hRef.current?.select(); if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") props.onClose(); }} />
            <span className="muted">MM</span>
          </div>
          <span className="bingo-time-sep">:</span>
          <div className="bingo-time-edit-col">
            <input ref={sRef} type="text" inputMode="numeric" value={s} className="bingo-time-field" placeholder="0" onFocus={(e) => e.target.select()}
              onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 2); setS(val); }}
              onKeyDown={(e) => { if (e.key === "Backspace" && s === "") mRef.current?.select(); if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") props.onClose(); }} />
            <span className="muted">SS</span>
          </div>
        </div>
        <div className="row bingo-row-end">
          <button className="btn" onClick={props.onClose}>{t('bingoals.cancel')}</button>
          <button className="btn btn-primary" onClick={save}>{t('bingoals.quick_add_confirm')}</button>
        </div>
      </div>
    </BingoModal>
  );
}
