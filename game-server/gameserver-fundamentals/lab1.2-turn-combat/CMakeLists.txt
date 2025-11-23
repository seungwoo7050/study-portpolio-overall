add_executable(lab1.2-turn-combat
    game_server.cpp
)

target_include_directories(lab1.2-turn-combat
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_SOURCE_DIR}/../lab1.1-tcp-echo
)

target_link_libraries(lab1.2-turn-combat
    PRIVATE
        milestone_1_1_lib
        pthread
)

target_compile_options(lab1.2-turn-combat
    PRIVATE
        -Wall -Wextra -Wpedantic -Werror
)