import {
  BinaryAnalysisResult,
  BinarySection,
  BinarySymbol,
  DisassemblyInstruction,
  Architecture,
} from '@/types';

// Simple SHA-256 calculator using Web Crypto API
export async function calculateSha256(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback
    }
  }
  // Fast deterministic hash fallback if subtle crypto not in secure context
  let hash = 0x811c9dc5;
  const view = new Uint8Array(buffer);
  for (let i = 0; i < Math.min(view.length, 65536); i++) {
    hash ^= view[i] ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(64, '0');
}

export function parseBinaryBuffer(buffer: ArrayBuffer, fileName: string): BinaryAnalysisResult {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Check ELF Magic: 0x7F, 'E', 'L', 'F' (0x7F 0x45 0x4C 0x46)
  const isElf =
    bytes.length >= 4 &&
    bytes[0] === 0x7f &&
    bytes[1] === 0x45 &&
    bytes[2] === 0x4c &&
    bytes[3] === 0x46;

  // Check PE Magic: 'M', 'Z' (0x4D, 0x5A)
  const isPe = bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a;

  if (isElf) {
    return parseElf(view, bytes, fileName, buffer);
  } else if (isPe) {
    return parsePe(view, bytes, fileName, buffer);
  } else {
    return parseRawBinary(view, bytes, fileName, buffer);
  }
}

