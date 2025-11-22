add_library(metrics STATIC
  prometheus.cpp
)

target_include_directories(metrics PUBLIC
  ${CMAKE_SOURCE_DIR}/src
)

target_link_libraries(metrics
  PUBLIC
    pthread
)
