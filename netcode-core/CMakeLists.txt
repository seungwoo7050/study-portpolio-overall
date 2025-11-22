cmake_minimum_required(VERSION 3.20)
project(netcode-core VERSION 1.3 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_POSITION_INDEPENDENT_CODE ON)

add_compile_options(-Wall -Wextra -Wpedantic -Werror)

find_package(Threads REQUIRED)
find_package(Protobuf REQUIRED)
find_package(Boost REQUIRED COMPONENTS system)

set(PROTO_GEN_DIR ${CMAKE_CURRENT_BINARY_DIR})
protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS proto/mini.proto)

add_library(mini_proto ${PROTO_SRCS} ${PROTO_HDRS})
target_include_directories(mini_proto
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/proto
        ${PROTO_GEN_DIR}
        ${Protobuf_INCLUDE_DIRS}
)
target_link_libraries(mini_proto PUBLIC ${Protobuf_LIBRARIES})

add_subdirectory(core)
add_subdirectory(net)
add_subdirectory(sync)
add_subdirectory(metrics)
add_subdirectory(match)
add_subdirectory(apps)
