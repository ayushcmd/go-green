#include "gogreen/binary/format_detector.hpp"

namespace gogreen::binary {

FormatInfo FormatDetector::detect(const BinaryBuffer& buffer) {
    FormatInfo info;
    if (buffer.size() < 4) {
        info.format = BinaryFormat::RAW;
        info.format_name = "Raw Binary";
        return info;
    }

    // 1. Check ELF Magic: 0x7F, 'E', 'L', 'F'
    if (buffer.read_u8(0) == 0x7F &&
        buffer.read_u8(1) == 'E' &&
        buffer.read_u8(2) == 'L' &&
        buffer.read_u8(3) == 'F') {

        if (buffer.size() < 16) {
            info.format = BinaryFormat::RAW;
            return info;
        }

        uint8_t elf_class = buffer.read_u8(4);
        uint8_t elf_data = buffer.read_u8(5);
        info.endianness = (elf_data == 2) ? Endianness::BIG : Endianness::LITTLE;

        if (elf_class == 1) {
            info.format = BinaryFormat::ELF32;
            info.format_name = "ELF 32-bit";
        } else if (elf_class == 2) {
            info.format = BinaryFormat::ELF64;
            info.format_name = "ELF 64-bit";
        } else {
            info.format = BinaryFormat::RAW;
            return info;
        }

        info.mime_type = "application/x-executable";

        if (buffer.has_bytes(16, 4)) {
            uint16_t elf_type = (info.endianness == Endianness::LITTLE)
                ? buffer.read_u16_le(16) : buffer.read_u16_be(16);
            uint16_t machine = (info.endianness == Endianness::LITTLE)
                ? buffer.read_u16_le(18) : buffer.read_u16_be(18);

            info.is_relocatable = (elf_type == 1); // ET_REL
            info.is_executable = (elf_type == 2);  // ET_EXEC
            info.is_shared_library = (elf_type == 3); // ET_DYN

            switch (machine) {
                case 0x03:
                    info.architecture = MachineArchitecture::X86_32;
                    info.architecture_name = "x86 (32-bit)";
                    break;
                case 0x3E:
                    info.architecture = MachineArchitecture::X86_64;
                    info.architecture_name = "x86-64";
                    break;
                case 0x28:
                    info.architecture = MachineArchitecture::ARM32;
                    info.architecture_name = "ARM (32-bit)";
                    break;
                case 0xB7:
                    info.architecture = MachineArchitecture::AARCH64;
                    info.architecture_name = "AArch64 (ARM 64-bit)";
                    break;
                case 0xF3:
                    info.architecture = (elf_class == 2)
                        ? MachineArchitecture::RISCV64 : MachineArchitecture::RISCV32;
                    info.architecture_name = (elf_class == 2) ? "RISC-V 64-bit" : "RISC-V 32-bit";
                    break;
                default:
                    info.architecture = MachineArchitecture::UNKNOWN;
                    info.architecture_name = "Other (" + std::to_string(machine) + ")";
                    break;
            }
        }
        return info;
    }

    // 2. Check PE / DOS Header: 'M', 'Z'
    if (buffer.read_u8(0) == 'M' && buffer.read_u8(1) == 'Z') {
        if (buffer.has_bytes(0x3C, 4)) {
            uint32_t pe_offset = buffer.read_u32_le(0x3C);
            if (buffer.has_bytes(pe_offset, 24)) {
                // Check PE Signature: 'P', 'E', 0, 0
                if (buffer.read_u8(pe_offset) == 'P' &&
                    buffer.read_u8(pe_offset + 1) == 'E' &&
                    buffer.read_u8(pe_offset + 2) == 0 &&
                    buffer.read_u8(pe_offset + 3) == 0) {

                    uint16_t machine = buffer.read_u16_le(pe_offset + 4);
                    uint16_t characteristics = buffer.read_u16_le(pe_offset + 22);

                    info.is_executable = (characteristics & 0x0002) != 0;
                    info.is_shared_library = (characteristics & 0x2000) != 0;
                    info.is_relocatable = (characteristics & 0x0001) == 0;
                    info.endianness = Endianness::LITTLE;
                    info.mime_type = "application/vnd.microsoft.portable-executable";

                    // Check Optional Header Magic at pe_offset + 24
                    uint16_t opt_magic = buffer.read_u16_le(pe_offset + 24);
                    if (opt_magic == 0x020B) {
                        info.format = BinaryFormat::PE32_PLUS;
                        info.format_name = "PE32+ (64-bit)";
                    } else if (opt_magic == 0x010B) {
                        info.format = BinaryFormat::PE32;
                        info.format_name = "PE32 (32-bit)";
                    } else {
                        info.format = BinaryFormat::PE32;
                        info.format_name = "PE (Generic)";
                    }

                    switch (machine) {
                        case 0x014C:
                            info.architecture = MachineArchitecture::X86_32;
                            info.architecture_name = "x86 (32-bit)";
                            break;
                        case 0x8664:
                            info.architecture = MachineArchitecture::X86_64;
                            info.architecture_name = "x86-64";
                            break;
                        case 0xAA64:
                            info.architecture = MachineArchitecture::AARCH64;
                            info.architecture_name = "ARM64";
                            break;
                        default:
                            info.architecture = MachineArchitecture::UNKNOWN;
                            info.architecture_name = "Other (" + std::to_string(machine) + ")";
                            break;
                    }
                    return info;
                }
            }
        }
        // Fallback for DOS executable without PE header
        info.format = BinaryFormat::RAW;
        info.format_name = "MS-DOS Executable (MZ)";
        return info;
    }

    info.format = BinaryFormat::RAW;
    info.format_name = "Raw Binary";
    return info;
}

} // namespace gogreen::binary
