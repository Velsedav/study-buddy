import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BingoModal from "../../components/bingoals/BingoModal";
import type { DashboardRow, Objective, Subobjective } from "../../lib/bingoals/db";
import {
  createObjectiveAndAssignSlot,
  getBingoDb,
  listDashboardRows,
  updateObjective
} from "../../lib/bingoals/db";
import { daysAgo, formatDuration } from "../../lib/bingoals/format";
import { fileToCompressedDataUrl } from "../../lib/bingoals/image";
import { computeObjectivePercent } from "../../lib/bingoals/progress";

type Cell = {
  slot_index: number;
  objective_id: string | null;
  objective: Objective | null;
  total_ms: number;
  last_progress_at: number | null;
  percent: number | null;
};

let DASH_CACHE: Cell[] | null = null;

function lastLabel(days: number | null) {
  if (days === null) return "—";
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function statusTitle(status: string) {
  if (status === "green") return "On track";
  if (status === "orange") return "Due soon";
  if (status === "red") return "Overdue";
  return "";
}

function lastStatus(days: number | null, freqDays: number | null) {
  if (!freqDays || freqDays <= 0) return "neutral";
  if (days === null) return "red";
  const greenCut = Math.floor(freqDays * 0.25);
  if (days <= greenCut) return "green";
  if (days <= freqDays) return "orange";
  return "red";
}

export default function BingoDashboard() {
  const nav = useNavigate();
  const [cells, setCells] = useState<Cell[]>(() => DASH_CACHE ?? []);
  const [busy, setBusy] = useState(false);
  const [createSlot, setCreateSlot] = useState<number | null>(null);
  const [editObj, setEditObj] = useState<Objective | null>(null);

  async function load() {
    setBusy(true);
    try {
      await getBingoDb();
      const rows: DashboardRow[] = await listDashboardRows();
      const objectiveIds = rows
        .map((r) => r.objective_id)
        .filter((x): x is string => typeof x === "string" && x.length > 0);
      const subsByObj = await fetchSubobjectivesByObjective(objectiveIds);

      const out: Cell[] = rows.map((r) => {
        const hasObj = !!r.objective_id && !!r.id;
        const objective: Objective | null = hasObj
          ? ({
            id: r.id!,
            title: r.title!,
            goal_kind: r.goal_kind as any,
            goal_target: (r.goal_target ?? null) as any,
            goal_unit: (r.goal_unit ?? null) as any,
            cover_data: (r.cover_data ?? null) as any,
            current_value: (r.current_value ?? 0) as any,
            created_at: r.created_at!,
            updated_at: r.updated_at!,
            pin_bottom: (r as any).pin_bottom ?? 0,
            frequency_days: (r as any).frequency_days ?? null
          } satisfies Objective)
          : null;

        let percent: number | null = null;
        let last_progress_at: number | null = null;

        if (objective) {
          const subs = subsByObj.get(objective.id) ?? [];
          percent = computeObjectivePercent(objective, subs);
          const lastSubUpdate = subs.length === 0 ? 0 : subs.reduce((m, s) => Math.max(m, s.updated_at ?? 0), 0);
          const last = Math.max(r.last_end ?? 0, lastSubUpdate ?? 0) || 0;
          last_progress_at = last > 0 ? last : null;
        }

        return { slot_index: r.slot_index, objective_id: r.objective_id, objective, total_ms: r.total_ms ?? 0, last_progress_at, percent };
      });

      DASH_CACHE = out;
      setCells(out);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  const viewCells = useMemo(() => {
    const clone = [...cells];
    clone.sort((a, b) => {
      const aHas = !!a.objective_id && !!a.objective;
      const bHas = !!b.objective_id && !!b.objective;
      if (!aHas && !bHas) return a.slot_index - b.slot_index;
      if (!aHas) return 1;
      if (!bHas) return -1;

      const ap = !!a.objective!.pin_bottom;
      const bp = !!b.objective!.pin_bottom;
      if (ap !== bp) return ap ? 1 : -1;

      const al = a.last_progress_at ?? 0;
      const bl = b.last_progress_at ?? 0;
      const aKey = al === 0 ? Number.POSITIVE_INFINITY : al;
      const bKey = bl === 0 ? Number.POSITIVE_INFINITY : bl;
      if (aKey !== bKey) return aKey - bKey;
      return a.slot_index - b.slot_index;
    });
    return clone;
  }, [cells]);

  return (
    <div className="bingoals-root">
      <div className="page">
        <div className="row dashControls" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
          <button className="btn" onClick={load} disabled={busy}>Refresh</button>
        </div>

        <div className="grid">
          {viewCells.map((c) => {
            if (!c.objective_id || !c.objective) {
              return (
                <div
                  key={c.slot_index}
                  className="card cardEmpty"
                  role="button"
                  tabIndex={0}
                  aria-label="Add new objective"
                  onClick={() => setCreateSlot(c.slot_index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCreateSlot(c.slot_index); }
                  }}
                >
                  <div className="emptyPlus">＋</div>
                  <div className="muted">Add objective</div>
                </div>
              );
            }
            return (
              <DashboardCard
                key={c.slot_index}
                c={c}
                nav={nav}
                setEditObj={setEditObj}
                load={load}
              />
            );
          })}
        </div>

        <CreateObjectiveModal
          slotIndex={createSlot}
          onClose={() => setCreateSlot(null)}
          onCreated={() => { setCreateSlot(null); load(); }}
        />

        <EditObjectiveModal
          objective={editObj}
          onClose={() => setEditObj(null)}
          onSaved={() => { setEditObj(null); load(); }}
        />
      </div>
    </div>
  );
}

async function fetchSubobjectivesByObjective(objectiveIds: string[]) {
  const map = new Map<string, Subobjective[]>();
  if (objectiveIds.length === 0) return map;
  const db = await getBingoDb();
  const q = `SELECT * FROM subobjectives WHERE objective_id IN (${objectiveIds.map(() => "?").join(",")}) ORDER BY created_at ASC`;
  const rows = await db.select<Subobjective[]>(q, objectiveIds);
  for (const s of rows) {
    const arr = map.get(s.objective_id) ?? [];
    arr.push(s);
    map.set(s.objective_id, arr);
  }
  return map;
}

function CreateObjectiveModal(props: { slotIndex: number | null; onClose: () => void; onCreated: () => void }) {
  const open = props.slotIndex !== null;
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Objective["goal_kind"]>("count");
  const [target, setTarget] = useState<number>(12);
  const [unit, setUnit] = useState<string>("items");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setTitle(""); setKind("count"); setTarget(12); setUnit("items"); }
  }, [open]);

  return (
    <BingoModal open={open} title="Create objective" onClose={props.onClose}>
      <div className="form">
        <label htmlFor="bingo-create-title">Title</label>
        <input id="bingo-create-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Learn 10 recipes" />

        <label htmlFor="bingo-create-kind">Goal type</label>
        <select id="bingo-create-kind" value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="count">Count — track items completed (e.g., 12 books)</option>
          <option value="metric">Metric — track a measured value (e.g., 1000 km)</option>
          <option value="amount">Amount — track a sum (e.g., €500 saved)</option>
          <option value="manual">Manual — set progress percentage directly</option>
        </select>

        <label htmlFor="bingo-create-target">Goal target</label>
        <input id="bingo-create-target" type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} />

        <label htmlFor="bingo-create-unit">Unit</label>
        <input id="bingo-create-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="books / € / % / wpm" />

        <div className="row">
          <button className="btn" onClick={props.onClose}>Cancel</button>
          <button
            className="btn primary"
            disabled={busy || title.trim().length === 0 || props.slotIndex === null}
            onClick={async () => {
              setBusy(true);
              try {
                await createObjectiveAndAssignSlot(props.slotIndex!, {
                  title: title.trim(), goal_kind: kind, goal_target: target, goal_unit: unit.trim() || null
                });
                props.onCreated();
              } finally { setBusy(false); }
            }}
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </BingoModal>
  );
}

