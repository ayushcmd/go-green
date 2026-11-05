import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SandboxPage } from './SandboxPage';

describe('SandboxPage', () => {
  it('renders hardened execution sandbox header and capabilities', () => {
    render(<SandboxPage />);
    expect(screen.getByText(/Hardened Execution Sandbox/i)).toBeInTheDocument();
    expect(screen.getByText(/SECURED \(WSL2 LINUX x86_64\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/CGROUPS V2/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/SECCOMP-BPF/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders isolation profiles and allows switching tabs', () => {
    render(<SandboxPage />);
    expect(screen.getAllByText('NativeBenchmarkProfile').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('StaticAnalysisProfile').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ControlledTestProfile').length).toBeGreaterThanOrEqual(1);

    // Switch to Seccomp Syscall Filter tab
    const syscallTab = screen.getByText(/Seccomp Syscall Filter/i);
    fireEvent.click(syscallTab);
    expect(screen.getByText(/Permitted Linux system calls/i)).toBeInTheDocument();
    expect(screen.getByText('sys_read')).toBeInTheDocument();

    // Switch to Security Audit Log tab
    const auditTab = screen.getByText(/Security Audit Log/i);
    fireEvent.click(auditTab);
    expect(screen.getByText(/Security & Isolation Audit Log/i)).toBeInTheDocument();
  });

  it('navigates to execution console and allows dispatching workload', async () => {
    render(<SandboxPage />);
    const consoleTab = screen.getByText(/Execution Console/i);
    fireEvent.click(consoleTab);

    expect(screen.getByText(/Dispatch Workload/i)).toBeInTheDocument();
    const dispatchBtn = screen.getByText(/Execute in Hardened Sandbox/i);
    fireEvent.click(dispatchBtn);

    await waitFor(() => {
      expect(screen.getByText(/stdout\.log/i)).toBeInTheDocument();
    });
  });
});
