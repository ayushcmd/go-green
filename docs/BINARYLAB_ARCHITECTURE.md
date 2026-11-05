# GoGreen BinaryLab Architecture Specification

## Phase 4: Advanced Binary Engineering

**Subsystem Identity:** BUILD DEEP. THINK LOW-LEVEL. ENGINEER BEYOND LIMITS.  
**Subsystem Scope:** Static Executable Analysis, Multi-Format Decoding, Capstone Disassembly, Entropy Intelligence & Isolated Compilation.  
**Implementation Standard:** C++23 native library (`native/binary-lab/`), Capstone v5.0.9 disassembly, POSIX-isolated compiler execution, and high-density industrial Studio UI.

---

## 1. System Overview & Modular Decomposition

GoGreen BinaryLab is engineered as a dedicated low-level binary inspection and reverse-engineering subsystem, decoupling raw binary parsing from presentation and execution:

```
+-----------------------------------------------------------------------------+
|                            GoGreen Studio UI                                |
| (Overview | Hex Intel | Structure | Disassembly | Symbols | Entropy | Compiler) |
+-----------------------------------------------------------------------------+
                                      |
                           HTTP REST / gRPC Mesh
                                      v
+-----------------------------------------------------------------------------+
|                      Native Daemon (127.0.0.1:8080)                          |
|  /api/v1/binary/analyze | /api/v1/binary/disassemble | /api/v1/compiler/compile |
+-----------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                     GoGreen BinaryLab C++23 Subsystem                       |
|                                                                             |
|  +--------------------+  +--------------------+  +-----------------------+  |
|  |   BinaryBuffer     |  |   FormatDetector   |  |   EntropyAnalyzer     |  |
|  |  (Bounds Checking, |  | (ELF32/64, PE32/+, |  | (Shannon, Chi-Square, |  |
|  |   SHA-256 Digest)  |  |   Machine, Endian) |  |   256-Bin Histogram)  |  |
|  +--------------------+  +--------------------+  +-----------------------+  |
|            |                       |                         |              |
|            v                       v                         v              |
|  +--------------------+  +--------------------+  +-----------------------+  |
|  |     ElfParser      |  |      PeParser      |  |    StringExtractor    |  |
|  | (Program/Sections, |  | (DOS, COFF, Opt,   |  | (ASCII / UTF-8, URLs, |  |
|  |  DynTags, Interp)  |  |  Imports, Exports) |  |  Paths, Format, Sym)  |  |
|  +--------------------+  +--------------------+  +-----------------------+  |
|            |                       |                         |              |
|            v                       v                         v              |
|  +--------------------+  +--------------------+  +-----------------------+  |
|  |   SymbolAnalyzer   |  | RelocationAnalyzer |  |      Disassembler     |  |
|  | (Symtab, Dynsym,   |  | (RELA / REL types, |  | (Capstone Engine v5.0 |  |
|  |  Import/Export)    |  |  Base Relocations) |  |  Branch Target Map)   |  |
|  +--------------------+  +--------------------+  +-----------------------+  |
|                                                                             |
|  +--------------------+  +-----------------------------------------------+  |
|  |     BinaryDiff     |  |               CompilerExplorer                |  |
|  | (Byte delta, Secs, |  | (Isolated fork/execvp, -masm=intel, Intel ASM,|  |
|  |  Symbols, Imports) |  |  Directives Sanitization, Timing Watchdog)    |  |
|  +--------------------+  +-----------------------------------------------+  |
+-----------------------------------------------------------------------------+
```

---

## 2. Component Design Specifications

### 2.1 `BinaryBuffer` (`binary_file.hpp`, `binary_file.cpp`)
- Encapsulates binary buffers with zero-copy views where applicable.
- Strict bounds assertions for primitive scalar reads: `read_u8`, `read_u16_le/be`, `read_u32_le/be`, `read_u64_le/be`.
- Built-in FIPS 180-4 compliant SHA-256 cryptographic digest computation without external OpenSSL dependencies.

### 2.2 `FormatDetector` (`format_detector.hpp`, `format_detector.cpp`)
- Inspects file headers to classify binary format: `ELF32`, `ELF64`, `PE32`, `PE32+`, or `RAW`.
- Detects endianness (Little Endian vs Big Endian) and target architecture (`x86-64`, `i386`, `ARM64`, `ARM`, `RISC-V`).
- Derives MIME type and executable/shared-library/relocatable flags.

### 2.3 `ElfParser` (`elf_parser.hpp`, `elf_parser.cpp`)
- Parses 32-bit and 64-bit ELF headers.
- Program header table extraction: segment types (`PT_LOAD`, `PT_DYNAMIC`, `PT_INTERP`), memory sizes, file offsets, virtual addresses, flags (`PF_X`, `PF_W`, `PF_R`).
- Section header table extraction with `.shstrtab` string name resolution.
- Computes per-section Shannon entropy.
- Dynamic tag traversal (`DT_NEEDED`, `DT_SONAME`, `DT_RPATH`, `DT_STRTAB`, `DT_SYMTAB`).

