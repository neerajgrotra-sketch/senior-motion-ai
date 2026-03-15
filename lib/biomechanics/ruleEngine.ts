import type { BiomechanicsSignals, BooleanRule, NumericRule, PostureRule, Rule } from './types';

function getNumericSignal(signals: BiomechanicsSignals, signal: NumericRule['signal']): number {
  return signals[signal] as number;
}

function evaluateNumericRule(signals: BiomechanicsSignals, rule: NumericRule): boolean {
  const actual = getNumericSignal(signals, rule.signal);

  switch (rule.op) {
    case '<':
      return actual < rule.value;
    case '<=':
      return actual <= rule.value;
    case '>':
      return actual > rule.value;
    case '>=':
      return actual >= rule.value;
    case '==':
      return actual === rule.value;
    case 'abs<':
      return Math.abs(actual) < rule.value;
    case 'abs<=':
      return Math.abs(actual) <= rule.value;
    case 'abs>':
      return Math.abs(actual) > rule.value;
    case 'abs>=':
      return Math.abs(actual) >= rule.value;
    default:
      return false;
  }
}

function evaluateBooleanRule(signals: BiomechanicsSignals, rule: BooleanRule): boolean {
  return signals[rule.signal] === rule.equals;
}

function evaluatePostureRule(signals: BiomechanicsSignals, rule: PostureRule): boolean {
  return rule.allowed.includes(signals.posture);
}

export function evaluateRule(signals: BiomechanicsSignals, rule: Rule): boolean {
  if ('kind' in rule) {
    if (rule.kind === 'boolean') return evaluateBooleanRule(signals, rule);
    if (rule.kind === 'posture') return evaluatePostureRule(signals, rule);
  }

  return evaluateNumericRule(signals, rule as NumericRule);
}

export function evaluateAllRules(signals: BiomechanicsSignals, rules: Rule[]): boolean {
  return rules.every((rule) => evaluateRule(signals, rule));
}
