#pragma once

#include "core/world.h"
#include "sync/delta.h"

#include <cstdint>
#include <deque>
#include <optional>
#include <vector>

namespace mini::sync {

struct EncodedSnapshot {
  std::uint64_t tick{0};
  std::uint64_t base_tick{0};
  bool is_keyframe{false};
  std::vector<std::uint8_t> payload;
};

class SnapshotGenerator {
public:
  SnapshotGenerator(std::uint32_t keyframe_interval = 20,
                    std::size_t history_size = 120);

  EncodedSnapshot encode(const core::WorldState &state);

  EncodedSnapshot encode_keyframe(const core::WorldState &state);

  [[nodiscard]] std::optional<core::WorldState>
  find_state(std::uint64_t tick) const;

private:
  void store_state(const core::WorldState &state);
  void prune_history(std::uint64_t min_tick);

  std::uint32_t keyframe_interval_;
  std::size_t history_size_;
  std::deque<core::WorldState> history_;
  std::uint64_t last_keyframe_tick_{0};
  bool has_keyframe_{false};
  DeltaCodec codec_{};
};

class SnapshotDecoder {
public:
  explicit SnapshotDecoder(std::size_t history_size = 120);

  core::WorldState apply(const EncodedSnapshot &snapshot);

private:
  [[nodiscard]] std::optional<core::WorldState>
  find_state(std::uint64_t tick) const;
  void store_state(const core::WorldState &state);

  std::size_t history_size_;
  std::deque<core::WorldState> history_;
  DeltaCodec codec_{};
};

} // namespace mini::sync
