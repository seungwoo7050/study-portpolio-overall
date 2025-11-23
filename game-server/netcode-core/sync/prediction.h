#pragma once

#include "core/world.h"

#include <cstdint>
#include <optional>

namespace mini::sync {

class Predictor {
public:
  Predictor();
  explicit Predictor(core::WorldConfig config);

  void reset(const core::WorldState &state);

  core::WorldState predict(std::uint64_t tick, double dt_seconds,
                           int left_direction, int right_direction);

  [[nodiscard]] std::optional<core::WorldState> last_prediction() const;

private:
  core::WorldConfig config_{};
  std::optional<core::WorldState> predicted_;
};

} // namespace mini::sync
