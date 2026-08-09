# DEL-REVI-01: Keep Reviews Independent

Reviews are read-only; a review subagent must not modify the resources it judges. The orchestrator reconciles the combined batch reports before choosing one outcome:

- **Proceed** for success or acceptable partial success.
- **Fix** for minor failures, re-dispatching only failed items.
- **Rollback** for critical failure, reverting the batch before re-dispatch.
