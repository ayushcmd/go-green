#pragma once

#include "gogreen/binary/symbol_analyzer.hpp"
#include <cstdint>
#include <cstddef>
#include <string>
#include <vector>
#include <map>

namespace gogreen::binary {

struct DisassembledInstruction {
    uint64_t address = 0;
    size_t size = 0;
    std::string bytes;
    std::string mnemonic;
    std::string operands;
    bool is_call = false;
    bool is_jump = false;
    bool is_ret = false;
    uint64_t target_address = 0;
    std::string symbol_annotation;
};

class Disassembler {
public:
    Disassembler();
    ~Disassembler();

    Disassembler(const Disassembler&) = delete;
    Disassembler& operator=(const Disassembler&) = delete;
    Disassembler(Disassembler&& other) noexcept;
    Disassembler& operator=(Disassembler&& other) noexcept;

    [[nodiscard]] bool is_initialized() const noexcept { return initialized_; }

    [[nodiscard]] std::vector<DisassembledInstruction> disassemble(
        const uint8_t* code,
        size_t size,
        uint64_t base_address,
        size_t max_instructions = 1000,
        const std::map<uint64_t, std::string>& symbol_map = {}) const;

private:
    uintptr_t handle_ = 0; // csh handle
    bool initialized_ = false;
};

} // namespace gogreen::binary
