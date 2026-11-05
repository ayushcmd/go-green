import { describe, it, expect } from 'vitest';
import { parseBinaryBuffer, generateSpecimenElf } from './binaryParser';

describe('binaryParser', () => {
  it('correctly parses specimen ELF64 header', () => {
    const specimen = generateSpecimenElf();
    const result = parseBinaryBuffer(specimen, 'test.elf');

    expect(result.fileName).toBe('test.elf');
    expect(result.format).toBe('ELF64');
    expect(result.architecture).toBe('x86_64');
    expect(result.endianness).toBe('Little Endian');
    expect(result.magicBytes).toBe('7F 45 4C 46');
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.sections[0]?.name).toBe('.text');
  });

  it('handles empty or raw buffer without crashing', () => {
    const raw = new ArrayBuffer(64);
    const result = parseBinaryBuffer(raw, 'empty.bin');

    expect(result.fileName).toBe('empty.bin');
    expect(result.format).toBe('RAW');
    expect(result.sections.length).toBe(1);
    expect(result.sections[0]?.name).toBe('.raw');
  });
});