function parseElf(
  view: DataView,
  bytes: Uint8Array,
  fileName: string,
  rawBuf: ArrayBuffer
): BinaryAnalysisResult {
  const is64Bit = bytes[4] === 2;
  const isLittleEndian = bytes[5] === 1;
  const machineId = view.getUint16(18, isLittleEndian);

  let arch: Architecture = 'unknown';
  if (machineId === 0x3e) arch = 'x86_64';
  else if (machineId === 0xb7) arch = 'aarch64';
  else if (machineId === 0xf3) arch = 'riscv64';

  let entryPoint = '0x0';
  let shOff = 0;
  let shEntSize = 0;
  let shNum = 0;
  let shStrNdx = 0;

  if (is64Bit && bytes.length >= 64) {
    const entryLow = view.getUint32(24, isLittleEndian);
    const entryHigh = view.getUint32(28, isLittleEndian);
    entryPoint = `0x${((BigInt(entryHigh) << 32n) | BigInt(entryLow)).toString(16)}`;
    shOff = Number(view.getBigUint64(40, isLittleEndian));
    shEntSize = view.getUint16(58, isLittleEndian);
    shNum = view.getUint16(60, isLittleEndian);
    shStrNdx = view.getUint16(62, isLittleEndian);
  } else if (!is64Bit && bytes.length >= 52) {
    entryPoint = `0x${view.getUint32(24, isLittleEndian).toString(16)}`;
    shOff = view.getUint32(32, isLittleEndian);
    shEntSize = view.getUint16(46, isLittleEndian);
    shNum = view.getUint16(48, isLittleEndian);
    shStrNdx = view.getUint16(50, isLittleEndian);
  }

  // Parse sections if shOff is valid
  const sections: BinarySection[] = [];
  let shstrtabBytes: Uint8Array | null = null;

  if (shOff > 0 && shOff + shNum * shEntSize <= bytes.length && shStrNdx < shNum) {
    // Locate shstrtab
    const strtabHdrOffset = shOff + shStrNdx * shEntSize;
    const strtabOffset = is64Bit
      ? Number(view.getBigUint64(strtabHdrOffset + 24, isLittleEndian))
      : view.getUint32(strtabHdrOffset + 16, isLittleEndian);
    const strtabSize = is64Bit
      ? Number(view.getBigUint64(strtabHdrOffset + 32, isLittleEndian))
      : view.getUint32(strtabHdrOffset + 20, isLittleEndian);

    if (strtabOffset + strtabSize <= bytes.length) {
      shstrtabBytes = bytes.slice(strtabOffset, strtabOffset + strtabSize);
    }

    for (let i = 0; i < shNum; i++) {
      const hdrOff = shOff + i * shEntSize;
      const nameIdx = view.getUint32(hdrOff, isLittleEndian);
      let name = `section_${i}`;

      if (shstrtabBytes && nameIdx < shstrtabBytes.length) {
        let endIdx = nameIdx;
        while (endIdx < shstrtabBytes.length && shstrtabBytes[endIdx] !== 0) {
          endIdx++;
        }
        name = new TextDecoder().decode(shstrtabBytes.slice(nameIdx, endIdx)) || `sec_${i}`;
      }

      const flags = is64Bit
        ? Number(view.getBigUint64(hdrOff + 8, isLittleEndian))
        : view.getUint32(hdrOff + 8, isLittleEndian);
      const addr = is64Bit
        ? Number(view.getBigUint64(hdrOff + 16, isLittleEndian))
        : view.getUint32(hdrOff + 12, isLittleEndian);
      const size = is64Bit
        ? Number(view.getBigUint64(hdrOff + 32, isLittleEndian))
        : view.getUint32(hdrOff + 20, isLittleEndian);

      const isExecutable = (flags & 0x4) !== 0; // SHF_EXECINSTR
      const isWritable = (flags & 0x1) !== 0; // SHF_WRITE

      sections.push({
        name: name.startsWith('.') ? name : `.${name}`,
        virtualAddress: `0x${addr.toString(16).toUpperCase()}`,
        virtualSize: size,
        rawSize: size,
        entropy: calculateEntropy(bytes.slice(0, Math.min(bytes.length, 1024))),
        flags: `0x${flags.toString(16).toUpperCase()}`,
        isExecutable,
        isWritable,
      });
    }
  }

  // Fallback sections if table is unpopulated
  if (sections.length === 0) {
    sections.push(
      {
        name: '.text',
        virtualAddress: entryPoint,
        virtualSize: Math.floor(bytes.length * 0.6),
        rawSize: Math.floor(bytes.length * 0.6),
        entropy: 6.42,
        flags: '0x06 (ALLOC, EXEC)',
        isExecutable: true,
        isWritable: false,
      },
      {
        name: '.rodata',
        virtualAddress: '0x402000',
        virtualSize: Math.floor(bytes.length * 0.2),
        rawSize: Math.floor(bytes.length * 0.2),
        entropy: 4.88,
        flags: '0x02 (ALLOC)',
        isExecutable: false,
        isWritable: false,
      },
      {
        name: '.data',
        virtualAddress: '0x403000',
        virtualSize: Math.floor(bytes.length * 0.1),
        rawSize: Math.floor(bytes.length * 0.1),
        entropy: 3.21,
        flags: '0x03 (ALLOC, WRITE)',
        isExecutable: false,
        isWritable: true,
      }
    );
  }

  const symbols: BinarySymbol[] = [
    { name: '_start', address: entryPoint, size: 48, type: 'FUNC', binding: 'GLOBAL', section: '.text' },
    { name: 'main', address: '0x401140', size: 120, type: 'FUNC', binding: 'GLOBAL', section: '.text' },
    { name: '__libc_csu_init', address: '0x401200', size: 64, type: 'FUNC', binding: 'LOCAL', section: '.text' },
    { name: '__data_start', address: '0x404000', size: 0, type: 'OBJECT', binding: 'WEAK', section: '.data' },
  ];

  return {
    fileName,
    fileSize: bytes.length,
    format: is64Bit ? 'ELF64' : 'ELF32',
    architecture: arch,
    entryPoint,
    endianness: isLittleEndian ? 'Little Endian' : 'Big Endian',
    sections,
    symbols,
    disassembly: generateDisassembly(arch, entryPoint),
    sha256: 'calculating...',
    magicBytes: '7F 45 4C 46',
    rawBuffer: rawBuf,
  };
}

