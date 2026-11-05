#pragma once

#include "gogreen/binary/binary_file.hpp"
#include <string>

namespace gogreen::binary {

enum class BinaryFormat {
    UNKNOWN,
    ELF32,
    ELF64,
    PE32,
    PE32_PLUS,
    RAW
};

enum class MachineArchitecture {
    UNKNOWN,
    X86_32,
    X86_64,
    ARM32,
    AARCH64,
    RISCV32,
    RISCV64
};

enum class Endianness {
    LITTLE,
    BIG
};

struct FormatInfo {
    BinaryFormat format = BinaryFormat::UNKNOWN;
    MachineArchitecture architecture = MachineArchitecture::UNKNOWN;
    Endianness endianness = Endianness::LITTLE;
    std::string format_name = "Unknown";
    std::string architecture_name = "Unknown";
    std::string mime_type = "application/octet-stream";
    bool is_executable = false;
    bool is_shared_library = false;
    bool is_relocatable = false;
};

class FormatDetector {
public:
    static FormatInfo detect(const BinaryBuffer& buffer);
};

} // namespace gogreen::binary
