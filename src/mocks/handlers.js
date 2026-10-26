import { http, HttpResponse } from 'msw';

const BASE_TIMESTAMP = Date.now() - 50 * 24 * 60 * 60 * 1000; // 50 days ago

export const handlers = [
  http.get('https://query1.finance.yahoo.com/v8/finance/chart/:ticker', ({ params, request }) => {
    const { ticker } = params;
    const url = new URL(request.url);
    const range = url.searchParams.get('range') ?? '1y';
    const interval = url.searchParams.get('interval') ?? '1d';

    if (ticker === 'INVALID') {
      return new HttpResponse(null, { status: 404 });
    }
    if (ticker === 'RATELIMIT') {
      return new HttpResponse(null, { status: 429 });
    }

    // Generate 400 data points (enough for 30-year horizon tests)
    const days = range.includes('y') ? parseInt(range) * 365 : 50;
    const points = Math.min(days, 400);
    const closes = Array.from({ length: points }, (_, i) => 100 + Math.sin(i * 0.1) * 5 + i * 0.03);
    const timestamps = Array.from({ length: points }, (_, i) =>
      Math.floor((BASE_TIMESTAMP + i * 24 * 60 * 60 * 1000) / 1000)
    );

    return HttpResponse.json({
      chart: {
        result: [{ indicators: { adjclose: [{ adjclose: closes }] }, timestamp: timestamps }],
      },
    });
  }),
];
