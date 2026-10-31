// Pure, synchronous decision-budget guard for isolated trial runtimes.
// Future launchers must call consume() before accepting each policy decision.
export class DecisionBudget {
  constructor(limit) {
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new RangeError('Invalid decision budget');
    this.limit = limit;
    this.used = 0;
  }
  get remaining() { return this.limit - this.used; }
  get exhausted() { return this.remaining === 0; }
  consume() {
    if (this.exhausted) return {accepted:false, used:this.used, remaining:0, exhausted:true};
    this.used += 1;
    return {accepted:true, used:this.used, remaining:this.remaining, exhausted:this.exhausted};
  }
  snapshot() {
    return Object.freeze({schema:'craftle.decision-budget.v1', limit:this.limit,
      used:this.used, remaining:this.remaining, exhausted:this.exhausted});
  }
  static fromSnapshot(s) {
    if (s?.schema !== 'craftle.decision-budget.v1' || !Number.isSafeInteger(s.used)
      || !Number.isSafeInteger(s.limit) || s.used < 0 || s.used > s.limit)
      throw new TypeError('Invalid budget snapshot');
    const budget = new DecisionBudget(s.limit);
    budget.used = s.used;
    return budget;
  }
}
