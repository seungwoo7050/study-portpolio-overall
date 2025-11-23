find_package(Boost REQUIRED COMPONENTS system)
find_package(Threads REQUIRED)

add_library(lab1.3-ws-chat-lib
    room.cpp
    websocket_server.cpp
    websocket_session.cpp
)

target_include_directories(lab1.3-ws-chat-lib
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(lab1.3-ws-chat-lib
    PUBLIC
        Boost::system
        Threads::Threads
)

target_compile_options(lab1.3-ws-chat-lib
    PRIVATE
        -Wall -Wextra -Wpedantic -Werror
)

add_executable(lab1.3-ws-chat-server
    main.cpp
)

target_link_libraries(lab1.3-ws-chat-server
    PRIVATE
        lab1.3-ws-chat-lib
)

target_compile_options(lab1.3-ws-chat-server
    PRIVATE
        -Wall -Wextra -Wpedantic -Werror
)
