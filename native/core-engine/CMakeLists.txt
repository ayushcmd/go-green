cmake_minimum_required(VERSION 3.20)
project(gogreen_core_engine CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler optimization and warnings
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -Wall -Wextra -Wpedantic -pthread")

find_package(PkgConfig QUIET)
if (PKG_CONFIG_FOUND)
    pkg_check_modules(CAPSTONE QUIET capstone)
endif()

if (NOT CAPSTONE_FOUND)
    find_path(CAPSTONE_INCLUDE_DIRS capstone/capstone.h PATHS /usr/include /usr/local/include)
    find_library(CAPSTONE_LIBRARIES NAMES capstone PATHS /usr/lib /usr/local/lib)
endif()

include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/../asm-kernels/include
    ${CMAKE_CURRENT_SOURCE_DIR}/../binary-lab/include
    ${CAPSTONE_INCLUDE_DIRS}
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
target_link_libraries(gogreen-daemon PRIVATE gogreen_core_engine gogreen_binary_lab gogreen_asm_kernels ${CAPSTONE_LIBRARIES} pthread)

# Unit test executable
add_executable(test_core_engine
    tests/test_core_engine.cpp
)
target_link_libraries(test_core_engine PRIVATE gogreen_core_engine gogreen_asm_kernels pthread)

enable_testing()
add_test(NAME CoreEngineTest COMMAND test_core_engine)