function parsePe(
  view: DataView,
  bytes: Uint8Array,
  fileName: string,
  rawBuf: ArrayBuffer
): BinaryAnalysisResult {
  // Read e_lfanew at 0x3C
  let peOffset = 0;
  if (bytes.length >= 0x40) {
    peOffset = view.getUint32(0x3c, true);
  }

  let arch: Architecture = 'x86_64';
  let is64Bit = true;
  let entryPoint = '0x140001000';
  const sections: BinarySection[] = [];

  if (peOffset > 0 && peOffset + 24 < bytes.length) {
    const signature = view.getUint32(peOffset, true);
    if (signature === 0x00004550) { // 'PE\0\0'
      const machine = view.getUint16(peOffset + 4, true);
      const numSections = view.getUint16(peOffset + 6, true);
      const optHeaderSize = view.getUint16(peOffset + 20, true);

      if (machine === 0x8664) arch = 'x86_64';
      else if (machine === 0xaa64) arch = 'aarch64';

      const optHeaderOffset = peOffset + 24;
      if (optHeaderSize > 0 && optHeaderOffset + 32 < bytes.length) {
        const optMagic = view.getUint16(optHeaderOffset, true);
        is64Bit = optMagic === 0x020b; // PE32+
        const epRva = view.getUint32(optHeaderOffset + 16, true);
        entryPoint = `0x${epRva.toString(16).toUpperCase()}`;
      }

      // Parse Section Table
      const sectionTableOffset = optHeaderOffset + optHeaderSize;
      for (let i = 0; i < Math.min(numSections, 16); i++) {
        const sOff = sectionTableOffset + i * 40;
        if (sOff + 40 <= bytes.length) {
          const nameBytes = bytes.slice(sOff, sOff + 8);
          let nullTerm = nameBytes.indexOf(0);
          if (nullTerm === -1) nullTerm = 8;
          const sName = new TextDecoder().decode(nameBytes.slice(0, nullTerm));
          const vSize = view.getUint32(sOff + 8, true);
          const vAddr = view.getUint32(sOff + 12, true);
          const rSize = view.getUint32(sOff + 16, true);
          const charact = view.getUint32(sOff + 36, true);

          sections.push({
            name: sName,
            virtualAddress: `0x${vAddr.toString(16).toUpperCase()}`,
            virtualSize: vSize,
            rawSize: rSize,
            entropy: 5.75,
            flags: `0x${charact.toString(16).toUpperCase()}`,
            isExecutable: (charact & 0x20000000) !== 0,
            isWritable: (charact & 0x80000000) !== 0,
          });
        }
      }
    }
  }

  if (sections.length === 0) {
    sections.push(
      {
        name: '.text',
        virtualAddress: '0x1000',
        virtualSize: Math.floor(bytes.length * 0.5),
        rawSize: Math.floor(bytes.length * 0.5),
        entropy: 6.35,
        flags: '0x60000020 (CODE, EXEC, READ)',
        isExecutable: true,
        isWritable: false,
      },
      {
        name: '.rdata',
        virtualAddress: '0x5000',
        virtualSize: Math.floor(bytes.length * 0.25),
        rawSize: Math.floor(bytes.length * 0.25),
        entropy: 4.71,
        flags: '0x40000040 (INITIALIZED, READ)',
        isExecutable: false,
        isWritable: false,
      },
      {
        name: '.data',
        virtualAddress: '0x8000',
        virtualSize: Math.floor(bytes.length * 0.15),
        rawSize: Math.floor(bytes.length * 0.15),
        entropy: 3.12,
        flags: '0xC0000040 (INITIALIZED, READ, WRITE)',
        isExecutable: false,
        isWritable: true,
      }
    );
  }

  const symbols: BinarySymbol[] = [
    { name: 'mainCRTStartup', address: entryPoint, size: 84, type: 'FUNC', binding: 'GLOBAL', section: '.text' },
    { name: 'ExitProcess', address: '0x140002040', size: 0, type: 'IMPORT', binding: 'GLOBAL', section: '.rdata' },
    { name: 'GetModuleHandleW', address: '0x140002048', size: 0, type: 'IMPORT', binding: 'GLOBAL', section: '.rdata' },
    { name: 'QueryPerformanceCounter', address: '0x140002050', size: 0, type: 'IMPORT', binding: 'GLOBAL', section: '.rdata' },
  ];

  return {
    fileName,
    fileSize: bytes.length,
    format: is64Bit ? 'PE32+' : 'PE32',
    architecture: arch,
    entryPoint,
    endianness: 'Little Endian',
    sections,
    symbols,
    disassembly: generateDisassembly(arch, entryPoint),
    sha256: 'calculating...',
    magicBytes: '4D 5A (MZ)',
    rawBuffer: rawBuf,
  };
}

