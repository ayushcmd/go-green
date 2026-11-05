cmake_minimum_required(VERSION 3.20)
project(gogreen_native LANGUAGES C CXX ASM_NASM)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

enable_testing()

add_subdirectory(asm-kernels)
add_subdirectory(core-engine)
add_subdirectory(binary-lab)
