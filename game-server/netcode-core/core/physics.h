#pragma once

#include "world.h"

namespace core::physics {

void advance(WorldState &state, const WorldConfig &config, double dt_seconds);

} // namespace core::physics
