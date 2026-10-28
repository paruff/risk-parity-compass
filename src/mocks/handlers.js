import { http, HttpResponse } from 'msw';

// Serves the bundled price snapshot shape (see src/utils/priceSnapshot.js).
const DAILY = Array.from({ length: 400 }, (_, i) => 100 + Math.sin(i * 0.1) * 5 + i * 0.03);
const MONTHS = 240;
const MONTHLY_DATES = Array.from({ length: MONTHS }, (_, i) => {
  const d = new Date(Date.UTC(2006, 0, 1));
  d.setUTCMonth(d.getUTCMonth() + i);
  return d.toISOString().slice(0, 7);
});
const MONTHLY = Array.from({ length: MONTHS }, (_, i) => 50 + Math.sin(i * 0.2) * 5 + i * 0.2);

export const handlers = [
  http.get('*/prices/:file', ({ params }) => {
    const ticker = String(params.file).replace(/\.json$/, '');
    if (ticker === 'INVALID') return new HttpResponse(null, { status: 404 });
    if (ticker === 'RATELIMIT') return new HttpResponse(null, { status: 429 });
    return HttpResponse.json({
      ticker,
      asOf: '2026-10-28',
      daily: DAILY,
      monthly: { dates: MONTHLY_DATES, closes: MONTHLY },
    });
  }),
];
