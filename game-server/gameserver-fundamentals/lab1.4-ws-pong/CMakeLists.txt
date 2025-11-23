find_package(Boost REQUIRED COMPONENTS system json)
find_package(Threads REQUIRED)

add_library(lab1.4-ws-pong-lib INTERFACE)

target_include_directories(lab1.4-ws-pong-lib
    INTERFACE
        ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(lab1.4-ws-pong-lib
    INTERFACE
        Boost::system
        Boost::json
        Threads::Threads
)

target_compile_options(lab1.4-ws-pong-lib
    INTERFACE
        -Wall -Wextra -Wpedantic -Werror
)

add_executable(lab1.4-ws-pong-server
    main.cpp
)

target_link_libraries(lab1.4-ws-pong-server
    PRIVATE
        lab1.4-ws-pong-lib
        Boost::system
        Boost::json
        Threads::Threads
)

target_compile_options(lab1.4-ws-pong-server
    PRIVATE
        -Wall -Wextra -Wpedantic -Werror
)

add_executable(lab1.4-ws-pong-metrics
    metrics_client.cpp
)

target_link_libraries(lab1.4-ws-pong-metrics
    PRIVATE
        Boost::system
        Boost::json
        Threads::Threads
)

target_compile_options(lab1.4-ws-pong-metrics
    PRIVATE
        -Wall -Wextra -Wpedantic -Werror
)
