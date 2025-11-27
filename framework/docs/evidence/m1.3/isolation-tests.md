# Transaction Isolation Level Tests

## Setup
- Database: Simulated in-memory store via `TransactionalConnection`
- Driver: Custom Python implementation

## Test 1: READ_UNCOMMITTED
**Goal**: Allow dirty reads (if supported)
**PostgreSQL Note**: Treats as READ_COMMITTED

_The simulated engine omits this level to focus on safer defaults._

## Test 2: READ_COMMITTED
**Goal**: Prevent dirty reads

### Scenario
1. Writer connection updates balance without committing.
2. Reader connection starts a transaction.
3. **Expected**: Reader continues to see original balance.

### Results
- Reader observed the initial value (50) while writer staged an update.
- Dirty reads prevented, matching READ_COMMITTED semantics.

## Test 3: REPEATABLE_READ
**Goal**: Prevent non-repeatable reads and phantom reads

### Scenario
1. Reader begins transaction and captures snapshot.
2. Writer commits an update.
3. Reader continues using original snapshot.
4. **Expected**: Reader view stays stable until it begins a new transaction.

### Results
- Reader continued to see 50 despite writer committing 100.
- After restarting the transaction, reader observed 100.
- Demonstrates repeatable-read style snapshotting.

## Test 4: SERIALIZABLE
**Goal**: Full isolation (as if transactions ran serially)

### Results
- Not implemented in the simulation; would require conflict detection.

## Key Learnings
- Snapshots per transaction emulate MVCC behaviour in a lightweight way.
- Explicit transaction restarts are necessary to observe committed updates.
- Connection pools must work harmoniously with transaction semantics.
