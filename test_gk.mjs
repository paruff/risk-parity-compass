import { guardrailSpend } from './src/utils/withdrawal.js';

const opts = { initialRate: 0.05, upperGuardrail: 0.06, lowerGuardrail: 0.04 };
let r = guardrailSpend(50000, 50000, 100000, 'guyton-klinger', opts);
console.log('Initial:', r);
for (let i = 0; i < 10; i++) {
  r = guardrailSpend(r.nextSpend, 40000, 100000, 'guyton-klinger', opts);
  console.log(`Iter ${i+1}:`, r.nextSpend, r.policyState, r.gkState?.rate);
}
console.log('Floor check:', r.nextSpend, '>=', 100000 * 0.05 * 0.8, '=', 100000 * 0.05 * 0.8);
