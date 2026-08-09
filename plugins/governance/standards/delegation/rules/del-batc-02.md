# DEL-BATC-02: Bound and Reconcile Batches

Batch at most about 10 resources per subagent, one worker per batch, so reports stay reviewable and failures stay cheap to retry. Dispatch independent batches together. Stop dispatching more work while reported issues remain unresolved.

A skill may tighten the resource bound when its work is more complex.
