#pragma once

#include "core/world.h"

#include <cstdint>
#include <vector>

namespace mini::sync {

class DeltaCodec {
public:
  std::vector<std::uint8_t>
  encode_keyframe(const core::WorldState &state) const;

  core::WorldState decode_keyframe(const std::vector<std::uint8_t> &data,
                                   std::uint64_t tick) const;

  std::vector<std::uint8_t>
  encode_delta(const core::WorldState &base,
               const core::WorldState &state) const;

  core::WorldState apply_delta(const core::WorldState &base,
                               const std::vector<std::uint8_t> &delta,
                               std::uint64_t tick) const;
};

} // namespace mini::sync
