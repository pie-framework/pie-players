import * as math from 'mathjs';

console.log('Testing Math.js expressions:\n');

const tests = [
  'sin(0)',
  'cos(0)',
  'sqrt(16)',
  '2^3',
  'log10(100)',
  'sin(45)',
  'sin(45)+10',
];

for (const expr of tests) {
  try {
    const result = math.evaluate(expr);
    console.log(`✓ ${expr} = ${result}`);
  } catch (error) {
    console.log(`✗ ${expr} - Error: ${(error as Error).message}`);
  }
}
