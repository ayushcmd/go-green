pub struct CredentialManager;

impl CredentialManager {
    /// Drops root privileges in child process to unprivileged UID/GID (nobody / nogroup).
    pub fn drop_privileges(uid: u32, gid: u32) -> Result<(), String> {
        unsafe {
            // Set supplementary groups to empty
            libc::setgroups(0, std::ptr::null());

            // Set GID first
            if libc::setgid(gid) != 0 {
                return Err(format!("Failed to set GID to {}: {}", gid, *libc::__errno_location()));
            }

            // Set UID
            if libc::setuid(uid) != 0 {
                return Err(format!("Failed to set UID to {}: {}", uid, *libc::__errno_location()));
            }
        }
        Ok(())
    }
}
