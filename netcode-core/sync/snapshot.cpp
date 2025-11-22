#include "snapshot.h"

#include <algorithm>
#include <stdexcept>

namespace mini::sync {

SnapshotGenerator::SnapshotGenerator(std::uint32_t keyframe_interval,
                                     std::size_t history_size)
    : keyframe_interval_(keyframe_interval), history_size_(history_size) {}

EncodedSnapshot SnapshotGenerator::encode(const core::WorldState &state) {
  const bool should_emit_keyframe =
      !has_keyframe_ || state.tick <= last_keyframe_tick_ ||
      state.tick - last_keyframe_tick_ >= keyframe_interval_;

  if (should_emit_keyframe) {
    return encode_keyframe(state);
  }

  EncodedSnapshot encoded;
  encoded.tick = state.tick;
  const auto base_state = find_state(last_keyframe_tick_);
  if (!base_state) {
    return encode_keyframe(state);
  } else {
    encoded.is_keyframe = false;
    encoded.base_tick = last_keyframe_tick_;
    encoded.payload = codec_.encode_delta(*base_state, state);
  }

  store_state(state);
  const auto history_span = static_cast<std::uint64_t>(history_size_);
  const auto min_tick = state.tick >= history_span ? state.tick - history_span
                                                   : 0ULL;
  prune_history(min_tick);

  return encoded;
}

EncodedSnapshot SnapshotGenerator::encode_keyframe(
    const core::WorldState &state) {
  EncodedSnapshot encoded;
  encoded.tick = state.tick;
  encoded.is_keyframe = true;
  encoded.base_tick = state.tick;
  encoded.payload = codec_.encode_keyframe(state);

  store_state(state);
  last_keyframe_tick_ = state.tick;
  has_keyframe_ = true;

  const auto history_span = static_cast<std::uint64_t>(history_size_);
  const auto min_tick = state.tick >= history_span ? state.tick - history_span
                                                   : 0ULL;
  prune_history(min_tick);

  return encoded;
}

std::optional<core::WorldState>
SnapshotGenerator::find_state(std::uint64_t tick) const {
  const auto it = std::find_if(history_.begin(), history_.end(),
                               [tick](const core::WorldState &state) {
                                 return state.tick == tick;
                               });
  if (it == history_.end()) {
    return std::nullopt;
  }
  return *it;
}

void SnapshotGenerator::store_state(const core::WorldState &state) {
  const auto existing = std::find_if(history_.begin(), history_.end(),
                                     [&](const core::WorldState &entry) {
                                       return entry.tick == state.tick;
                                     });
  if (existing != history_.end()) {
    *existing = state;
    return;
  }

  history_.push_back(state);
  while (history_.size() > history_size_) {
    history_.pop_front();
  }
}

void SnapshotGenerator::prune_history(std::uint64_t min_tick) {
  while (!history_.empty() && history_.front().tick < min_tick) {
    history_.pop_front();
  }
}

SnapshotDecoder::SnapshotDecoder(std::size_t history_size)
    : history_size_(history_size) {}

core::WorldState SnapshotDecoder::apply(const EncodedSnapshot &snapshot) {
  core::WorldState state{};
  if (snapshot.is_keyframe) {
    state = codec_.decode_keyframe(snapshot.payload, snapshot.tick);
  } else {
    const auto base_state = find_state(snapshot.base_tick);
    if (!base_state) {
      throw std::runtime_error("missing base state for delta snapshot");
    }
    state = codec_.apply_delta(*base_state, snapshot.payload, snapshot.tick);
  }

  store_state(state);
  return state;
}

std::optional<core::WorldState>
SnapshotDecoder::find_state(std::uint64_t tick) const {
  const auto it = std::find_if(history_.begin(), history_.end(),
                               [tick](const core::WorldState &state) {
                                 return state.tick == tick;
                               });
  if (it == history_.end()) {
    return std::nullopt;
  }
  return *it;
}

void SnapshotDecoder::store_state(const core::WorldState &state) {
  history_.push_back(state);
  while (history_.size() > history_size_) {
    history_.pop_front();
  }
}

} // namespace mini::sync
