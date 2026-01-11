export function parseEventDate(ev?: { date?: string; time?: string }): Date | null {
  if (!ev?.date) return null;

  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(ev.date);
  if (!m) return null;

  const [_, dd, mm, yyyy] = m;
  let h = 0, min = 0;

  if (ev.time) {
    const tm = /^(\d{2}):(\d{2})$/.exec(ev.time);
    if (tm) {
      h = Number(tm[1]);
      min = Number(tm[2]);
    }
  }

  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), h, min);
}

export function latestEventDate(timeline: any): Date | null {
  if (!timeline) return null;

  const priority = ["arrived", "sent", "paid", "unpaid"];
  for (const key of priority) {
    const d = parseEventDate(timeline[key]);
    if (d) return d;
  }

  for (const v of Object.values(timeline)) {
    const d = parseEventDate(v as any);
    if (d) return d;
  }

  return null;
}
