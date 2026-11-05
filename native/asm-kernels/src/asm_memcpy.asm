default rel
section .text
global asm_memcpy

; ==============================================================================
; void* asm_memcpy(void* dest, const void* src, size_t count);
; System V AMD64 ABI:
;   Input:
;     RDI: destination pointer
;     RSI: source pointer
;     RDX: byte count
;   Output:
;     RAX: destination pointer
;   Preserves: RBX, RSP, RBP, R12-R15
; ==============================================================================
asm_memcpy:
    mov rax, rdi        ; Return value is dest
    test rdx, rdx
    jz .done

    ; Save pointers in temp registers to avoid destroying RDI for return
    mov r8, rdi
    mov r9, rsi

    ; Check if count >= 8 for quadword bulk copy
    mov rcx, rdx
    shr rcx, 3          ; count / 8
    jz .byte_copy

    cld
.qword_loop:
    mov r10, [r9]
    mov [r8], r10
    add r9, 8
    add r8, 8
    dec rcx
    jnz .qword_loop

.byte_copy:
    mov rcx, rdx
    and rcx, 7          ; count % 8
    jz .done

.byte_loop:
    mov r10b, [r9]
    mov [r8], r10b
    inc r9
    inc r8
    dec rcx
    jnz .byte_loop

.done:
    ret
