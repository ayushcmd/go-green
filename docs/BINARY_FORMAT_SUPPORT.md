# GoGreen Binary Format Support Specification

## 1. Supported Executable & Object Formats

GoGreen BinaryLab implements native C++23 format parsers with strict bounds-checking for:

1. **Executable and Linkable Format (ELF)**:
   - ELF32 and ELF64 variants.
   - Endianness: Little Endian (`ELFDATA2LSB`) and Big Endian (`ELFDATA2MSB`).
   - Architectures: `x86-64` (`EM_X86_64 = 62`), `i386` (`EM_386 = 3`), `AArch64` (`EM_AARCH64 = 183`), `ARM` (`EM_ARM = 40`), `RISC-V` (`EM_RISCV = 243`).
   - Headers: Program headers (`PT_LOAD`, `PT_DYNAMIC`, `PT_INTERP`, `PT_NOTE`, `PT_GNU_STACK`, `PT_GNU_RELRO`), Section headers (`SHT_PROGBITS`, `SHT_SYMTAB`, `SHT_STRTAB`, `SHT_RELA`, `SHT_DYNAMIC`, `SHT_NOBITS`).
   - Dynamic entries: `DT_NEEDED`, `DT_SONAME`, `DT_RPATH`, `DT_RUNPATH`, `DT_INIT`, `DT_FINI`.
   - String table `.shstrtab` and symbol string table `.strtab` bounds-safe resolution.

2. **Portable Executable (PE)**:
   - Formats: PE32 (32-bit x86/ARM) and PE32+ (64-bit AMD64/ARM64).
   - MS-DOS header with `e_magic == 0x5A4D` (`MZ`) and `e_lfanew` bounds validation.
   - PE signature `0x00004550` (`PE\0\0`).
   - COFF File Header: Machine types (`0x8664` AMD64, `0x014c` i386, `0xaa64` ARM64), NumberOfSections, TimeDateStamp, Characteristics.
   - Optional Header: Magic (`0x10b` PE32, `0x20b` PE32+), AddressOfEntryPoint, ImageBase, SectionAlignment, FileAlignment, Subsystem (GUI vs CUI).
   - Section Table: VirtualAddress, VirtualSize, SizeOfRawData, PointerToRawData, Characteristics (`IMAGE_SCN_MEM_EXECUTE`, `IMAGE_SCN_MEM_READ`, `IMAGE_SCN_MEM_WRITE`).
   - Import Directory: DLL name resolution, Import Lookup Table (ILT), Import Address Table (IAT), ordinal vs hint/name thunks.
   - Export Directory: Exported function names, ordinal bases, RVA addresses, forwarder strings.
   - Base Relocations (`.reloc`): Page RVA blocks, offset and relocation types (`IMAGE_REL_BASED_HIGHLOW`, `IMAGE_REL_BASED_DIR64`).

3. **Raw Binary**:
   - Arbitrary binary byte streams, firmware dumps, and unformatted memory images.
   - Shannon entropy profiling, printable string extraction, and arbitrary-offset Capstone disassembly.

---

## 2. Defensive Bounds Checking & Malformed File Handling

All input buffers are treated as untrusted:
- `BinaryBuffer::has_bytes(offset, count)` verifies that `offset + count <= buffer.size()` without integer overflow.
- If an offset, RVA, section header, or string index points outside buffer memory, parsing safely truncates or reports validation warnings without memory corruption or segmentation faults.
- Truncated or malformed headers are rejected with descriptive diagnostic error codes.