function EditObjectiveModal(props: { objective: Objective | null; onClose: () => void; onSaved: () => void }) {
  const open = !!props.objective;
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Objective["goal_kind"]>("count");
  const [target, setTarget] = useState<number>(0);
  const [unit, setUnit] = useState<string>("");
  const [currentValue, setCurrentValue] = useState<number>(0);
  const [coverData, setCoverData] = useState<string | null>(null);
  const [frequencyDays, setFrequencyDays] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!props.objective) return;
    setTitle(props.objective.title);
    setKind(props.objective.goal_kind);
    setTarget(props.objective.goal_target ?? 0);
    setUnit(props.objective.goal_unit ?? "");
    setCurrentValue(props.objective.current_value ?? 0);
    setCoverData(props.objective.cover_data ?? null);
    setFrequencyDays(props.objective.frequency_days == null ? "" : String(props.objective.frequency_days));
  }, [props.objective]);

  return (
    <BingoModal open={open} title="Edit objective" onClose={props.onClose}>
      <div className="form">
        <label htmlFor="bingo-edit-title">Title</label>
        <input id="bingo-edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label htmlFor="bingo-edit-kind">Goal type</label>
        <select id="bingo-edit-kind" value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="count">Count</option>
          <option value="metric">Metric</option>
          <option value="amount">Amount</option>
          <option value="manual">Manual</option>
        </select>

        <label htmlFor="bingo-edit-target">Goal target</label>
        <input id="bingo-edit-target" type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} />

        <label htmlFor="bingo-edit-unit">Unit</label>
        <input id="bingo-edit-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />

        {(kind === "metric" || kind === "amount" || kind === "manual") && (
          <>
            <label htmlFor="bingo-edit-current">Current value</label>
            <input id="bingo-edit-current" type="number" value={currentValue} onChange={(e) => setCurrentValue(Number(e.target.value))} />
          </>
        )}

        <label htmlFor="bingo-edit-freq">Frequency (days) — optional</label>
        <input
          id="bingo-edit-freq"
          type="number"
          min={0}
          value={frequencyDays}
          placeholder="How often? In days"
          onChange={(e) => setFrequencyDays(e.target.value)}
        />

        <label>Cover image</label>
        {coverData ? (
          <img className="coverPreview" src={coverData} alt="cover preview" />
        ) : (
          <div className="muted">No cover image</div>
        )}

        <div className="row" style={{ flexWrap: "wrap" }}>
          <label className="btn">
            Choose image
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const dataUrl = await fileToCompressedDataUrl(file, { maxSide: 600, quality: 0.75 });
                setCoverData(dataUrl);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <button className="btn" onClick={() => setCoverData(null)}>Remove cover</button>
        </div>

        <div className="row">
          <button className="btn" onClick={props.onClose}>Cancel</button>
          <button
            className="btn primary"
            disabled={busy || !props.objective}
            onClick={async () => {
              if (!props.objective) return;
              const fdTrim = frequencyDays.trim();
              const fd = fdTrim.length === 0 ? null : Math.max(0, Math.floor(Number(fdTrim)));
              setBusy(true);
              try {
                await updateObjective(props.objective.id, {
                  title: title.trim() || props.objective.title,
                  goal_kind: kind,
                  goal_target: Number.isFinite(target) ? target : props.objective.goal_target,
                  goal_unit: unit.trim() || null,
                  current_value: currentValue,
                  cover_data: coverData,
                  frequency_days: fd
                });
                props.onSaved();
              } finally { setBusy(false); }
            }}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </BingoModal>
  );
}