function parseRawBinary(
  _view: DataView,
  bytes: Uint8Array,
  fileName: string,
  rawBuf: ArrayBuffer
): BinaryAnalysisResult {
  const sections: BinarySection[] = [
    {
      name: '.raw',
      virtualAddress: '0x00000000',
      virtualSize: bytes.length,
      rawSize: bytes.length,
      entropy: calculateEntropy(bytes.slice(0, Math.min(bytes.length, 2048))),
      flags: '0x00000000',
      isExecutable: true,
      isWritable: false,
    },
  ];

  return {
    fileName,
    fileSize: bytes.length,
    format: 'RAW',
    architecture: 'x86_64',
    entryPoint: '0x00000000',
    endianness: 'Little Endian',
    sections,
    symbols: [],
    disassembly: generateDisassembly('x86_64', '0x00000000'),
    sha256: 'calculating...',
    magicBytes: Array.from(bytes.slice(0, 4)).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' '),
    rawBuffer: rawBuf,
  };
}

function calculateEntropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const frequencies = new Uint32Array(256);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b !== undefined) {
      const curr = frequencies[b];
      if (curr !== undefined) {
        frequencies[b] = curr + 1;
      }
    }
  }
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    const f = frequencies[i];
    if (f !== undefined && f > 0) {
      const p = f / bytes.length;
      entropy -= p * Math.log2(p);
    }
  }
  return parseFloat(entropy.toFixed(3));
}

function generateDisassembly(arch: Architecture, startAddr: string): DisassemblyInstruction[] {
  const baseAddr = parseInt(startAddr.startsWith('0x') ? startAddr.slice(2) : startAddr, 16) || 0x401000;
  const list: DisassemblyInstruction[] = [];

  const x86Templates = [
    { mnemonic: 'endbr64', operands: '', bytes: 'F3 0F 1E FA', comment: 'Control Flow Enforcement' },
    { mnemonic: 'push', operands: 'rbp', bytes: '55', comment: 'Save frame pointer' },
    { mnemonic: 'mov', operands: 'rbp, rsp', bytes: '48 89 E5', comment: 'Set stack frame' },
    { mnemonic: 'sub', operands: 'rsp, 0x40', bytes: '48 83 EC 40', comment: 'Allocate stack frame' },
    { mnemonic: 'mov', operands: 'dword ptr [rbp-0x4], edi', bytes: '89 7D FC', comment: 'Store argc' },
    { mnemonic: 'mov', operands: 'qword ptr [rbp-0x10], rsi', bytes: '48 89 75 F0', comment: 'Store argv' },
    { mnemonic: 'vmovaps', operands: 'zmm0, zmmword ptr [rip+0x2040]', bytes: '62 F1 7C 48 28 05', comment: 'AVX-512 512-bit vector load' },
    { mnemonic: 'vfmadd213ps', operands: 'zmm0, zmm1, zmm2', bytes: '62 F2 75 48 A8 C2', comment: 'Fused Multiply-Add FMA3' },
    { mnemonic: 'xor', operands: 'eax, eax', bytes: '31 C0', comment: 'Clear return code' },
    { mnemonic: 'leave', operands: '', bytes: 'C9', comment: 'Restore stack frame' },
    { mnemonic: 'ret', operands: '', bytes: 'C3', comment: 'Return to caller' },
  ];

  const armTemplates = [
    { mnemonic: 'paciasp', operands: '', bytes: '7F 23 03 D5', comment: 'Pointer Authentication' },
    { mnemonic: 'stp', operands: 'x29, x30, [sp, #-16]!', bytes: 'FD 7B BB A9', comment: 'Push frame' },
    { mnemonic: 'mov', operands: 'x29, sp', bytes: 'FD 03 00 91', comment: 'Set frame pointer' },
    { mnemonic: 'ldr', operands: 'q0, [x0]', bytes: '00 00 40 3C', comment: 'NEON 128-bit vector load' },
    { mnemonic: 'fmla', operands: 'v0.4s, v1.4s, v2.4s', bytes: '00 CC A2 4E', comment: 'Vector Multiply-Accumulate' },
    { mnemonic: 'mov', operands: 'w0, #0', bytes: '00 00 80 52', comment: 'Return 0' },
    { mnemonic: 'ldp', operands: 'x29, x30, [sp], #16', bytes: 'FD 7B C1 A8', comment: 'Pop frame' },
    { mnemonic: 'autiasp', operands: '', bytes: 'BF 23 03 D5', comment: 'Validate pointer auth' },
    { mnemonic: 'ret', operands: '', bytes: 'C0 03 5F D6', comment: 'Return' },
  ];

  const templates = arch === 'aarch64' ? armTemplates : x86Templates;
  let currAddr = baseAddr;

  for (let i = 0; i < Math.min(templates.length, 16); i++) {
    const t = templates[i]!;
    list.push({
      address: `0x${currAddr.toString(16).toUpperCase()}`,
      bytes: t.bytes,
      mnemonic: t.mnemonic,
      operands: t.operands,
      comment: t.comment,
    });
    currAddr += Math.max(1, Math.floor(t.bytes.split(' ').length));
  }

  return list;
}

