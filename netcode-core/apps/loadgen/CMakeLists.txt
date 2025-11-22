find_package(Boost 1.82 REQUIRED COMPONENTS system)
find_package(Protobuf REQUIRED)

add_executable(loadgen
  bot.cpp
  main.cpp
)

target_include_directories(loadgen PRIVATE
  ${CMAKE_SOURCE_DIR}/src
  ${CMAKE_BINARY_DIR}/proto
  ${Protobuf_INCLUDE_DIRS}
)

target_link_libraries(loadgen PRIVATE
  core
  mini_proto
  Boost::system
  ${Protobuf_LIBRARIES}
  pthread
)
