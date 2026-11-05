default rel
section .text
global asm_simd_add_f32

; ==============================================================================
; void asm_simd_add_f32(const float* a, const float* b, float* out, size_t count);
; System V AMD64 ABI:
;   Input:
;     RDI: pointer to float array a
;     RSI: pointer to float array b
;     RDX: pointer to output float array
;     RCX: count (number of floats)
;   Output:
;     None (writes results to out)
;   Preserves: RBX, RSP, RBP, R12-R15
; ==============================================================================
asm_simd_add_f32:
    test rcx, rcx
    jz .done

    mov r8, rcx
    shr r8, 2           ; count / 4 (each 128-bit XMM register holds 4 floats)
    jz .remainder

.simd_loop:
    movups xmm0, [rdi]
    movups xmm1, [rsi]
    addps  xmm0, xmm1
    movups [rdx], xmm0

    add rdi, 16
    add rsi, 16
    add rdx, 16
    dec r8
    jnz .simd_loop

.remainder:
    and rcx, 3          ; count % 4
    jz .done

.scalar_loop:
    movss xmm0, [rdi]
    movss xmm1, [rsi]
    addss xmm0, xmm1
    movss [rdx], xmm0

    add rdi, 4
    add rsi, 4
    add rdx, 4
    dec rcx
    jnz .scalar_loop

.done:
    ret
