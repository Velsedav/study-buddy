import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BingoModal from "../../components/bingoals/BingoModal";
import type { MediaItem, Objective, Subobjective } from "../../lib/bingoals/db";
import {
  addImage,
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

function computeAutoDone(s: Subobjective) {
  const hasTarget = (s.target_total ?? 0) > 0;
  const autoDone = hasTarget
    ? (s.progress_current ?? 0) >= (s.target_total ?? 0)
    : !!s.is_done;
  return { hasTarget, autoDone };
}

export default function BingoObjectivePage() {
  const { id } = useParams<{ id: string }>();
  const objectiveId = id!;

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
    const t = await getTimeStatsForSubobjectives(ids);
    const m = await listMediaForSubobjectives(ids);
    setObj(o);
    setSubs(s);
    setTimeMap(t);
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
      <div className="bingoals-root">
        <div className="page">
          <div className="topbar">
            <Link className="btn" to="/bingoals">← Back</Link>
          </div>
          <div className="muted">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bingoals-root">
      <div className="page">
        <div className="topbar">
          <Link className="btn" to="/bingoals">← Back</Link>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={() => setAddOpen(true)}>Add subobjective</button>
        </div>

        <div className="panel">
          <div className="h1">{obj.title}</div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div className="muted">Goal: {obj.goal_target ?? "—"} {obj.goal_unit ?? ""}</div>
            <div className="pill">{percentText}</div>
          </div>

          {(obj.goal_kind === "metric" || obj.goal_kind === "amount" || obj.goal_kind === "manual") && (
            <div className="form" style={{ marginTop: 12 }}>
              <label htmlFor="obj-current">Current value</label>
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

          <div className="bar" style={{ marginTop: 12 }}>
            <div className="barFill" style={{ width: `${(percent ?? 0) * 100}%` }} />
          </div>
        </div>

        <div className="list">
          {subs.map((s) => {
            const t = timeMap.get(s.id) ?? { total_ms: 0, last_end: null };
            const subMedia = mediaBySub.get(s.id) ?? [];
            return (
              <SubobjectivePanel
                key={s.id}
                s={s}
                t={t}
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

        <AddSubobjectiveModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          objective={obj}
          onAdded={async () => { setAddOpen(false); await reload(); }}
        />
      </div>
    </div>
  );
}

function AddSubobjectiveModal(props: {
  open: boolean;
  onClose: () => void;
  objective: Objective;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
  const [total, setTotal] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (props.open) { setTitle(""); setUnit(props.objective.goal_unit ?? ""); setTotal(1); }
  }, [props.open, props.objective.goal_unit]);

  return (
    <BingoModal open={props.open} title="Add subobjective" onClose={props.onClose}>
      <div className="form">
        <label htmlFor="bingo-sub-title">Title</label>
        <input id="bingo-sub-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Book: The Stranger" />

        <label htmlFor="bingo-sub-total">Total (optional)</label>
        <input id="bingo-sub-total" type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} />

        <label htmlFor="bingo-sub-unit">Unit</label>
        <input id="bingo-sub-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="chapters / lessons / etc." />

        <div className="row">
          <button className="btn" onClick={props.onClose}>Cancel</button>
          <button
            className="btn primary"
            disabled={busy || title.trim().length === 0}
            onClick={async () => {
              setBusy(true);
              try {
                await createSubobjective(props.objective.id, title.trim(), unit.trim() || null, total || null);
                props.onAdded();
              } finally { setBusy(false); }
            }}
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </BingoModal>
  );
}

const SubobjectivePanel = memo(function SubobjectivePanel(props: {
  s: Subobjective;
  t: { total_ms: number; last_end: number | null };
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
  const { s, t, subs, setSubs, running, playingSubId, setPlayingSubId, subMedia, reload, stopTimerIfRunning, setRunning } = props;
  const [timeEditOpen, setTimeEditOpen] = useState(false);
  const [timeEditMs, setTimeEditMs] = useState(0);

  const last = Math.max(t.last_end ?? 0, s.updated_at ?? 0) || null;
  const d = daysAgo(last);
  const initRunningExtra = running?.subId === s.id ? Math.max(0, Date.now() - running.startedAt) : 0;
  const initialTotalMs = (t.total_ms ?? 0) + initRunningExtra;
  const { hasTarget, autoDone } = computeAutoDone(s);
  const ratio = hasTarget && (s.target_total ?? 0) > 0
    ? clamp01((s.progress_current ?? 0) / (s.target_total ?? 0))
    : autoDone ? 1 : 0;
  const isPlaying = playingSubId === s.id;
  const isRunning = running?.subId === s.id;

  return (
    <div className={`panel ${autoDone ? "panelDone" : ""} ${isRunning ? "panelRecording" : ""}`}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <input
          className="titleInput"
          aria-label="Subobjective title"
          value={s.title}
          onChange={(e) => setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
          onBlur={async () => {
            const fresh = subs.find((x) => x.id === s.id);
            if (fresh) await updateSubobjective(s.id, { title: fresh.title });
            await reload();
          }}
        />
        <div className="pill">{Math.round(ratio * 100)}%</div>
      </div>

      <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        <div className="mini">
          <div className="muted">Time</div>
          <div className="row" style={{ gap: 8 }}>
            <TimerDisplay totalMs={initialTotalMs} isRunning={isRunning} startedAt={isRunning ? running!.startedAt : null} />
            <button
              className="btn"
              onClick={async (e) => {
                e.stopPropagation();
                await stopTimerIfRunning();
                const ms = (t.total_ms ?? 0) + (running?.subId === s.id ? Math.max(0, Date.now() - running.startedAt) : 0);
                setTimeEditMs(ms);
                setTimeEditOpen(true);
              }}
              title="Edit total time"
            >✎</button>
          </div>
        </div>

        <div className="mini">
          <div className="muted">Last</div>
          <div>{d === null ? "—" : `${d}d ago`}</div>
        </div>

        <div className="mini">
          <div className="muted">Progress</div>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="numInput"
              type="number"
              aria-label="Current progress"
              value={s.progress_current ?? 0}
              onChange={(e) => { const v = Number(e.target.value); setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, progress_current: v } : x))); }}
              onBlur={async () => {
                const fresh = subs.find((x) => x.id === s.id);
                if (!fresh) return;
                const { hasTarget, autoDone } = computeAutoDone(fresh);
                await updateSubobjective(s.id, { progress_current: fresh.progress_current, is_done: hasTarget ? (autoDone ? 1 : 0) : fresh.is_done });
                await reload();
              }}
            />
            <span className="muted">/</span>
            <input
              className="numInput"
              type="number"
              aria-label="Target total"
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
              className="unitInput"
              aria-label="Unit"
              value={s.unit ?? ""}
              placeholder="unit"
              onChange={(e) => setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, unit: e.target.value } : x)))}
              onBlur={async () => {
                const fresh = subs.find((x) => x.id === s.id);
                if (fresh) await updateSubobjective(s.id, { unit: fresh.unit?.trim() || null });
                await reload();
              }}
            />
          </div>
        </div>

        <div className="row" style={{ gap: 8, marginLeft: "auto" }}>
          {(s.target_total ?? 0) <= 0 && (
            <button className="btn" onClick={async () => { await updateSubobjective(s.id, { is_done: s.is_done ? 0 : 1 }); await reload(); }}>
              {s.is_done ? "Undone" : "Done"}
            </button>
          )}

          {isRunning ? (
            <button className="btn danger recBtn" onClick={stopTimerIfRunning} title="Stop recording">
              <span className="recDot" aria-hidden="true" />
              REC — STOP
            </button>
          ) : (
            <button className="btn primary" onClick={async () => { await stopTimerIfRunning(); setRunning({ subId: s.id, startedAt: Date.now() }); }}>
              ▶ START
            </button>
          )}

          <button
            className="btn"
            onClick={async () => {
              if (!confirm("Delete this subobjective?")) return;
              if (running?.subId === s.id) await stopTimerIfRunning();
              if (playingSubId === s.id) setPlayingSubId(null);
              await deleteSubobjective(s.id);
              await reload();
            }}
          >Delete</button>
        </div>
      </div>

      <div className="bar" style={{ marginTop: 10 }}>
        <div className="barFill" style={{ width: `${ratio * 100}%` }} />
      </div>

      <div className="memories">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="muted">Memories</div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={async () => {
              const q = prompt("Add a quote (text):");
              if (!q || !q.trim()) return;
              await addQuote(s.id, q.trim());
              await reload();
            }}>+ Quote</button>

            <label className="btn">
              + Images
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
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

            <button
              className="btn"
              disabled={subMedia.length < 2}
              onClick={() => setPlayingSubId((prev) => (prev === s.id ? null : s.id))}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
        </div>

        <Slideshow
          items={subMedia}
          playing={isPlaying}
          onRequestStop={() => setPlayingSubId(null)}
          onDelete={async (mediaId) => { await deleteMediaItem(mediaId); await reload(); }}
        />
      </div>

      <TimeEditModal
        open={timeEditOpen}
        initialMs={timeEditMs}
        onSave={async (ms) => { setTimeEditOpen(false); await setSubobjectiveTotalTime(s.id, ms); await reload(); }}
        onClose={() => setTimeEditOpen(false)}
      />
    </div>
  );
}, (prev, next) => {
  return prev.s === next.s && prev.t === next.t && prev.running === next.running &&
    prev.playingSubId === next.playingSubId && prev.subMedia === next.subMedia;
});

