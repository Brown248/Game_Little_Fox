"use client";

// The header every game block shares: what this part is, how far in the
// explorer is, and a segmented track (done · now · to come).

interface Props {
  title: string;
  index: number;
  total: number;
  answered: boolean;
  /** Optional mono label on the right, e.g. the sound cue. */
  meta?: string;
}

export default function Progress({ title, index, total, answered, meta }: Props) {
  const done = index + (answered ? 1 : 0);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="progress-head">
        <h2>{title}</h2>
        <span className="progress-head__count">
          {index + 1} / {total}
        </span>
      </div>

      <div
        className="segs"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`${done} of ${total} answered`}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`seg${i < done ? " seg--done" : i === done ? " seg--now" : ""}`}
          />
        ))}
      </div>

      {meta && <span className="kicker--faint kicker">{meta}</span>}
    </div>
  );
}
