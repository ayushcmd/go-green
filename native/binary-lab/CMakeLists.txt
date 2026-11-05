cmake_minimum_required(VERSION 3.20)
project(gogreen_binary_lab CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

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
    ${CAPSTONE_INCLUDE_DIRS}
)

add_library(gogreen_binary_lab STATIC
    src/binary_file.cpp
    src/format_detector.cpp
    src/elf_parser.cpp
    src/pe_parser.cpp
    src/symbol_analyzer.cpp
    src/relocation_analyzer.cpp
    src/disassembler.cpp
    src/entropy_analyzer.cpp
    src/string_extractor.cpp
    src/binary_diff.cpp
    src/compiler_explorer.cpp
)

target_link_libraries(gogreen_binary_lab PUBLIC ${CAPSTONE_LIBRARIES} pthread)

# Unit test executable
add_executable(test_binary_lab
    tests/test_binary_lab.cpp
)
target_link_libraries(test_binary_lab PRIVATE gogreen_binary_lab ${CAPSTONE_LIBRARIES} pthread)

enable_testing()
add_test(NAME BinaryLabTest COMMAND test_binary_lab)
