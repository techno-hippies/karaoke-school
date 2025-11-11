## Archived PerformanceGrader Contract

The project previously used `PerformanceGrader` to emit `PerformanceGraded` / `LinePerformanceGraded` events for learner scoring. The dapp has since migrated to `ExerciseEvents`, which emits the `SayItBackAttemptGraded` and `MultipleChoiceAttemptGraded` events consumed by the new Exercise Grader Lit Action.

- Solidity sources, tests, and deployment scripts for `PerformanceGrader` now live in this directory strictly for historical reference.
- No build targets import these files. Foundry compilation and deployments rely solely on `ExerciseEvents` and the other event-only contracts in `contracts/src/events`.
- If you need to revisit the legacy flow, copy the files back into `contracts/src/events` or reference them in-place without adding them to the active build.

This separation keeps the current Exercise-focused terminology consistent across the codebase while preserving the old implementation for archival purposes.
