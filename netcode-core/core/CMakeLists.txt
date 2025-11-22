add_library(core STATIC
    game_loop.cpp
    physics.cpp
    player.cpp
    world.cpp
)

target_include_directories(core
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_SOURCE_DIR}/..
)

target_compile_options(core
    PUBLIC
        -Wall -Wextra -Wpedantic -Werror
)
