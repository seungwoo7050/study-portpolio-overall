cmake_minimum_required(VERSION 3.20)
project(gameserver-fundamentals
    VERSION 0.1.0
    LANGUAGES CXX
)

# ----- Global C++ settings --------------------------------------
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler warnings
add_compile_options(-Wall -Wextra -Wpedantic -Werror)

# Thread library
find_package(Threads REQUIRED)

# ----- Lab build options ----------------------------------------

option(ENABLE_LAB1_1 "Build lab1.1: TCP echo server" ON)
option(ENABLE_LAB1_2 "Build lab1.2: Turn-based 10 TPS server" ON)
option(ENABLE_LAB1_3 "Build lab1.3: WebSocket chat server" ON)
option(ENABLE_LAB1_4 "Build lab1.4: Pong WebSocket 60 TPS server" ON)

# ----- Subdirectories -------------------------------------------
if(ENABLE_LAB1_1)
    add_subdirectory(lab1.1-tcp-echo)
endif()

if(ENABLE_LAB1_2)
    add_subdirectory(lab1.2-turn-combat)
endif()

if(ENABLE_LAB1_3)
    add_subdirectory(lab1.3-ws-chat)
endif()

if(ENABLE_LAB1_4)
    add_subdirectory(lab1.4-ws-pong)
endif()

# ----- Convenience target: re -------------------------------------

add_custom_target(re
    COMMAND ${CMAKE_BUILD_TOOL} clean
    COMMAND ${CMAKE_BUILD_TOOL} all
    COMMENT "Clean and rebuild entire project (re)"
)