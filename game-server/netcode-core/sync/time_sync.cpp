#include "time_sync.h"

#include <algorithm>

namespace mini::sync {

TimeSync::TimeSync(double alpha, double max_slew)
    : alpha_(alpha), max_slew_(max_slew) {}

void TimeSync::observe(double local_tick, double server_tick) {
  const double measurement = server_tick - local_tick;
  if (!has_observation_) {
    offset_estimate_ = measurement;
    smoothed_offset_ = measurement;
    has_observation_ = true;
  } else {
    offset_estimate_ = (1.0 - alpha_) * offset_estimate_ + alpha_ * measurement;
    smoothed_offset_ = (1.0 - alpha_) * smoothed_offset_ + alpha_ * measurement;
  }
}

double TimeSync::target(double local_tick_now) const {
  if (!has_observation_) {
    return local_tick_now;
  }

  const double delta_local = std::max(0.0, local_tick_now - last_target_local_);
  const double max_adjust = max_slew_ * delta_local;
  const double delta_offset = offset_estimate_ - smoothed_offset_;
  const double clamped_adjust =
      std::clamp(delta_offset, -max_adjust, max_adjust);
  smoothed_offset_ += clamped_adjust;
  last_target_local_ = local_tick_now;
  return local_tick_now + smoothed_offset_;
}

} // namespace mini::sync