### 2.4 `PeParser` (`pe_parser.hpp`, `pe_parser.cpp`)
- Bounds-checked DOS header parsing (`e_magic == 'MZ'`, `e_lfanew` safety).
- PE signature (`'PE\0\0'`) and COFF header parsing (Machine, NumberOfSections, TimeDateStamp, Characteristics).
- Optional header parsing supporting both PE32 (0x10b) and PE32+ (0x20b).
- Section table walk: VirtualAddress, VirtualSize, SizeOfRawData, PointerToRawData, Characteristics (`IMAGE_SCN_MEM_EXECUTE`, `IMAGE_SCN_MEM_WRITE`).
- RVA-to-file-offset translation engine.
- Import directory traversal: module names, Import Lookup Table (ILT), Import Address Table (IAT), hint/name and ordinal thunk resolution.
- Export directory traversal: module name, ordinal base, AddressOfFunctions, AddressOfNames, AddressOfNameOrdinals.
- Base relocation table walk (`.reloc`) with block parsing and relocation types (`IMAGE_REL_BASED_HIGHLOW`, `IMAGE_REL_BASED_DIR64`).

### 2.5 `SymbolAnalyzer` & `RelocationAnalyzer`
- Normalizes ELF `.symtab` / `.dynsym` and PE Imports / Exports into unified `SymbolEntry` records.
- Classifies symbol types (`FUNCTION`, `OBJECT`, `SECTION`, `FILE`, `NOTYPE`) and bindings (`LOCAL`, `GLOBAL`, `WEAK`).
- Maps ELF relocations (`R_X86_64_64`, `R_X86_64_PC32`, `R_X86_64_PLT32`, `R_X86_64_GOTPCREL`, etc.) and PE base relocations into unified records.

### 2.6 `Disassembler` (`disassembler.hpp`, `disassembler.cpp`)
- Powered by Capstone Engine v5.0.9 (`CS_ARCH_X86`, `CS_MODE_64`).
- Enables detailed instruction parsing (`CS_OPT_DETAIL`).
- Decodes mnemonics, operands, opcode bytes, branch classifications (`is_call`, `is_jump`, `is_ret`), and immediate branch target addresses.
- Correlates target addresses with symbol tables to provide inline branch annotations (e.g., `<printf>`, `<gogreen_kernel_init>`).

### 2.7 `EntropyAnalyzer` & `StringExtractor`
- Computes Shannon entropy:
  $$H(X) = -\sum_{i=0}^{255} P(x_i) \log_2 P(x_i)$$
- Computes Chi-square goodness-of-fit against a uniform distribution.
- Produces 256-bin byte frequency distributions and contiguous block entropy profiles.
- Extracts printable ASCII and UTF-8 strings with classification into `URL`, `Path`, `Format`, `Symbol`, and `Generic`.

### 2.8 `BinaryDiff`
- High-performance binary comparator measuring exact byte variations.
- Groups contiguous differences into byte delta chunks with side-by-side hex representation.
- Performs section-by-section and symbol-by-symbol comparison (identifying added, removed, and modified sections and symbols).

### 2.9 `CompilerExplorer`
- Strictly contained compilation engine using POSIX `fork()` and `execvp()`.
- Zero shell string concatenation; uses direct argument vectors:
  `{ compiler, "-S", "-masm=intel", "-fno-asynchronous-unwind-tables", "-fno-dwarf2-cfi-asm", "-std=c++20", opt_level, "-o", asm_path, src_path, nullptr }`
- Captures compiler errors via POSIX pipes with a watchdog timeout.
- Filters and sanitizes noisy assembler directives (`.cfi_*`, `.file`, `.ident`) while preserving valid labels, directives, and instructions.

---

## 3. HTTP REST API Specifications

The native daemon listening at `http://127.0.0.1:8080` provides the following BinaryLab endpoints:

| Endpoint | Method | Input Payload | Output |
| :--- | :--- | :--- | :--- |
| `/api/v1/binary/analyze` | `POST` | `{"payload_base64": "...", "filename": "..."}` or raw bytes | Complete `BinaryAnalysisReport` JSON |
| `/api/v1/binary/disassemble` | `POST` | `{"code_base64": "...", "base_address": 4096}` | Array of `DisassembledInstruction` JSON |
| `/api/v1/binary/diff` | `POST` | `{"file_a_base64": "...", "name_a": "...", "file_b_base64": "...", "name_b": "..."}` | `BinaryDiffReport` JSON |
| `/api/v1/compiler/compile` | `POST` | `{"source_code": "...", "compiler": "g++", "optimization_level": "-O2"}` | `CompilerResult` JSON with Intel assembly |
