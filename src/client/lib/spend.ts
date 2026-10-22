/** Today's estimated spend; a total from an earlier day counts as nothing spent yet. */
export function spentToday(spend: { date: string; usd: number }, timeZone: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "UTC" }).format(Date.now());
  return spend.date === today ? spend.usd : 0;
}

/** An estimate in dollars, as "about $1.23"; amounts under a cent read as "under $0.01". */
export function formatUsd(usd: number) {
  return usd > 0 && usd < 0.01 ? "under $0.01" : `about $${usd.toFixed(2)}`;
}
