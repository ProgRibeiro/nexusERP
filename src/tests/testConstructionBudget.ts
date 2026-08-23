import assert from "node:assert/strict";
import { calculateBdi, calculateAbc, evaluateQuantityExpression, validateScheduleDistribution } from "@/lib/budget";

assert.equal(calculateBdi({ administration: 5, financial: 1, risk: 1, insuranceGuarantee: 1, profit: 8, cofins: 3, pis: 0.65, cprb: 0, iss: 2 }).percentage.toFixed(2), "23.70");
assert.equal(calculateBdi({ administration: 0, financial: 0, risk: 0, insuranceGuarantee: 0, profit: 0, cofins: 0, pis: 0, cprb: 0, iss: 0, direct: 25 }).percentage, 25);
assert.equal(evaluateQuantityExpression("10*(2+3)"), 50);
assert.throws(() => evaluateQuantityExpression("process.exit()"));
assert.throws(() => validateScheduleDistribution([50, 40]));
assert.equal(calculateAbc([{ key: "a", totalWithBdi: 80, totalWithoutBdi: 60, bdiValue: 20, quantity: 1 }, { key: "b", totalWithBdi: 20, totalWithoutBdi: 15, bdiValue: 5, quantity: 1 }])[1].accumulated, 100);
console.log("Construction budget domain tests passed.");
