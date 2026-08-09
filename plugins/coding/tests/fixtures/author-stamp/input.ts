// violation: authorship attribution belongs in git, not the source
// modified by John Smith
export function processPayment(amount: number): number {
  return amount;
}

// violation: bare date stamp is forbidden history noise
// created 2024-01-15
export function refundPayment(amount: number): number {
  return amount;
}

// compliant: explains why, no author or date stamp
// retry with backoff to absorb transient gateway failures
export function chargeWithRetry(amount: number): number {
  return amount;
}
