# GoGreen Capstone Disassembly Engine Specification

## 1. Disassembly Architecture

GoGreen BinaryLab integrates Capstone Engine v5.0.9 for industrial x86-64 disassembly:

- **Architecture:** `CS_ARCH_X86`
- **Mode:** `CS_MODE_64` (64-bit AMD64 instruction decoding)
- **Detail Mode:** `CS_OPT_DETAIL` enabled (`CS_OPT_ON`) for complete instruction operand and group inspection.

---

## 2. Instruction Decoding & Branch Correlation

Each decoded instruction produces a `DisassembledInstruction` record containing:

- `address`: Virtual memory address of the instruction.
- `size`: Instruction length in bytes (1 to 15 bytes).
- `bytes`: Hexadecimal space-separated representation of opcode bytes (e.g., `48 89 5c 24 08`).
- `mnemonic`: Assembly mnemonic (e.g., `mov`, `sub`, `call`, `jmp`, `ret`).
- `operands`: Formatted Intel-syntax operands (e.g., `qword ptr [rsp + 8], rbx`).
- `is_call`: Flag indicating subroutine invocation (`CS_GRP_CALL`).
- `is_jump`: Flag indicating conditional or unconditional jump (`CS_GRP_JUMP`).
- `is_ret`: Flag indicating subroutine return (`CS_GRP_RET`).
- `target_address`: Immediate jump or call destination address extracted from `x86.operands[i].imm`.
- `symbol_annotation`: Inlined symbol name if the branch target address or current instruction address matches an entry in the symbol table (e.g., `<printf>`, `<gogreen_kernel_init>`).

---

## 3. Disassembly Resource Limits & Streaming

- The disassembly API supports bounded streaming via `max_instructions` (default: 500, configurable up to 2000 per chunk).
- The disassembler safely terminates when code ends or an invalid opcode byte is encountered.
