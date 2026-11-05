#pragma once

#include <cstdint>
#include <cstddef>
#include <vector>
#include <span>
#include <string>
#include <string_view>
#include <optional>
#include <stdexcept>
#include <iomanip>
#include <sstream>

namespace gogreen::binary {

class BinaryBuffer {
public:
    BinaryBuffer() = default;
    explicit BinaryBuffer(std::vector<uint8_t> data) : data_(std::move(data)) {}
    BinaryBuffer(const uint8_t* ptr, size_t size) : data_(ptr, ptr + size) {}

    [[nodiscard]] size_t size() const noexcept { return data_.size(); }
    [[nodiscard]] bool empty() const noexcept { return data_.empty(); }
    [[nodiscard]] const uint8_t* data() const noexcept { return data_.data(); }
    [[nodiscard]] const std::vector<uint8_t>& raw() const noexcept { return data_; }

    [[nodiscard]] bool has_bytes(size_t offset, size_t count) const noexcept {
        return (offset + count >= offset) && (offset + count <= data_.size());
    }

    [[nodiscard]] uint8_t read_u8(size_t offset) const {
        if (!has_bytes(offset, 1)) {
            throw std::out_of_range("BinaryBuffer::read_u8: Offset out of bounds");
        }
        return data_[offset];
    }

    [[nodiscard]] uint16_t read_u16_le(size_t offset) const {
        if (!has_bytes(offset, 2)) {
            throw std::out_of_range("BinaryBuffer::read_u16_le: Offset out of bounds");
        }
        return static_cast<uint16_t>(data_[offset]) |
               (static_cast<uint16_t>(data_[offset + 1]) << 8);
    }

    [[nodiscard]] uint16_t read_u16_be(size_t offset) const {
        if (!has_bytes(offset, 2)) {
            throw std::out_of_range("BinaryBuffer::read_u16_be: Offset out of bounds");
        }
        return (static_cast<uint16_t>(data_[offset]) << 8) |
               static_cast<uint16_t>(data_[offset + 1]);
    }

    [[nodiscard]] uint32_t read_u32_le(size_t offset) const {
        if (!has_bytes(offset, 4)) {
            throw std::out_of_range("BinaryBuffer::read_u32_le: Offset out of bounds");
        }
        return static_cast<uint32_t>(data_[offset]) |
               (static_cast<uint32_t>(data_[offset + 1]) << 8) |
               (static_cast<uint32_t>(data_[offset + 2]) << 16) |
               (static_cast<uint32_t>(data_[offset + 3]) << 24);
    }

    [[nodiscard]] uint32_t read_u32_be(size_t offset) const {
        if (!has_bytes(offset, 4)) {
            throw std::out_of_range("BinaryBuffer::read_u32_be: Offset out of bounds");
        }
        return (static_cast<uint32_t>(data_[offset]) << 24) |
               (static_cast<uint32_t>(data_[offset + 1]) << 16) |
               (static_cast<uint32_t>(data_[offset + 2]) << 8) |
               static_cast<uint32_t>(data_[offset + 3]);
    }

    [[nodiscard]] uint64_t read_u64_le(size_t offset) const {
        if (!has_bytes(offset, 8)) {
            throw std::out_of_range("BinaryBuffer::read_u64_le: Offset out of bounds");
        }
        return static_cast<uint64_t>(read_u32_le(offset)) |
               (static_cast<uint64_t>(read_u32_le(offset + 4)) << 32);
    }

    [[nodiscard]] uint64_t read_u64_be(size_t offset) const {
        if (!has_bytes(offset, 8)) {
            throw std::out_of_range("BinaryBuffer::read_u64_be: Offset out of bounds");
        }
        return (static_cast<uint64_t>(read_u32_be(offset)) << 32) |
               static_cast<uint64_t>(read_u32_be(offset + 4));
    }

    [[nodiscard]] std::string read_null_terminated_string(size_t offset, size_t max_len = 512) const {
        if (offset >= data_.size()) {
            return "";
        }
        std::string result;
        size_t limit = std::min(data_.size(), offset + max_len);
        for (size_t i = offset; i < limit && data_[i] != 0; ++i) {
            result.push_back(static_cast<char>(data_[i]));
        }
        return result;
    }

    [[nodiscard]] std::string read_fixed_string(size_t offset, size_t length) const {
        if (!has_bytes(offset, length)) {
            return "";
        }
        std::string result;
        for (size_t i = 0; i < length && data_[offset + i] != 0; ++i) {
            result.push_back(static_cast<char>(data_[offset + i]));
        }
        return result;
    }

    [[nodiscard]] std::span<const uint8_t> slice(size_t offset, size_t length) const {
        if (!has_bytes(offset, length)) {
            throw std::out_of_range("BinaryBuffer::slice: Out of bounds");
        }
        return std::span<const uint8_t>(data_.data() + offset, length);
    }

    [[nodiscard]] std::string compute_sha256() const;

private:
    std::vector<uint8_t> data_;
};

} // namespace gogreen::binary
