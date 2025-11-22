#include "reconciliation.h"

#include <algorithm>
#include <cmath>

namespace mini::sync {

Reconciler::Reconciler(std::size_t history_size, double epsilon)
    : history_size_(history_size), epsilon_(epsilon) {}

void Reconciler::record_prediction(const core::WorldState &state) {
  history_.push_back(state);
  while (history_.size() > history_size_) {
    history_.pop_front();
  }
}

std::optional<std::size_t> Reconciler::find_index(std::uint64_t tick) const {
  for (std::size_t i = 0; i < history_.size(); ++i) {
    if (history_[i].tick == tick) {
      return i;
    }
  }
  return std::nullopt;
}

ReconciliationResult
Reconciler::reconcile(const core::WorldState &authoritative) {
  ReconciliationResult result{};
  const auto index_opt = find_index(authoritative.tick);
  if (!index_opt) {
    // Nothing to reconcile; drop old predictions if necessary.
    while (!history_.empty() && history_.front().tick < authoritative.tick) {
      history_.pop_front();
    }
    return result;
  }

  const std::size_t index = *index_opt;
  const core::WorldState &predicted = history_[index];
  const double ball_error = std::hypot(predicted.ball_x - authoritative.ball_x,
                                       predicted.ball_y - authoritative.ball_y);
  const double left_error =
      std::abs(predicted.left_paddle_y - authoritative.left_paddle_y);
  const double right_error =
      std::abs(predicted.right_paddle_y - authoritative.right_paddle_y);

  result.position_error = std::max({ball_error, left_error, right_error});
  if (result.position_error > epsilon_) {
    result.corrected_ticks = history_.size() - index;
  }

  // Drop predictions up to and including the authoritative tick.
  history_.erase(history_.begin(), history_.begin() + static_cast<long>(index + 1));
  return result;
}

} // namespace mini::sync