const DashboardCard = memo(function DashboardCard({
  c, nav, setEditObj, load
}: {
  c: Cell;
  nav: (path: string) => void;
  setEditObj: (o: Objective) => void;
  load: () => Promise<void>;
}) {
  const d = daysAgo(c.last_progress_at);
  const status = lastStatus(d, c.objective!.frequency_days ?? null);
  const percentText = c.percent === null ? "—" : `${Math.round(c.percent * 100)}%`;
  const pinned = !!c.objective!.pin_bottom;
  const cover = c.objective!.cover_data;
  const cardStyle = cover
    ? {
      backgroundImage: `linear-gradient(to top, rgba(0,0,0,.85), rgba(0,0,0,.25)), url(${cover})`,
      backgroundSize: "cover",
      backgroundPosition: "center"
    }
    : undefined;

  return (
    <div className="cardWrap">
      <div
        className="card"
        style={cardStyle}
        role="link"
        tabIndex={0}
        aria-label={c.objective!.title}
        onClick={() => nav(`/bingoals/objective/${c.objective!.id}`)}
        onKeyDown={(e) => { if (e.key === "Enter") nav(`/bingoals/objective/${c.objective!.id}`); }}
      >
        <div className="cardTitle">{c.objective!.title}</div>
        <div className="cardMeta">
          <div><span className="muted">Time:</span> {formatDuration(c.total_ms)}</div>
          <div>
            <span className="muted">Last:</span>{" "}
            <span className={`lastAge ${status}`} title={statusTitle(status)}>{lastLabel(d)}</span>
          </div>
          <div><span className="muted">Progress:</span> {percentText}</div>
        </div>

        <div className="hoverProgress">
          <div className="hoverRow">
            <div className="muted">Progress</div>
            <div className="pill">{percentText}</div>
          </div>
          <div className="bar">
            <div className="barFill" style={{ width: `${(c.percent ?? 0) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="cardActions" onClick={(e) => e.stopPropagation()}>
        <button
          className="pinBtn"
          title={pinned ? "Unpin from bottom" : "Pin to bottom"}
          onClick={async () => { await updateObjective(c.objective!.id, { pin_bottom: pinned ? 0 : 1 }); await load(); }}
        >
          {pinned ? "⇧" : "⇩"}
        </button>
        <button className="iconBtn" title="Edit objective" onClick={() => setEditObj(c.objective!)}>✎</button>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.c.objective?.updated_at === next.c.objective?.updated_at &&
    prev.c.percent === next.c.percent &&
    prev.c.total_ms === next.c.total_ms &&
    prev.c.last_progress_at === next.c.last_progress_at &&
    prev.c.objective?.pin_bottom === next.c.objective?.pin_bottom &&
    prev.c.objective?.frequency_days === next.c.objective?.frequency_days &&
    prev.c.objective_id === next.c.objective_id &&
    prev.c.slot_index === next.c.slot_index;
});
