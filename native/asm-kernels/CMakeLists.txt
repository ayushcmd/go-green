cmake_minimum_required(VERSION 3.20)
project(gogreen_asm_kernels LANGUAGES C CXX ASM_NASM)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(ASM_SOURCES
    src/asm_add.asm
    src/asm_memcpy.asm
    src/asm_memcmp.asm
    src/asm_byte_sum.asm
    src/asm_simd.asm
)

set_source_files_properties(${ASM_SOURCES} PROPERTIES
    LANGUAGE ASM_NASM
    COMPILE_FLAGS "-f elf64 -g -F dwarf"
)

add_library(gogreen_asm_kernels STATIC
    ${ASM_SOURCES}
    src/asm_fallbacks.cpp
)

target_include_directories(gogreen_asm_kernels PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
)

add_executable(test_asm_kernels tests/test_asm_kernels.cpp)
target_link_libraries(test_asm_kernels PRIVATE gogreen_asm_kernels)
target_include_directories(test_asm_kernels PRIVATE include)

enable_testing()
add_test(NAME test_asm_kernels COMMAND test_asm_kernels)
