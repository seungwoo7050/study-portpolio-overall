find_package(Boost REQUIRED COMPONENTS system)

add_library(net_udp STATIC
    udp_transport.cpp
)

target_include_directories(net_udp
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${PROJECT_SOURCE_DIR}
)

target_link_libraries(net_udp
    PUBLIC
        Boost::system
)

target_compile_options(net_udp
    PUBLIC
        -Wall -Wextra -Wpedantic -Werror
)
