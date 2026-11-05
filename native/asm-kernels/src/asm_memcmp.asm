default rel
section .text
global asm_memcmp

; ==============================================================================
; int asm_memcmp(const void* s1, const void* s2, size_t n);
; System V AMD64 ABI:
;   Input:
;     RDI: pointer to s1
;     RSI: pointer to s2
;     RDX: byte count n
;   Output:
;     EAX: <0 if s1 < s2, 0 if s1 == s2, >0 if s1 > s2
;   Preserves: RBX, RSP, RBP, R12-R15
; ==============================================================================
asm_memcmp:
    xor eax, eax
    test rdx, rdx
    jz .done

    mov r8, rdi
    mov r9, rsi
    mov rcx, rdx

.cmp_loop:
    movzx eax, byte [r8]
    movzx edx, byte [r9]
    sub eax, edx
    jnz .done

    inc r8
    inc r9
    dec rcx
    jnz .cmp_loop

    xor eax, eax

.done:
    ret
