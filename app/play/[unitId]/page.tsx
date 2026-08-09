// Loads /content/units/[unitId].json and steps the player through each
// game block in order, using the components in /components/games.
// This server half only resolves the unit; PlayClient runs the engine loop.
//
// ?part=N plays block N on its own — same loop, but timed, scored and ranked
// under that part's own id. The chooser at /unit/[unitId] links here both ways.

import { notFound } from "next/navigation";
import PlayClient from "@/components/PlayClient";
import Shell from "@/components/Shell";
import { getUnit, listUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ part?: string }>;
}) {
  // Next 15: route params arrive as a promise.
  const { unitId } = await params;
  const { part } = await searchParams;
  const unit = getUnit(unitId);
  if (!unit) notFound();

  // ?part is 1-based for the student, 0-based for the engine. Anything that
  // isn't a real block plays the whole unit rather than crashing mid-lesson.
  const asked = Number(part);
  const partIndex =
    part !== undefined && Number.isInteger(asked) && asked >= 1 && asked <= unit.games.length
      ? asked - 1
      : undefined;

  const kicker =
    partIndex === undefined
      ? `${unitId.replace("-", " ")} · ${unit.title}`
      : `${unitId.replace("-", " ")} · part ${partIndex + 1}`;

  // No nav pills while an expedition is running: leaving is the Exit button's
  // job, and that one asks first.
  return (
    <Shell kicker={kicker} nav={false}>
      <PlayClient
        unit={unit}
        partIndex={partIndex}
        totalUnits={listUnits().length}
      />
    </Shell>
  );
}
