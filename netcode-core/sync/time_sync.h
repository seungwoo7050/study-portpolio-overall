#pragma once

#include <cstddef>

namespace mini::sync {

class TimeSync {
public:
  explicit TimeSync(double alpha = 0.1, double max_slew = 0.5);

  void observe(double local_tick, double server_tick);

  double target(double local_tick_now) const;

  double offset() const { return offset_estimate_; }

private:
  double alpha_;
  double max_slew_;
  double offset_estimate_{0.0};
  mutable double smoothed_offset_{0.0};
  mutable double last_target_local_{0.0};
  bool has_observation_{false};
};

} // namespace mini::sync