function Slideshow(props: {
  items: MediaItem[];
  playing: boolean;
  onRequestStop: () => void;
  onDelete: (mediaId: string) => Promise<void>;
}) {
  const [i, setI] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
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

  if (props.items.length === 0) {
    return <div className="muted" style={{ marginTop: 8 }}>No memories yet.</div>;
  }

  const safeIndex = Math.max(0, Math.min(i, props.items.length - 1));
  const item = props.items[safeIndex];

  return (
    <div className="slideshow" ref={rootRef}>
      <div className="slide">
        <button
          className="mediaTrashBtn"
          title="Delete"
          onClick={async () => {
            props.onRequestStop();
            if (!confirm("Delete this memory?")) return;
            await props.onDelete(item.id);
          }}
        >🗑</button>

        <div key={item.id} className="mediaFade">
          {item.kind === "image"
            ? <img className="slideImg" src={item.data} alt="memory" />
            : <div className="quote">"{item.data}"</div>
          }
        </div>
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <button className="btn" onClick={() => { props.onRequestStop(); setI((x) => (x - 1 + props.items.length) % props.items.length); }}>Prev</button>
        <div className="muted">{safeIndex + 1} / {props.items.length}{props.playing && inView ? " • Playing" : ""}</div>
        <button className="btn" onClick={() => { props.onRequestStop(); setI((x) => (x + 1) % props.items.length); }}>Next</button>
      </div>
    </div>
  );
}

