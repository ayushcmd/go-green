cmake_minimum_required(VERSION 3.20)
project(gogreen_core_engine CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler optimization and warnings
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -Wall -Wextra -Wpedantic -pthread")

include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/../asm-kernels/include
)

# Core engine library
add_library(gogreen_core_engine STATIC
    src/cpu_info.cpp
    src/cpu_features.cpp
    src/hardware_info.cpp
    src/benchmark.cpp
    src/engine.cpp
)

target_link_libraries(gogreen_core_engine PUBLIC gogreen_asm_kernels)

# Daemon executable
add_executable(gogreen-daemon
    src/main.cpp
)
target_link_libraries(gogreen-daemon PRIVATE gogreen_core_engine gogreen_asm_kernels pthread)

# Unit test executable
add_executable(test_core_engine
    tests/test_core_engine.cpp
)
target_link_libraries(test_core_engine PRIVATE gogreen_core_engine gogreen_asm_kernels pthread)

enable_testing()
add_test(NAME CoreEngineTest COMMAND test_core_engine)
