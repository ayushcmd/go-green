default rel
section .text
global asm_add_i64

; ==============================================================================
; int64_t asm_add_i64(int64_t a, int64_t b);
; System V AMD64 ABI:
;   Input:
;     RDI: 64-bit signed integer a
;     RSI: 64-bit signed integer b
;   Output:
;     RAX: a + b
;   Preserves: RBX, RSP, RBP, R12-R15
; ==============================================================================
asm_add_i64:
    mov rax, rdi
    add rax, rsi
    ret
