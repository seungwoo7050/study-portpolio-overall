add_library(sync
    snapshot.cpp
    delta.cpp
    prediction.cpp
    reconciliation.cpp
    time_sync.cpp
)

target_include_directories(sync
    PUBLIC
        ${PROJECT_SOURCE_DIR}
)

target_link_libraries(sync
    PUBLIC
        core
)

target_compile_options(sync
    PUBLIC
        -Wall -Wextra -Wpedantic -Werror
)
