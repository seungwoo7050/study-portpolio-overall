# Matcher service - matchmaking service

add_executable(matcher
    main.cpp
)

target_link_libraries(matcher
    PRIVATE match
)

# Enable C++17
target_compile_features(matcher PRIVATE cxx_std_17)

# Warnings
target_compile_options(matcher PRIVATE
    -Wall -Wextra -Wpedantic
    $<$<CONFIG:Debug>:-g -O0>
    $<$<CONFIG:Release>:-O3>
)

# Install
install(TARGETS matcher
    RUNTIME DESTINATION bin
)
