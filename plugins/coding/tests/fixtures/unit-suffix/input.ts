export function configure(): void {
  // violation: bare `timeout` hides its unit
  const timeout = 5000;

  // violation: bare `delay` hides its unit
  const delay = 200;

  // compliant: unit suffix makes the value unambiguous
  const connectionTimeoutMs = 5000;
  const retryDelaySeconds = 2;

  void timeout;
  void delay;
  void connectionTimeoutMs;
  void retryDelaySeconds;
}