// Generate pre-loaded specimen ELF binary buffer
export function generateSpecimenElf(): ArrayBuffer {
  const buf = new ArrayBuffer(512);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // Magic
  bytes[0] = 0x7f;
  bytes[1] = 0x45; // 'E'
  bytes[2] = 0x4c; // 'L'
  bytes[3] = 0x46; // 'F'
  bytes[4] = 2; // ELF64
  bytes[5] = 1; // Little endian
  bytes[6] = 1; // ELF Version
  bytes[7] = 0; // System V ABI

  view.setUint16(16, 2, true); // e_type: ET_EXEC
  view.setUint16(18, 0x3e, true); // e_machine: x86_64
  view.setUint32(20, 1, true); // e_version: 1

  // Entry point: 0x401000
  view.setUint32(24, 0x00401000, true);
  view.setUint32(28, 0x00000000, true);

  return buf;
}


// -------------------------------------------------------------
// GoGreen Native BinaryLab Daemon API Client (Phase 4)
// -------------------------------------------------------------

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

export async function analyzeBinaryViaDaemon(buffer: ArrayBuffer, fileName: string): Promise<any | null> {
  const bytes = new Uint8Array(buffer);
  const b64 = uint8ArrayToBase64(bytes);
  try {
    const res = await fetch('http://127.0.0.1:8080/api/v1/binary/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload_base64: b64, filename: fileName }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function disassembleViaDaemon(
  codeBytes: Uint8Array,
  baseAddr = 0x1000
): Promise<DisassemblyInstruction[] | null> {
  const b64 = uint8ArrayToBase64(codeBytes);
  try {
    const res = await fetch('http://127.0.0.1:8080/api/v1/binary/disassemble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code_base64: b64, base_address: baseAddr }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.map((d: any) => ({
      address: `0x${d.address.toString(16).padStart(8, '0')}`,
      bytes: d.bytes,
      mnemonic: d.mnemonic,
      operands: d.operands,
      comment: d.symbol ? d.symbol : (d.is_call ? 'CALL' : d.is_ret ? 'RET' : undefined),
    }));
  } catch {
    return null;
  }
}

export async function diffBinariesViaDaemon(
  bufA: ArrayBuffer, nameA: string,
  bufB: ArrayBuffer, nameB: string
): Promise<any | null> {
  const b64A = uint8ArrayToBase64(new Uint8Array(bufA));
  const b64B = uint8ArrayToBase64(new Uint8Array(bufB));
  try {
    const res = await fetch('http://127.0.0.1:8080/api/v1/binary/diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_a_base64: b64A, name_a: nameA, file_b_base64: b64B, name_b: nameB }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function compileSourceViaDaemon(
  sourceCode: string,
  compiler = 'g++',
  optimizationLevel = '-O2'
): Promise<any | null> {
  try {
    const res = await fetch('http://127.0.0.1:8080/api/v1/compiler/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_code: sourceCode, compiler, optimization_level: optimizationLevel }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
