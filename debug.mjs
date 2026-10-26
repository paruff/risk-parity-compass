import { withdrawalSequence } from './src/utils/withdrawal.js';

const accounts = { Taxable: 50000, 'Traditional IRA / 401k': 100000, 'Roth IRA': 30000 };
const rmdByAccount = { 'Traditional IRA / 401k': 5000 };
const r = withdrawalSequence(accounts, 4000, { rmdByAccount });
console.log('Result:', JSON.stringify(r, null, 2));
