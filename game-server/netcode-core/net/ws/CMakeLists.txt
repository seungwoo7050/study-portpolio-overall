add_library(net_ws INTERFACE)

target_include_directories(net_ws
    INTERFACE
        ${CMAKE_CURRENT_SOURCE_DIR}
)

target_compile_options(net_ws
    INTERFACE
        -Wall -Wextra -Wpedantic -Werror
)
