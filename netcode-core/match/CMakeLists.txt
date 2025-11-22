# Match module - matchmaking and room management

add_library(match STATIC
    matchmaker.cpp
    room_manager.cpp
)

target_include_directories(match
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}
)

# Find hiredis
find_path(HIREDIS_INCLUDE_DIR hiredis/hiredis.h)
find_library(HIREDIS_LIBRARY hiredis)

if(NOT HIREDIS_INCLUDE_DIR OR NOT HIREDIS_LIBRARY)
    message(FATAL_ERROR "hiredis not found. Please install: apt-get install libhiredis-dev")
endif()

target_include_directories(match PRIVATE ${HIREDIS_INCLUDE_DIR})
target_link_libraries(match PRIVATE ${HIREDIS_LIBRARY})

# Enable C++17
target_compile_features(match PUBLIC cxx_std_17)

# Warnings
target_compile_options(match PRIVATE
    -Wall -Wextra -Wpedantic
    $<$<CONFIG:Debug>:-g -O0>
    $<$<CONFIG:Release>:-O3>
)
