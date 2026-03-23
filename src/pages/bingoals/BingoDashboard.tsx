import { memo, useEffect, useMemo, useState } from "react";
import { Target, Pencil, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BingoModal from "../../components/bingoals/BingoModal";
import type { DashboardRow, Objective, Subobjective } from "../../lib/bingoals/db";
import {
  createObjectiveAndAssignSlot,
  ensureYearSlots,
  getBingoDb,
  listDashboardRows,
  updateObjective
} from "../../lib/bingoals/db";
import { daysAgo, formatDuration } from "../../lib/bingoals/format";
import { fileToCompressedDataUrl } from "../../lib/bingoals/image";
import { computeObjectivePercent } from "../../lib/bingoals/progress";
import { useTranslation } from "../../lib/i18n";
import { playSFX, SFX } from "../../lib/sounds";

type Cell = {
  slot_index: number;
  objective_id: string | null;
  objective: Objective | null;
  total_ms: number;
  last_progress_at: number | null;
  percent: number | null;
};

const CURRENT_YEAR = new Date().getFullYear();
let DASH_CACHE: Record<number, Cell[]> = {};

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
  const { t } = useTranslation();
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [cells, setCells] = useState<Cell[]>(() => DASH_CACHE[CURRENT_YEAR] ?? []);
  const [createSlot, setCreateSlot] = useState<number | null>(null);
  const [editObj, setEditObj] = useState<Objective | null>(null);

  async function load(year = selectedYear) {
    await ensureYearSlots(year);
    const rows: DashboardRow[] = await listDashboardRows(year);
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

    DASH_CACHE[year] = out;
    setCells(out);
  }

  useEffect(() => {
    setCells(DASH_CACHE[selectedYear] ?? []);
    load(selectedYear);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

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
    <div className="bingoals-root fade-in">
      <div className="page-header">
          <div className="page-title-group">
            <div className="icon-wrapper bg-blue"><Target size={20} /></div>
            <h1 className="page-header-title">
              {t('bingoals.page_title')} <span className="bingo-title-year">{selectedYear}</span>
            </h1>
          </div>
          <div className="bingo-year-nav">
            {selectedYear !== CURRENT_YEAR && (
              <button
                className="btn bingo-year-return"
                onClick={() => setSelectedYear(CURRENT_YEAR)}
              >
                {t('bingoals.return_year').replace('{year}', String(CURRENT_YEAR))}
              </button>
            )}
            <button
              className="btn btn-icon bingo-year-btn"
              aria-label={t('bingoals.prev_year')}
              onClick={() => setSelectedYear(y => y - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="bingo-year-label">{selectedYear}</span>
            <button
              className="btn btn-icon bingo-year-btn"
              aria-label={t('bingoals.next_year')}
              disabled={selectedYear >= CURRENT_YEAR}
              onClick={() => setSelectedYear(y => y + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid">
          {viewCells.map((c) => {
            if (!c.objective_id || !c.objective) {
              return (
                <button
                  key={c.slot_index}
                  className="add-subject-card bingo-add-card"
                  aria-label={t('bingoals.add_objective')}
                  onMouseEnter={() => playSFX(SFX.HOVER)}
                  onClick={() => { playSFX(SFX.BINGO_ADD); setCreateSlot(c.slot_index); }}
                >
                  {t('bingoals.add_objective')}
                </button>
              );
            }
            return (
              <DashboardCard
                key={c.slot_index}
                c={c}
                nav={nav}
                setEditObj={setEditObj}
                load={load}
                t={t}
              />
            );
          })}
        </div>

        <CreateObjectiveModal
          slotIndex={createSlot}
          year={selectedYear}
          onClose={() => setCreateSlot(null)}
          onCreated={() => { setCreateSlot(null); load(selectedYear); }}
        />

        <EditObjectiveModal
          objective={editObj}
          onClose={() => setEditObj(null)}
          onSaved={() => { setEditObj(null); load(selectedYear); }}
        />
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

function CreateObjectiveModal(props: { slotIndex: number | null; year: number; onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const open = props.slotIndex !== null;
  const [title, setTitle] = useState("");
  const [targetStr, setTargetStr] = useState("");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setTitle(""); setTargetStr(""); setUnit(""); }
  }, [open]);

  return (
    <BingoModal open={open} title={t('bingoals.create_modal_title')} onClose={props.onClose}>
      <div className="form">
        <label htmlFor="bingo-create-title">{t('bingoals.title_label')}</label>
        <input id="bingo-create-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('bingoals.create_title_placeholder')} />

        <label>{t('bingoals.create_goal_section')}</label>
        <div className="bingo-create-goal-row">
          <input
            id="bingo-create-target"
            type="number"
            min="0"
            value={targetStr}
            onChange={(e) => setTargetStr(e.target.value)}
            placeholder="12"
          />
          <input
            id="bingo-create-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={t('bingoals.create_unit_placeholder')}
          />
        </div>
        <p className="bingo-create-goal-helper">{t('bingoals.create_goal_helper')}</p>

        <div className="row">
          <button className="btn" onClick={props.onClose}>{t('bingoals.cancel')}</button>
          <button
            className="btn btn-primary"
            disabled={busy || title.trim().length === 0 || props.slotIndex === null}
            onClick={async () => {
              setBusy(true);
              const hasTarget = targetStr.trim() !== "" && Number(targetStr) > 0;
              const kind: Objective["goal_kind"] = hasTarget ? "count" : "manual";
              try {
                await createObjectiveAndAssignSlot(props.slotIndex!, {
                  title: title.trim(),
                  goal_kind: kind,
                  goal_target: hasTarget ? Number(targetStr) : null,
                  goal_unit: unit.trim() || null,
                }, props.year);
                playSFX(SFX.BINGO_ADD);
                props.onCreated();
              } finally { setBusy(false); }
            }}
          >
            {busy ? t('bingoals.creating') : t('bingoals.create')}
          </button>
        </div>
      </div>
    </BingoModal>
  );
}

function EditObjectiveModal(props: { objective: Objective | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
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
    <BingoModal open={open} title={t('bingoals.edit_modal_title')} onClose={props.onClose}>
      <div className="form">
        <label htmlFor="bingo-edit-title">{t('bingoals.title_label')}</label>
        <input id="bingo-edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label htmlFor="bingo-edit-kind">{t('bingoals.goal_type_label')}</label>
        <select id="bingo-edit-kind" value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="count">{t('bingoals.goal_count')}</option>
          <option value="metric">{t('bingoals.goal_metric')}</option>
          <option value="amount">{t('bingoals.goal_amount')}</option>
          <option value="manual">{t('bingoals.goal_manual')}</option>
        </select>

        {kind !== "manual" && (
          <>
            <label htmlFor="bingo-edit-target">{t('bingoals.goal_target_label')}</label>
            <input id="bingo-edit-target" type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} />

            <label htmlFor="bingo-edit-unit">{t('bingoals.unit_label')}</label>
            <input id="bingo-edit-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </>
        )}

        {(kind === "metric" || kind === "amount" || kind === "manual") && (
          <>
            <label htmlFor="bingo-edit-current">{t('bingoals.current_value_label')}</label>
            <input id="bingo-edit-current" type="number" value={currentValue} onChange={(e) => setCurrentValue(Number(e.target.value))} />
          </>
        )}

        <label htmlFor="bingo-edit-freq">{t('bingoals.frequency_label')}</label>
        <input
          id="bingo-edit-freq"
          type="number"
          min={0}
          value={frequencyDays}
          placeholder={t('bingoals.frequency_placeholder')}
          onChange={(e) => setFrequencyDays(e.target.value)}
        />

        <label>{t('bingoals.cover_image_label')}</label>
        {coverData ? (
          <img className="coverPreview" src={coverData} alt="cover preview" />
        ) : (
          <div className="muted">{t('bingoals.no_cover')}</div>
        )}

        <div className="row bingo-row-wrap">
          <label className="btn">
            {t('bingoals.choose_image')}
            <input
              type="file"
              accept="image/*"
              className="bingo-file-input"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const dataUrl = await fileToCompressedDataUrl(file, { maxSide: 600, quality: 0.75 });
                setCoverData(dataUrl);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <button className="btn" onClick={() => setCoverData(null)}>{t('bingoals.remove_cover')}</button>
        </div>

        <div className="row">
          <button className="btn" onClick={props.onClose}>{t('bingoals.cancel')}</button>
          <button
            className="btn btn-primary"
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
            {busy ? t('bingoals.saving') : t('bingoals.save')}
          </button>
        </div>
      </div>
    </BingoModal>
  );
}

const DashboardCard = memo(function DashboardCard({
  c, nav, setEditObj, load, t
}: {
  c: Cell;
  nav: (path: string) => void;
  setEditObj: (o: Objective) => void;
  load: () => Promise<void>;
  t: (key: string) => string;
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

  function lastLabel(days: number | null) {
    if (days === null) return "—";
    if (days <= 0) return t('bingoals.today');
    if (days === 1) return t('bingoals.yesterday');
    return t('bingoals.days_ago').replace('{n}', String(days));
  }

  return (
    <div className="cardWrap">
      <div
        className={`card${cover ? ' card--has-cover' : ''}`}
        style={cardStyle}
        role="link"
        tabIndex={0}
        aria-label={c.objective!.title}
        onMouseEnter={() => playSFX(SFX.HOVER)}
        onClick={() => { playSFX(SFX.ENTER_MENU); nav(`/bingoals/objective/${c.objective!.id}`); }}
        onKeyDown={(e) => { if (e.key === "Enter") { playSFX(SFX.ENTER_MENU); nav(`/bingoals/objective/${c.objective!.id}`); } }}
      >
        <div className="cardTitle">{c.objective!.title}</div>
        <div className="cardMeta">
          <div>
            <span className="muted">{t('bingoals.last_label')}:</span>{" "}
            <span className={`lastAge ${status}`} title={statusTitle(status)}>{lastLabel(d)}</span>
          </div>
          <div><span className="muted">{t('bingoals.time_label')}:</span> {formatDuration(c.total_ms)}</div>
        </div>

        <div className="cardProgressBar">
          <div className="cardProgressFill" style={{ width: `${(c.percent ?? 0) * 100}%` }} />
        </div>

        <div className="hoverProgress">
          <div className="hoverRow">
            <div className="muted">{t('bingoals.progress_label')}</div>
            <div className="pill">{percentText}</div>
          </div>
        </div>
      </div>

      <div className="cardActions" onClick={(e) => e.stopPropagation()}>
        <button
          className="btn btn-icon"
          title={pinned ? t('bingoals.unpin') : t('bingoals.pin')}
          aria-label={pinned ? t('bingoals.unpin') : t('bingoals.pin')}
          onClick={async () => { playSFX(SFX.CHECK); await updateObjective(c.objective!.id, { pin_bottom: pinned ? 0 : 1 }); await load(); }}
        >
          {pinned ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        </button>
        <button
          className="btn btn-icon"
          title={t('bingoals.edit_objective')}
          aria-label={t('bingoals.edit_objective')}
          onClick={() => { playSFX(SFX.ENTER_MENU); setEditObj(c.objective!); }}
        >
          <Pencil size={14} />
        </button>
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
