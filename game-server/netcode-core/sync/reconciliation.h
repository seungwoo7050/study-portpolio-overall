#pragma once

#include "core/world.h"

#include <cstddef>
#include <cstdint>
#include <deque>
#include <optional>

namespace mini::sync {

struct ReconciliationResult {
  std::uint64_t corrected_ticks{0};
  double position_error{0.0};
};

class Reconciler {
public:
  Reconciler(std::size_t history_size = 120, double epsilon = 0.5);

  void record_prediction(const core::WorldState &state);
  ReconciliationResult reconcile(const core::WorldState &authoritative);

private:
  [[nodiscard]] std::optional<std::size_t>
  find_index(std::uint64_t tick) const;

  std::size_t history_size_;
  double epsilon_;
  std::deque<core::WorldState> history_;
};

} // namespace mini::sync
