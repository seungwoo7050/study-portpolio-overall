find_package(Boost REQUIRED COMPONENTS system)
find_package(Threads REQUIRED)

add_library(pong_udp_lib STATIC
    pong_udp_server.cpp
)

target_include_directories(pong_udp_lib
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_SOURCE_DIR}/src
)

target_link_libraries(pong_udp_lib
    PRIVATE
        core
        net_udp
        sync
        metrics
        match
        mini_proto
        Boost::system
        Threads::Threads
)

target_compile_options(pong_udp_lib
    PRIVATE
        -Wall -Wextra -Wpedantic -Werror
)

add_executable(pong_udp
    main.cpp
)

target_link_libraries(pong_udp
    PRIVATE
        pong_udp_lib
)

target_compile_options(pong_udp
    PRIVATE
        -Wall -Wextra -Wpedantic -Werror
)