function TimerDisplay(props: { totalMs: number; isRunning: boolean; startedAt: number | null }) {
  const [displayMs, setDisplayMs] = useState(props.totalMs);

  useEffect(() => {
    if (!props.isRunning || !props.startedAt) { setDisplayMs(props.totalMs); return; }
    const id = window.setInterval(() => setDisplayMs(props.totalMs + Math.max(0, Date.now() - props.startedAt!)), 500);
    setDisplayMs(props.totalMs + Math.max(0, Date.now() - props.startedAt!));
    return () => window.clearInterval(id);
  }, [props.isRunning, props.startedAt, props.totalMs]);

  return <div>{msToHHMMSS(displayMs)}</div>;
}

function msToHHMMSS(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function TimeEditModal(props: { open: boolean; initialMs: number; onSave: (ms: number) => void; onClose: () => void }) {
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

  const fieldStyle: React.CSSProperties = { width: 64, textAlign: "center", fontSize: 32, fontWeight: 900, padding: "8px 0" };

  return (
    <BingoModal open={props.open} title="Edit time" onClose={props.onClose}>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <input ref={hRef} type="text" inputMode="numeric" value={h} style={fieldStyle} onFocus={(e) => e.target.select()}
              onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 3); setH(val); if (val.length === 3) mRef.current?.select(); }}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") props.onClose(); }} />
            <span className="muted">HH</span>
          </div>
          <span style={{ fontSize: 32, fontWeight: 900, paddingBottom: 22 }}>:</span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <input ref={mRef} type="text" inputMode="numeric" value={m} style={fieldStyle} onFocus={(e) => e.target.select()}
              onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 2); setM(val); if (val.length === 2) sRef.current?.select(); }}
              onKeyDown={(e) => { if (e.key === "Backspace" && m === "") hRef.current?.select(); if (e.key === "Enter") save(); if (e.key === "Escape") props.onClose(); }} />
            <span className="muted">MM</span>
          </div>
          <span style={{ fontSize: 32, fontWeight: 900, paddingBottom: 22 }}>:</span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <input ref={sRef} type="text" inputMode="numeric" value={s} style={fieldStyle} onFocus={(e) => e.target.select()}
              onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 2); setS(val); }}
              onKeyDown={(e) => { if (e.key === "Backspace" && s === "") mRef.current?.select(); if (e.key === "Enter") save(); if (e.key === "Escape") props.onClose(); }} />
            <span className="muted">SS</span>
          </div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={props.onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save</button>
        </div>
      </div>
    </BingoModal>
  );
}
