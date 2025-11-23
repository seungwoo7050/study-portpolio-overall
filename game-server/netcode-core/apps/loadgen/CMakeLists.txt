find_package(Boost 1.82 REQUIRED COMPONENTS system)
find_package(Protobuf REQUIRED)

add_executable(loadgen
  bot.cpp
  main.cpp
)

target_include_directories(loadgen PRIVATE
  ${PROJECT_SOURCE_DIR}
  ${PROJECT_BINARY_DIR}
  ${Protobuf_INCLUDE_DIRS}
)

target_link_libraries(loadgen PRIVATE
  core
  mini_proto
  Boost::system
  ${Protobuf_LIBRARIES}
  pthread
)
