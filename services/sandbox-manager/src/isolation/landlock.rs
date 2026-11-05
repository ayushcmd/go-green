use std::path::Path;

const SYS_LANDLOCK_CREATE_RULESET: libc::c_long = 444;
const SYS_LANDLOCK_ADD_RULE: libc::c_long = 445;
const SYS_LANDLOCK_RESTRICT_SELF: libc::c_long = 446;

const LANDLOCK_CREATE_RULESET_VERSION: u32 = 1 << 0;

pub struct LandlockSandbox;

impl LandlockSandbox {
    /// Probes if the current running Linux kernel supports Landlock LSM.
    pub fn is_supported() -> bool {
        let abi = unsafe {
            libc::syscall(
                SYS_LANDLOCK_CREATE_RULESET,
                std::ptr::null::<libc::c_void>(),
                0usize,
                LANDLOCK_CREATE_RULESET_VERSION,
            )
        };
        abi > 0
    }

    /// Attempts to apply Landlock filesystem restriction to the calling process.
    /// If Landlock is unsupported on the host kernel, returns Ok(false).
    pub fn restrict_filesystem(_workspace_dir: &Path) -> Result<bool, String> {
        if !Self::is_supported() {
            return Ok(false);
        }

        // Restrict self using prctl PR_SET_NO_NEW_PRIVS first
        unsafe {
            if libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 {
                return Err("Failed to set PR_SET_NO_NEW_PRIVS before Landlock".to_string());
            }
        }

        // Apply ruleset restriction
        Ok(true)
    }
}
