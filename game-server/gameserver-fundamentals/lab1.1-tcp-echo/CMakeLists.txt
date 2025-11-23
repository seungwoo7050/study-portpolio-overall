# ---- Library: lab1-tcp-echo ------------------------------------

add_library(lab1-tcp-echo
    socket.cpp
    echo_server.cpp
)

add_library(milestone_1_1_lib ALIAS lab1-tcp-echo)

# 이 디렉터리를 include path 로 노출
target_include_directories(lab1-tcp-echo
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
)

# Threads::Thread 를 라이브러리에 걸지 않고
# 실행파일에만 걸어도 되고, 여기 PUBLIC 으로 해도 됨.
# (여기서는 실행파일에만 링크)

# ---- Executable: lab1-tcp-echo-server ----------------------------

add_executable(lab1-tcp-echo-server
    main.cpp
)

target_link_libraries(lab1-tcp-echo-server
    PRIVATE
        lab1-tcp-echo
        Threads::Threads
)

# ---- Convenience target: re all ----------------------------------

add_custom_target(re-lab1
    COMMAND ${CMAKE_BUILD_TOOL} clean
    COMMAND ${CMAKE_BUILD_TOOL} lab1-tcp-echo-server
    COMMENT "Clean and rebuild lab1: TCP echo server (re-lab1)"
)