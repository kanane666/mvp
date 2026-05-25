import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMatches } from "@/lib/storage";
import { MatchListSection } from "@/components/MatchListSection";
import { TopPlayersBanner } from "@/components/TopPlayersBanner";
import type { Match } from "@/types/basketball";

export const Route = createFileRoute("/stats/official")({
  component: OfficialStatsPage,
});

function OfficialStatsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  useEffect(() => { setMatches(getMatches()); }, []);
  return (
    <>
      <TopPlayersBanner filter="official" />
      <MatchListSection matches={matches} categories={['official']} emptyLabel="Aucun match officiel" />
    </>
  );
}
