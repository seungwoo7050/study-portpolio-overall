add_library(metrics STATIC
  prometheus.cpp
)

target_include_directories(metrics PUBLIC
    ${PROJECT_SOURCE_DIR}
)

target_link_libraries(metrics
    PUBLIC
        Threads::Threads
)
