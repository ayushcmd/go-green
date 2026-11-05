# GoGreen Binary Security & Isolation Model

## 1. Untrusted Binary Ingestion Policy

BinaryLab inspects executables that may originate from untrusted or unverified sources. The following security invariants are enforced:

1. **Zero Execution of Analyzed Files:**
   - Uploaded binary specimens are **NEVER executed**.
   - Analysis is 100% static: inspecting headers, decoding sections, calculating cryptographic digests, computing entropy, and disassembling opcode bytes.

2. **Strict Bounds Checking:**
   - Every file offset, section offset, string pointer, and table index is bounds-checked against the buffer size prior to dereferencing.
   - Out-of-bounds access throws `std::out_of_range` internally, which is caught and converted to an error message, preventing buffer over-reads and crashes.

3. **Input Size Limits:**
   - Binary uploads are bounded to a maximum file size (default: 32MB) to prevent memory exhaustion (DoS).
   - Base64 decoders enforce bounded memory allocation.

---

## 2. Compiler Explorer Isolation

The Compiler Explorer compiles user-submitted C++ source code to Intel-syntax assembly. To prevent code execution during compilation:

1. **No Shell Invocations:**
   - The engine never calls `system()` or `popen()` with formatted strings.
   - It directly uses `fork()` and `execvp()` with a fixed argument vector:
     `{ compiler, "-S", "-masm=intel", "-fno-asynchronous-unwind-tables", "-fno-dwarf2-cfi-asm", "-std=c++20", opt_level, "-o", asm_path, src_path, nullptr }`

2. **Assembly-Only Mode (`-S`):**
   - The compiler is explicitly instructed to emit assembly (`-S`) and stop before linking.
   - No binary executable is produced, and no user code is linked or executed.

3. **Process Sandboxing & Timeouts:**
   - Temporary source and assembly files are stored under `/tmp/gogreen_src_XXXXXX.cpp` with strict file permissions (`0600`) and are unlinked immediately after compilation.
   - The compilation process is monitored by a watchdog timer (`timeout_ms = 5000`); hung or recursive templates are terminated via `SIGKILL`.

4. **Assembler Output Sanitization:**
   - Generated assembly is filtered to strip noisy directives (`.cfi_*`, `.file`, `.ident`) while preserving valid labels and instructions.
