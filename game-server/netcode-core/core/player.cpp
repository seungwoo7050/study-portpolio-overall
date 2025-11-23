#include "player.h"

#include <algorithm>

namespace core {

PlayerInput::PlayerInput() : direction_(0) {}

void PlayerInput::set_direction(int direction) {
  const int clamped = std::clamp(direction, -1, 1);
  direction_.store(clamped, std::memory_order_relaxed);
}

int PlayerInput::direction() const {
  return direction_.load(std::memory_order_relaxed);
}

} // namespace core
