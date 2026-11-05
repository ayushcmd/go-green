#include "gogreen/binary/disassembler.hpp"
#include <capstone/capstone.h>
#include <iomanip>
#include <sstream>

namespace gogreen::binary {

Disassembler::Disassembler() {
    csh h = 0;
    if (cs_open(CS_ARCH_X86, CS_MODE_64, &h) == CS_ERR_OK) {
        handle_ = static_cast<uintptr_t>(h);
        cs_option(h, CS_OPT_DETAIL, CS_OPT_ON);
        initialized_ = true;
    }
}

Disassembler::~Disassembler() {
    if (initialized_ && handle_ != 0) {
        csh h = static_cast<csh>(handle_);
        cs_close(&h);
        handle_ = 0;
        initialized_ = false;
    }
}

Disassembler::Disassembler(Disassembler&& other) noexcept
    : handle_(other.handle_), initialized_(other.initialized_) {
    other.handle_ = 0;
    other.initialized_ = false;
}

Disassembler& Disassembler::operator=(Disassembler&& other) noexcept {
    if (this != &other) {
        if (initialized_ && handle_ != 0) {
            csh h = static_cast<csh>(handle_);
            cs_close(&h);
        }
        handle_ = other.handle_;
        initialized_ = other.initialized_;
        other.handle_ = 0;
        other.initialized_ = false;
    }
    return *this;
}

std::vector<DisassembledInstruction> Disassembler::disassemble(
    const uint8_t* code,
    size_t size,
    uint64_t base_address,
    size_t max_instructions,
    const std::map<uint64_t, std::string>& symbol_map) const {

    std::vector<DisassembledInstruction> result;
    if (!initialized_ || code == nullptr || size == 0) {
        return result;
    }

    csh h = static_cast<csh>(handle_);
    cs_insn* insn = nullptr;
    size_t count = cs_disasm(h, code, size, base_address, max_instructions, &insn);

    if (count > 0 && insn != nullptr) {
        result.reserve(count);
        for (size_t j = 0; j < count; ++j) {
            DisassembledInstruction item;
            item.address = insn[j].address;
            item.size = insn[j].size;
            item.mnemonic = insn[j].mnemonic;
            item.operands = insn[j].op_str;

            // Format opcode bytes as space-separated hex
            std::ostringstream byte_ss;
            for (size_t b = 0; b < insn[j].size; ++b) {
                if (b > 0) byte_ss << ' ';
                byte_ss << std::hex << std::setw(2) << std::setfill('0')
                        << static_cast<int>(insn[j].bytes[b]);
            }
            item.bytes = byte_ss.str();

            // Check instruction details for groups (CALL, JUMP, RET)
            if (insn[j].detail != nullptr) {
                const cs_detail* detail = insn[j].detail;
                for (uint8_t g = 0; g < detail->groups_count; ++g) {
                    if (detail->groups[g] == CS_GRP_CALL) item.is_call = true;
                    if (detail->groups[g] == CS_GRP_JUMP) item.is_jump = true;
                    if (detail->groups[g] == CS_GRP_RET) item.is_ret = true;
                }

                // If branch or call, check for immediate target
                if (item.is_call || item.is_jump) {
                    const cs_x86& x86 = detail->x86;
                    for (uint8_t op_i = 0; op_i < x86.op_count; ++op_i) {
                        if (x86.operands[op_i].type == X86_OP_IMM) {
                            item.target_address = static_cast<uint64_t>(x86.operands[op_i].imm);
                            break;
                        }
                    }
                }
            }

            // Symbol annotations
            if (item.target_address != 0) {
                auto it = symbol_map.find(item.target_address);
                if (it != symbol_map.end()) {
                    item.symbol_annotation = "<" + it->second + ">";
                }
            } else {
                auto it = symbol_map.find(item.address);
                if (it != symbol_map.end()) {
                    item.symbol_annotation = "<" + it->second + ">";
                }
            }

            result.push_back(std::move(item));
        }
        cs_free(insn, count);
    }

    return result;
}

} // namespace gogreen::binary
