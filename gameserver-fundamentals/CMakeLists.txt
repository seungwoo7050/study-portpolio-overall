cmake_minimum_required(VERSION 3.20)
project(gameserver-basics-lab 
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

option(ENABLE_LAB1 "Build lab1: TCP echo server" ON)
option(ENABLE_LAB2 "Build lab2: Turn-based 10 TPS server" OFF)
option(ENABLE_LAB3 "Build lab3: WebSocket chat server" OFF)
option(ENABLE_LAB4 "Build lab4: Pong WebSocket 60 TPS server" OFF)

# ----- Subdirectories -------------------------------------------
if(ENABLE_LAB1)
    add_subdirectory(src/lab1-tcp-echo)
endif()

if(ENABLE_LAB2)
    add_subdirectory(src/lab2-turn-based-10tps)
endif()

if(ENABLE_LAB3)
    add_subdirectory(src/lab3-websocket-chat)
endif()

if(ENABLE_LAB4)
    add_subdirectory(src/lab4-pong-60tps)
endif()

# ----- Convenience target: re -------------------------------------

add_custom_target(re
    COMMAND ${CMAKE_BUILD_TOOL} clean
    COMMAND ${CMAKE_BUILD_TOOL} all
    COMMENT "Clean and rebuild entire project (re)"
)