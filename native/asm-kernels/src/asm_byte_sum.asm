default rel
section .text
global asm_byte_sum

; ==============================================================================
; uint64_t asm_byte_sum(const uint8_t* data, size_t count);
; System V AMD64 ABI:
;   Input:
;     RDI: pointer to byte array
;     RSI: count
;   Output:
;     RAX: 64-bit unsigned sum
;   Preserves: RBX, RSP, RBP, R12-R15
; ==============================================================================
asm_byte_sum:
    xor rax, rax        ; sum = 0
    test rsi, rsi
    jz .done

    mov rcx, rsi
    mov r8, rdi
    xor edx, edx

.loop:
    movzx edx, byte [r8]
    add rax, rdx
    inc r8
    dec rcx
    jnz .loop

.done:
    ret
