#pragma once

#include <atomic>
#include <cstdint>

namespace core {

enum class PlayerSide : std::uint8_t { Left = 0, Right = 1, Spectator = 2 };

class PlayerInput {
public:
  PlayerInput();

  void set_direction(int direction);
  int direction() const;

private:
  std::atomic<int> direction_;
};

} // namespace core
