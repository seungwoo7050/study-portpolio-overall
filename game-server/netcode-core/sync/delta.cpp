#include "delta.h"

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <stdexcept>

namespace mini::sync {

namespace {
void append_u32(std::vector<std::uint8_t> &buffer, std::uint32_t value) {
  for (int i = 0; i < 4; ++i) {
    buffer.push_back(static_cast<std::uint8_t>((value >> (i * 8)) & 0xFFu));
  }
}

void append_i16(std::vector<std::uint8_t> &buffer, std::int16_t value) {
  const auto unsigned_value = static_cast<std::uint16_t>(value);
  buffer.push_back(static_cast<std::uint8_t>(unsigned_value & 0xFFu));
  buffer.push_back(static_cast<std::uint8_t>((unsigned_value >> 8) & 0xFFu));
}

void append_i8(std::vector<std::uint8_t> &buffer, std::int8_t value) {
  buffer.push_back(static_cast<std::uint8_t>(value));
}

void append_f32(std::vector<std::uint8_t> &buffer, float value) {
  std::uint32_t bits;
  std::memcpy(&bits, &value, sizeof(float));
  append_u32(buffer, bits);
}

std::uint32_t read_u32(const std::vector<std::uint8_t> &buffer, std::size_t &offset) {
  if (offset + 4 > buffer.size()) {
    throw std::out_of_range("buffer underflow while reading u32");
  }
  std::uint32_t value = 0;
  for (int i = 0; i < 4; ++i) {
    value |= static_cast<std::uint32_t>(buffer[offset + i]) << (i * 8);
  }
  offset += 4;
  return value;
}

float read_f32(const std::vector<std::uint8_t> &buffer, std::size_t &offset) {
  const std::uint32_t bits = read_u32(buffer, offset);
  float value;
  std::memcpy(&value, &bits, sizeof(float));
  return value;
}

std::int16_t read_i16(const std::vector<std::uint8_t> &buffer,
                      std::size_t &offset) {
  if (offset + 2 > buffer.size()) {
    throw std::out_of_range("buffer underflow while reading i16");
  }
  const std::uint16_t value = static_cast<std::uint16_t>(buffer[offset]) |
                              (static_cast<std::uint16_t>(buffer[offset + 1])
                               << 8);
  offset += 2;
  return static_cast<std::int16_t>(value);
}

std::int8_t read_i8(const std::vector<std::uint8_t> &buffer, std::size_t &offset) {
  if (offset >= buffer.size()) {
    throw std::out_of_range("buffer underflow while reading i8");
  }
  return static_cast<std::int8_t>(buffer[offset++]);
}

void write_state(std::vector<std::uint8_t> &buffer, const core::WorldState &state) {
  append_f32(buffer, static_cast<float>(state.ball_x));
  append_f32(buffer, static_cast<float>(state.ball_y));
  append_f32(buffer, static_cast<float>(state.ball_vx));
  append_f32(buffer, static_cast<float>(state.ball_vy));
  append_f32(buffer, static_cast<float>(state.left_paddle_y));
  append_f32(buffer, static_cast<float>(state.right_paddle_y));
  append_u32(buffer, state.left_score);
  append_u32(buffer, state.right_score);
  append_i8(buffer, static_cast<std::int8_t>(state.left_direction));
  append_i8(buffer, static_cast<std::int8_t>(state.right_direction));
}

core::WorldState read_state(const std::vector<std::uint8_t> &buffer,
                            std::size_t &offset) {
  core::WorldState state{};
  state.ball_x = static_cast<double>(read_f32(buffer, offset));
  state.ball_y = static_cast<double>(read_f32(buffer, offset));
  state.ball_vx = static_cast<double>(read_f32(buffer, offset));
  state.ball_vy = static_cast<double>(read_f32(buffer, offset));
  state.left_paddle_y = static_cast<double>(read_f32(buffer, offset));
  state.right_paddle_y = static_cast<double>(read_f32(buffer, offset));
  state.left_score = read_u32(buffer, offset);
  state.right_score = read_u32(buffer, offset);
  state.left_direction = read_i8(buffer, offset);
  state.right_direction = read_i8(buffer, offset);
  return state;
}

void write_delta(std::vector<std::uint8_t> &buffer, const core::WorldState &base,
                 const core::WorldState &state) {
  append_f32(buffer, static_cast<float>(state.ball_x - base.ball_x));
  append_f32(buffer, static_cast<float>(state.ball_y - base.ball_y));
  append_f32(buffer, static_cast<float>(state.ball_vx - base.ball_vx));
  append_f32(buffer, static_cast<float>(state.ball_vy - base.ball_vy));
  append_f32(buffer,
             static_cast<float>(state.left_paddle_y - base.left_paddle_y));
  append_f32(buffer,
             static_cast<float>(state.right_paddle_y - base.right_paddle_y));
  append_i16(buffer, static_cast<std::int16_t>(state.left_score -
                                               base.left_score));
  append_i16(buffer, static_cast<std::int16_t>(state.right_score -
                                               base.right_score));
  append_i8(buffer, static_cast<std::int8_t>(state.left_direction));
  append_i8(buffer, static_cast<std::int8_t>(state.right_direction));
}

core::WorldState apply_delta_to_state(const core::WorldState &base,
                                      const std::vector<std::uint8_t> &buffer,
                                      std::size_t &offset) {
  core::WorldState state = base;
  state.ball_x += static_cast<double>(read_f32(buffer, offset));
  state.ball_y += static_cast<double>(read_f32(buffer, offset));
  state.ball_vx += static_cast<double>(read_f32(buffer, offset));
  state.ball_vy += static_cast<double>(read_f32(buffer, offset));
  state.left_paddle_y += static_cast<double>(read_f32(buffer, offset));
  state.right_paddle_y += static_cast<double>(read_f32(buffer, offset));
  state.left_score = static_cast<std::uint32_t>(
      static_cast<std::int64_t>(base.left_score) + read_i16(buffer, offset));
  state.right_score = static_cast<std::uint32_t>(
      static_cast<std::int64_t>(base.right_score) + read_i16(buffer, offset));
  state.left_direction = read_i8(buffer, offset);
  state.right_direction = read_i8(buffer, offset);
  return state;
}

} // namespace

std::vector<std::uint8_t>
DeltaCodec::encode_keyframe(const core::WorldState &state) const {
  std::vector<std::uint8_t> buffer;
  buffer.reserve(34);
  write_state(buffer, state);
  return buffer;
}

core::WorldState
DeltaCodec::decode_keyframe(const std::vector<std::uint8_t> &data,
                            std::uint64_t tick) const {
  std::size_t offset = 0;
  auto state = read_state(data, offset);
  state.tick = tick;
  return state;
}

std::vector<std::uint8_t>
DeltaCodec::encode_delta(const core::WorldState &base,
                         const core::WorldState &state) const {
  std::vector<std::uint8_t> buffer;
  buffer.reserve(28);
  write_delta(buffer, base, state);
  return buffer;
}

core::WorldState
DeltaCodec::apply_delta(const core::WorldState &base,
                        const std::vector<std::uint8_t> &delta,
                        std::uint64_t tick) const {
  std::size_t offset = 0;
  auto state = apply_delta_to_state(base, delta, offset);
  state.tick = tick;
  return state;
}

} // namespace mini::sync
