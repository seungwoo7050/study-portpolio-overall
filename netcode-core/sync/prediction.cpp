#include "prediction.h"

#include "core/physics.h"

#include <stdexcept>

namespace mini::sync {

Predictor::Predictor() = default;

Predictor::Predictor(core::WorldConfig config) : config_(config) {}

void Predictor::reset(const core::WorldState &state) { predicted_ = state; }

core::WorldState Predictor::predict(std::uint64_t tick, double dt_seconds,
                                    int left_direction, int right_direction) {
  if (!predicted_) {
    throw std::logic_error("predict called before reset");
  }

  core::WorldState state = *predicted_;
  state.left_direction = left_direction;
  state.right_direction = right_direction;
  state.tick = tick;
  core::physics::advance(state, config_, dt_seconds);
  predicted_ = state;
  return state;
}

std::optional<core::WorldState> Predictor::last_prediction() const {
  return predicted_;
}

} // namespace mini::sync
